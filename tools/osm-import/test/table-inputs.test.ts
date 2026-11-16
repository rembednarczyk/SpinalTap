import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DOCS } from "../../ci-scope/src/scope.ts";
import { REPO } from "../src/paths.ts";
import { TABLES, type TableInputs, type TableName, importsOf, inputFiles, missingInputs, moduleClosure, unwatchedInputs } from "../src/table-inputs.ts";

const NAMES = Object.keys(TABLES) as TableName[];

describe("the map tables' inputs (ADR-0083)", () => {
  // The freshness of the tables themselves: CI's "Map tables" job and `pnpm tables:check` generate them again.
  it.each(NAMES)("%s: a change of any input but docs runs the Map tables job", (name) => {
    const inputs = inputFiles(TABLES[name]);
    expect(inputs.length).toBeGreaterThan(100);
    expect(unwatchedInputs(inputs.filter((f) => !DOCS.test(f)))).toEqual([]);
    // Docs next to the data are not read (CI checks the files actually read: `tables:check --trace`).
    expect(unwatchedInputs(["data/osm/ATTRIBUTION.md"])).toEqual(["data/osm/ATTRIBUTION.md"]);
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
    const modules = moduleClosure(t.entries).filter((f) => f !== "tools/osm-import/src/table-inputs.ts");
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
});

describe("inputFiles over a repository", () => {
  let root = "";
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const write = (files: Record<string, string>) => {
    for (const [f, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, f)), { recursive: true });
      writeFileSync(join(root, f), text);
    }
  };
  const TABLE: TableInputs = { command: "pnpm gen", outputs: ["out/table.generated.ts"], entries: ["tool/gen.ts"], data: ["data/in"] };
  const files = () => inputFiles(TABLE, root);

  const repo = () => {
    root = mkdtempSync(join(tmpdir(), "seki-table-inputs-"));
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

  it("takes every module the generator runs, directly, by an extensionless path or from a package, and its data", () => {
    repo();
    expect(files()).toEqual(["data/in/x.json", "packages/lib/src/index.ts", "tool/a.ts", "tool/b.ts", "tool/gen.ts"]);
  });

  it("leaves out what the generator does not read: a module no one imports, a type-only import, other data, its own table", () => {
    repo();
    for (const f of ["tool/unused.ts", "tool/types.ts", "data/other.json", "out/table.generated.ts"]) expect(files()).not.toContain(f);
  });

  it("names the files a run read that its inputs leave out, not the packages' manifests", () => {
    repo();
    const traced = ["tool/gen.ts", "tool/a.ts", "data/in/x.json", "data/other.json", "tool/unused.ts", "packages/lib/package.json", ""];
    expect(missingInputs(TABLE, traced, root)).toEqual(["data/other.json", "tool/unused.ts"]);
  });

  it("takes a file that comes in under the data", () => {
    repo();
    write({ "data/in/y.json": "[]\n" });
    expect(files()).toContain("data/in/y.json");
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
