import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { refresh } from "../src/pipeline.ts";
import type { Step } from "../src/steps.ts";

/**
 * The whole command on a small set, offline: a fake repo whose "build" turns `data/osm/a.json`
 * into the two tables the way `osm:build` and `osm:props` do (with a map iterated in insertion
 * order, so the order of the input would show), and a fetch step that fails if it ever runs.
 */

const BUILD = `const fs = require("node:fs");
const d = JSON.parse(fs.readFileSync("data/osm/a.json", "utf8"));
const chunks = d.chunks.map((c) => ({ id: c.id, district: "targ", bounds: {}, terrain: {}, buildings: c.buildings.map((id) => ({ id })), ground: c.ground }));
fs.mkdirSync("packages/sim/src/content/lublin", { recursive: true });
if (!process.argv.includes("--no-write")) fs.writeFileSync("packages/sim/src/content/lublin/a.generated.ts", "export const A_CHUNKS = " + JSON.stringify(chunks) + ";\\n");
`;
const PROPS = `const fs = require("node:fs");
const d = JSON.parse(fs.readFileSync("data/osm/a.json", "utf8"));
const t = {};
for (const c of d.chunks) t[c.id] = { bench: c.benches.flatMap((x) => [x, 0, 0, 0, 1]) };
fs.writeFileSync("packages/sim/src/content/lublin/props.generated.ts", "export const LUBLIN_PROP_TABLE = " + JSON.stringify(t) + ";\\n");
`;

const STEPS: readonly Step[] = [
  { id: "osm-fetch", group: "fetch", source: "osm", cmd: ["node", "-e", "process.exit(9)"] },
  { id: "osm-build", group: "build", cmd: ["node", "tools/build.cjs"] },
  { id: "osm-props", group: "build", cmd: ["node", "tools/props.cjs"] },
];

const DATA = {
  chunks: [
    { id: "a-0-0", buildings: ["b1", "b2"], benches: [1, 2, 3], ground: [{ surface: "grass", outline: [0, 0, 10, 0, 10, 10, 0, 10] }] },
    { id: "a-0-1", buildings: ["b3"], benches: [4], ground: [{ surface: "road", outline: [0, 0, 4, 0, 4, 5, 0, 5] }] },
  ],
};

const roots: string[] = [];
const fakeRepo = (): string => {
  const root = mkdtempSync(join(tmpdir(), "map-refresh-"));
  roots.push(root);
  mkdirSync(join(root, "tools"), { recursive: true });
  mkdirSync(join(root, "data/osm"), { recursive: true });
  writeFileSync(join(root, "tools/build.cjs"), BUILD);
  writeFileSync(join(root, "tools/props.cjs"), PROPS);
  writeFileSync(join(root, "data/osm/a.json"), JSON.stringify(DATA));
  return root;
};

/** Every file under `root` with its bytes, the logs too. */
const tree = (root: string): Record<string, string> =>
  Object.fromEntries(
    readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((f) => statSync(join(root, f)).isFile())
      .sort()
      .map((f) => [f, readFileSync(join(root, f), "base64")]),
  );

const run = (root: string) => refresh({ root, steps: STEPS, offline: true, sources: ["osm"], fromCache: false, skip: new Set(), twice: true, quiet: true });

afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

describe("pnpm map:refresh on a small set, offline", () => {
  it("gives the same files byte for byte on two runs over the same data, the report too", async () => {
    const root = fakeRepo();
    // The first run builds the tables the fake repo lacks; the next two find them as they leave them.
    await run(root);
    await run(root);
    const first = tree(root);
    const second = await run(root);
    expect(tree(root)).toEqual(first);
    expect(Object.keys(first)).toEqual(expect.arrayContaining(["reports/map-refresh.md", "reports/map-refresh.json", "packages/sim/src/content/lublin/a.generated.ts"]));
    // A copy of the repo elsewhere gives the same report: no path, date or machine in it.
    const copy = mkdtempSync(join(tmpdir(), "map-refresh-copy-"));
    roots.push(copy);
    cpSync(root, copy, { recursive: true });
    await run(copy);
    expect(readFileSync(join(copy, "reports/map-refresh.md"), "utf8")).toBe(readFileSync(join(root, "reports/map-refresh.md"), "utf8"));
    const r = second.report;
    expect(second.code).toBe(0);
    expect(r.steps.map((s) => `${s.id} ${s.status}`)).toEqual(["osm-fetch skipped", "osm-build ran", "osm-props ran", "twice ran"]);
    expect(r.files).toEqual([]);
    // No scan in the fake repo: the verdict cannot be "no review".
    expect(r.verdict.reasons).toEqual(["skan glitchy nie przebiegł"]);
  });

  it("reports what new data changes: the tables' files, the objects by kind and the surfaces", async () => {
    const root = fakeRepo();
    await run(root);
    const data = structuredClone(DATA);
    data.chunks[0]!.buildings.push("b4");
    data.chunks[1]!.ground[0]!.outline = [0, 0, 4, 0, 4, 6, 0, 6];
    writeFileSync(join(root, "data/osm/a.json"), JSON.stringify(data));
    const { report: r } = await run(root);
    expect(r.files.map((f) => f.path)).toEqual(["packages/sim/src/content/lublin/a.generated.ts"]);
    expect(r.objects).toEqual({ buildings: { before: 3, after: 4 } });
    expect(r.surfaces).toEqual({ road: { before: 20, after: 24 } });
    expect(r.surfaceByChunk).toEqual({ "a-0-1": 4 });
    expect(r.verdict.places).toContain("kawałek a-0-1: 4 m² nawierzchni");
  });

  it("says a build that is not deterministic", async () => {
    const root = fakeRepo();
    const steps: Step[] = [{ id: "osm-build", group: "build", cmd: ["node", "-e", 'require("node:fs").mkdirSync("data/osm", { recursive: true }); require("node:fs").writeFileSync("data/osm/t.json", String(process.hrtime.bigint()))'] }];
    const { report, code } = await refresh({ root, steps, offline: true, sources: ["osm"], fromCache: false, skip: new Set(), twice: true, quiet: true });
    expect(code).toBe(1);
    expect(report.steps.at(-1)).toEqual({ id: "twice", status: "failed", note: "drugi przebieg zmienił: data/osm/t.json" });
  });
});
