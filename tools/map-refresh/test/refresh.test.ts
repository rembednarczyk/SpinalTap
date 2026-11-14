import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { EXIT, exitCodeOf, refresh } from "../src/pipeline.ts";
import type { Report } from "../src/report.ts";
import { RateLimited } from "../src/run.ts";
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
    // A whole report whose verdict asks the curator (no scan here): exit 2, not a failure.
    expect(second.code).toBe(2);
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

/**
 * A fetch step that asks the orthophoto through `tools/orto/src/http.ts` over a fake network: each
 * request takes the next answer, a reset as Node throws it (`fetch failed`, cause `read ECONNRESET`)
 * or a status. It writes the tile into the cache only when the request succeeds.
 */
const HTTP = new URL("../../orto/src/http.ts", import.meta.url).pathname;
const ortoFetch = (answers: readonly ("reset" | number)[]): Step => ({
  id: "orto-fetch",
  group: "fetch",
  source: "orto",
  cmd: [
    "node",
    "--input-type=module",
    "-e",
    `import { getPng } from ${JSON.stringify(HTTP)};
import { mkdirSync, writeFileSync } from "node:fs";
const answers = ${JSON.stringify(answers)};
let n = 0;
const fetch = async () => {
  const a = answers[n++];
  if (a === "reset") throw new TypeError("fetch failed", { cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }) });
  return new Response(new Uint8Array([137, 80, 78, 71]), { status: a, headers: { "content-type": "image/png" } });
};
const png = await getPng("https://wms/tile", { fetch, pause: async () => {}, log: console.log });
mkdirSync("cache", { recursive: true });
writeFileSync("cache/tile.png", png);
console.log("requests: " + n);`,
  ],
});
const ORTO_BUILD: Step = { id: "orto-build", group: "extract", source: "orto", cmd: ["node", "-e", 'require("node:fs").writeFileSync("data/osm/orto.json", "{}")'] };
/** The scan as it reports: no key found, against an empty base. */
const SCAN: Step = { id: "scan", group: "check", cmd: ["node", "-e", 'const fs = require("node:fs"); fs.mkdirSync("reports", { recursive: true }); fs.writeFileSync("reports/glitch-scan.json", JSON.stringify({ keys: {} }))'], mayFail: true };
/** Online on a fake repo whose tables an offline run built first, so only the fetch shows. */
const online = async (root: string, answers: readonly ("reset" | number)[]) => {
  await run(root);
  // Its own orto cache: the pipeline skips orto-build when the machine has none (a CI runner).
  const cache = mkdtempSync(join(tmpdir(), "map-refresh-orto-"));
  const before = process.env.SEKI_ORTO_CACHE;
  process.env.SEKI_ORTO_CACHE = cache;
  try {
    return await refresh({ root, steps: [ortoFetch(answers), ORTO_BUILD, ...STEPS.slice(1), SCAN], offline: false, sources: ["osm", "orto"], fromCache: false, skip: new Set(), twice: false, quiet: true });
  } finally {
    if (before === undefined) delete process.env.SEKI_ORTO_CACHE;
    else process.env.SEKI_ORTO_CACHE = before;
    rmSync(cache, { recursive: true, force: true });
  }
};

describe("pnpm map:refresh when a fetch drops its connection", () => {
  it("asks once more after a reset and goes on as if nothing happened", async () => {
    const root = fakeRepo();
    const { report: r, code } = await online(root, ["reset", 200]);
    expect(code).toBe(0);
    expect(readFileSync(join(root, "reports/map-refresh/orto-fetch.log"), "utf8")).toContain("requests: 2");
    expect(r.steps.map((s) => `${s.id} ${s.status}`)).toEqual(["orto-fetch ran", "orto-build ran", "osm-build ran", "osm-props ran", "scan ran"]);
    expect(r.stale).toEqual([]);
    expect(r.verdict.review).toBe(false);
  });

  it("after two resets in a row fails the fetch, keeps the source's data from the repo and still runs the build and the scan", async () => {
    const root = fakeRepo();
    const { report: r, code } = await online(root, ["reset", "reset"]);
    // The report is whole (the scan ran on the repo's data): exit 2, so the workflow still opens its PR.
    expect(code).toBe(2);
    expect(readFileSync(join(root, "reports/map-refresh/orto-fetch.log"), "utf8")).toContain("read ECONNRESET");
    expect(r.steps.map((s) => `${s.id} ${s.status}`)).toEqual(["orto-fetch failed", "orto-build skipped", "osm-build ran", "osm-props ran", "scan ran"]);
    expect(r.steps[1]!.note).toBe("po nieudanym orto-fetch: dane orto z repo, nie z niepełnej pamięci podręcznej");
    expect(r.stale).toEqual([{ source: "orto", step: "orto-fetch" }]);
    expect(r.scan.ran).toBe(true);
    expect(r.verdict.review).toBe(true);
    expect(r.verdict.reasons).toEqual(["kroki nieudane: orto-fetch", "źródło nieświeże: orto (orto-fetch nieudany; dane orto z repo)"]);
    expect(readFileSync(join(root, "reports/map-refresh.md"), "utf8")).toContain("**Źródła nieświeże** (pobranie nieudane, dane z repo, skan i testy złote liczone na nich): orto (orto-fetch).");
  });

  it("stops at HTTP 429 without asking again", async () => {
    const root = fakeRepo();
    await expect(online(root, [429, 200])).rejects.toBeInstanceOf(RateLimited);
    const log = readFileSync(join(root, "reports/map-refresh/orto-fetch.log"), "utf8");
    expect(log).toContain("HTTP 429 (no retry)");
    expect(log).not.toContain("requests:");
  });
});

describe("pnpm map:refresh's exit code", () => {
  const report = (steps: Report["steps"], stale: Report["stale"], review: boolean) => ({ steps, stale, verdict: { review } }) as unknown as Report;
  const ran = { id: "scan", status: "ran", note: "" } as const;
  const fetchFailed = { id: "orto-fetch", status: "failed", note: "" } as const;
  const ortoStale = { source: "orto", step: "orto-fetch" } as const;

  it("is 0 for a whole report without review and 2 for one that asks the curator", () => {
    expect(exitCodeOf(report([ran], [], false))).toBe(EXIT.done);
    expect(exitCodeOf(report([ran], [], true))).toBe(EXIT.review);
  });

  it("is 2 when only fetches failed (their sources stale, the scan run), 1 when another step failed", () => {
    expect(exitCodeOf(report([fetchFailed, ran], [ortoStale], true))).toBe(EXIT.review);
    expect(exitCodeOf(report([{ id: "osm-build", status: "failed", note: "" }], [], true))).toBe(EXIT.tool);
    expect(exitCodeOf(report([fetchFailed, { id: "twice", status: "failed", note: "" }], [ortoStale], true))).toBe(EXIT.tool);
  });

  it("keeps 3 for an HTTP 429 apart from the others", () => {
    expect(new Set(Object.values(EXIT)).size).toBe(4);
    expect(EXIT.rateLimited).toBe(3);
  });
});
