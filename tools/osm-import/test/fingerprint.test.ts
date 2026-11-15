import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  TABLES,
  type TableInputs,
  type TableName,
  OWNED,
  fingerprintFiles,
  fingerprintIn,
  fingerprintOf,
  importsOf,
  inputFiles,
  missingInputs,
  moduleClosure,
  staleTable,
  tableFingerprint,
  withFingerprint,
  withoutFingerprint,
} from "../src/fingerprint.ts";
import { REPO } from "../src/paths.ts";

const NAMES = Object.keys(TABLES) as TableName[];

describe("the map tables' fingerprints (ADR-0083 step 1)", () => {
  // In place of generating the city again: CI's `tables` job does that, and compares byte for byte.
  it.each(NAMES)("%s: every table it writes was written from the inputs as they are", (name) => {
    const fingerprint = tableFingerprint(name);
    for (const path of TABLES[name].outputs) {
      const stale = staleTable(path, readFileSync(join(REPO, path), "utf8"), fingerprint, TABLES[name].command);
      expect(stale, stale ?? "").toBeNull();
    }
  });

  it("loads by path no module of `props-build.ts` the inputs of `pnpm osm:props` leave out", () => {
    const source = readFileSync(join(REPO, "tools/osm-import/src/props-build.ts"), "utf8");
    const loaded = [...source.matchAll(/runWith<[^>]+>\(\s*"([^"]+)"/g)].map((m) => m[1]!);
    expect(loaded.length).toBeGreaterThan(0);
    for (const f of loaded) expect(TABLES.props.entries).toContain(f);
  });

  // A new data file read by its path in a module of the closure, out of the list, would change the tables unseen.
  it.each(NAMES)("%s: every data path its modules name lies in its data", (name) => {
    const t = TABLES[name];
    // Not the list itself.
    const modules = moduleClosure(t.entries).filter((f) => f !== "tools/osm-import/src/fingerprint.ts");
    const named = modules.flatMap((f) => {
      const code = readFileSync(join(REPO, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      return [...code.matchAll(/["'`]((?:data|docs\/world)\/[^"'`$]+)["'`]/g)].map((m) => ({ f, path: m[1]! }));
    });
    expect(named.length).toBeGreaterThan(0);
    const outside = named.filter(({ path }) => !t.data.some((d) => path === d || path.startsWith(`${d}/`) || d.startsWith(`${path}/`)));
    expect(outside).toEqual([]);
  });

  it("follows every import of the generators into the workspace's packages, the city's tables among them", () => {
    const props = inputFiles(TABLES.props);
    expect(props).toContain("packages/sim/src/content/lublin/stare-miasto.generated.ts");
    expect(props).toContain("packages/core/src/index.ts");
    expect(props).toContain("docs/world/lublin-props.todo.json");
    expect(props).not.toContain(TABLES.props.outputs[0]);
    const build = inputFiles(TABLES.build);
    expect(build).toContain("tools/orto/src/cover.ts");
    expect(build).toContain("data/osm/stare-miasto.json");
    for (const out of TABLES.build.outputs) expect(build).not.toContain(out);
  });

  // 15.11 (#582): with the whole closure in the header, a change of the renderer alone asked for the tables again.
  it("puts in the header only the inputs the map owns: the renderer and the rest of the simulation are left to the Map tables job", () => {
    const all = inputFiles(TABLES.props);
    const owned = fingerprintFiles(TABLES.props);
    expect(all.some((f) => f.startsWith("packages/engine/"))).toBe(true);
    expect(owned.some((f) => f.startsWith("packages/engine/") || f.startsWith("packages/core/"))).toBe(false);
    expect(owned).toContain("tools/osm-import/src/props.ts");
    expect(owned).toContain("packages/sim/src/content/lublin/stare-miasto.generated.ts");
    expect(owned).toContain("docs/world/lublin-props.todo.json");
    for (const f of owned) expect(OWNED.some((o) => f.startsWith(o)) || TABLES.props.data.some((d) => f === d || f.startsWith(`${d}/`)), f).toBe(true);
  });
});

describe("fingerprintOf over a repository's inputs", () => {
  let root = "";
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const write = (files: Record<string, string>) => {
    for (const [f, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, f)), { recursive: true });
      writeFileSync(join(root, f), text);
    }
  };
  const TABLE: TableInputs = { command: "pnpm gen", outputs: ["out/table.generated.ts"], entries: ["tool/gen.ts"], data: ["data/in"] };
  const fp = () => fingerprintOf(inputFiles(TABLE, root), root);

  const repo = () => {
    root = mkdtempSync(join(tmpdir(), "seki-fingerprint-"));
    write({
      "tool/gen.ts": 'import { a } from "./a.ts";\nimport type { T } from "./types.ts";\nimport { b } from "./b";\nimport { c } from "@seki/lib";\nexport const run = () => a + b + c;\n',
      "tool/a.ts": "export const a = 1;\n",
      "tool/b.ts": "export const b = 2;\n",
      "tool/types.ts": "export type T = number;\n",
      "tool/unused.ts": "export const u = 3;\n",
      "packages/lib/package.json": JSON.stringify({ name: "@seki/lib", exports: { ".": "./src/index.ts" } }),
      "packages/lib/src/index.ts": "export const c = 3;\n",
      "data/in/x.json": "[1]\n",
      "data/other.json": "[2]\n",
      "out/table.generated.ts": "// table\n",
    });
  };

  it("changes with any one input: a module imported directly, by an extensionless path, from a package, or a data file", () => {
    repo();
    const before = fp();
    for (const [f, text] of [["tool/a.ts", "export const a = 10;\n"], ["tool/b.ts", "export const b = 20;\n"], ["packages/lib/src/index.ts", "export const c = 30;\n"], ["data/in/x.json", "[10]\n"], ["tool/gen.ts", "export const run = () => 0;\n"]] as const) {
      const old = readFileSync(join(root, f), "utf8");
      write({ [f]: text });
      expect(fp(), f).not.toBe(before);
      write({ [f]: old });
      expect(fp()).toBe(before);
    }
  });

  it("stays the same for what the generator does not read: a module no one imports, a type-only import, other data, its own table", () => {
    repo();
    const before = fp();
    write({ "tool/unused.ts": "export const u = 30;\n", "tool/types.ts": "export type T = string;\n", "data/other.json": "[20]\n", "out/table.generated.ts": "// table, written again\n" });
    expect(fp()).toBe(before);
  });

  it("names the files a run read that its inputs leave out, not the packages' manifests", () => {
    repo();
    const traced = ["tool/gen.ts", "tool/a.ts", "data/in/x.json", "data/other.json", "tool/unused.ts", "packages/lib/package.json", ""];
    expect(missingInputs(TABLE, traced, root)).toEqual(["data/other.json", "tool/unused.ts"]);
  });

  it("changes when an input file comes in under the data", () => {
    repo();
    const before = fp();
    write({ "data/in/y.json": "[]\n" });
    expect(fp()).not.toBe(before);
  });
});

describe("a table's fingerprint line", () => {
  const TEXT = "// Generated by tools/osm-import. Do not edit.\n// Second line.\nexport const T = [];\n";
  const FP = "0123456789abcdef0123456789abcdef01234567";

  it("goes after the generator's first line and comes out again", () => {
    const text = withFingerprint(TEXT, FP, "pnpm osm:build");
    expect(text.split("\n")[1]).toBe(`// Inputs: sha1 ${FP} (\`pnpm osm:build\`, ADR-0083).`);
    expect(fingerprintIn(text)).toBe(FP);
    expect(withoutFingerprint(text)).toBe(TEXT);
    expect(fingerprintIn(TEXT)).toBeNull();
  });

  it("passes with the inputs' fingerprint and fails with another one or none, naming the table and the command to run", () => {
    const text = withFingerprint(TEXT, FP, "pnpm osm:props");
    expect(staleTable("props.generated.ts", text, FP, "pnpm osm:props")).toBeNull();
    const other = staleTable("props.generated.ts", text, "f".repeat(40), "pnpm osm:props");
    expect(other).toContain("props.generated.ts was written from other inputs (sha1 0123456789ab, now ffffffffffff)");
    expect(other).toContain("run `pnpm osm:props`");
    expect(staleTable("props.generated.ts", TEXT, FP, "pnpm osm:props")).toContain("props.generated.ts has no fingerprint of its inputs: run `pnpm osm:props`");
  });
});

describe("importsOf", () => {
  it("reads the imports a module runs, not those of types or of comments", () => {
    const source = [
      'import { a, type B } from "./a.ts";',
      'import type { C } from "./c.ts";',
      'export type { D } from "./d.ts";',
      'export { e } from "./e.ts";',
      'export * from "./f.ts";',
      'import "./g.ts";',
      "import {",
      "  h,",
      '} from "./h.ts";',
      'const i = await import("./i.ts");',
      '/** `import x from "./j.ts"` */',
      '// import { k } from "./k.ts";',
    ].join("\n");
    expect(importsOf(source)).toEqual(["./a.ts", "./e.ts", "./f.ts", "./g.ts", "./h.ts", "./i.ts"]);
  });
});
