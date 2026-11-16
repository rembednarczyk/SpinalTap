/**
 * The inputs of the map tables (ADR-0083): what `pnpm osm:build` and `pnpm osm:props` read, by an
 * explicit list: the generator's entry modules with every module they import (followed through the
 * sources, `moduleClosure`), and the data it reads (`data`). The tables it writes are no input of
 * their own.
 *
 * Whether the committed tables are those the inputs give is checked by generating them again:
 * CI's "Map tables" job (on every change of code, `tools/ci-scope`), `pnpm tables:check` and
 * `pnpm merge:main`. The tables carry no fingerprint of their inputs any more (decision of 16.11,
 * ADR-0083: the header line conflicted in 27 of 30 merges). The job checks with `read-trace.ts`
 * that every file the generators read is an input here and that a change of it runs the job.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { scope } from "../../ci-scope/src/scope.ts";
import { DISTRICTS } from "./config.ts";
import { REPO } from "./paths.ts";

export interface TableInputs {
  /** The command that writes the tables. */
  readonly command: string;
  /** The tables it writes, relative to the repository. */
  readonly outputs: readonly string[];
  /** The modules it runs: the script and the modules it loads by their paths (`runWith` in `props-build.ts`). */
  readonly entries: readonly string[];
  /** The data it reads, files or directories (every file under them). */
  readonly data: readonly string[];
}

const LUBLIN = "packages/sim/src/content/lublin";
/** The districts' tables, as `pnpm osm:build` writes them. */
export const DISTRICT_TABLES = DISTRICTS.map((d) => `${LUBLIN}/${d.slug}.generated.ts`);
export const PROPS_TABLE = `${LUBLIN}/props.generated.ts`;
/** The building sites' table (ADR-0087), written with the furniture's. */
export const SITES_TABLE = `${LUBLIN}/construction.generated.ts`;

export const TABLES = {
  build: {
    command: "pnpm osm:build",
    outputs: DISTRICT_TABLES,
    entries: ["tools/osm-import/src/build.ts"],
    data: ["data/osm", "data/terrain", "data/orto", "data/gugik"],
  },
  props: {
    command: "pnpm osm:props",
    outputs: [PROPS_TABLE, SITES_TABLE],
    entries: ["tools/osm-import/src/props.ts", "tools/osm-import/src/decal-walls.ts", "tools/osm-import/src/venue-boards.ts", "tools/osm-import/src/game-doors.ts", "tools/osm-import/src/crowd-clear.ts"],
    // The districts' tables come in as modules of the closure.
    data: ["data/osm", "data/terrain", "data/orto", "data/gugik", "docs/world/lublin-props.todo.json"],
  },
} as const satisfies Record<string, TableInputs>;

export type TableName = keyof typeof TABLES;

// `import … from "x"`, `export … from "x"`, `import "x"` and `import("x")`; not `import type` / `export type`, which leave nothing at run time.
const SPECIFIERS = /(?:^|[\s;}])(?:import|export)(?!\s+type[\s{])(?:[^"'`;]*?\sfrom)?\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;
const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts"];

/** The specifiers a module's source imports at run time. */
export const importsOf = (source: string): string[] => {
  // Comments may quote imports (`import x from "y"` in a doc comment).
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return [...code.matchAll(SPECIFIERS)].map((m) => (m[1] ?? m[2])!);
};

/** The workspace's packages (`@seki/core`, `@seki/sim/lublin`) by their `exports`, as modules of the repository. */
const workspaceExports = (root: string): Map<string, string> => {
  const out = new Map<string, string>();
  const dir = join(root, "packages");
  for (const p of existsSync(dir) ? readdirSync(dir) : []) {
    const file = join(dir, p, "package.json");
    if (!existsSync(file)) continue;
    const pkg = JSON.parse(readFileSync(file, "utf8")) as { name?: string; exports?: Record<string, string> };
    for (const [sub, target] of Object.entries(pkg.exports ?? {})) if (pkg.name) out.set(`${pkg.name}${sub.slice(1)}`, `packages/${p}/${target.replace(/^\.\//, "")}`);
  }
  return out;
};

/** A specifier of `from` as a file of the repository: relative, or a workspace package's; null for another package's (`vite`, `node:fs`) or none on disk. */
const resolveFrom = (root: string, from: string, spec: string, workspace: ReadonlyMap<string, string>): string | null => {
  const own = workspace.get(spec);
  if (own) return own;
  if (!spec.startsWith(".")) return null;
  const base = join(dirname(join(root, from)), spec);
  for (const ext of EXTENSIONS) {
    const f = base + ext;
    if (existsSync(f) && statSync(f).isFile()) return relative(root, f).split("\\").join("/");
  }
  return null;
};

/** The entry modules with every module of the repository they import, directly or not, sorted; not into `skip`. */
export const moduleClosure = (entries: readonly string[], root = REPO, skip: ReadonlySet<string> = new Set()): string[] => {
  const workspace = workspaceExports(root);
  const seen = new Set<string>(skip);
  const todo = [...entries];
  while (todo.length > 0) {
    const f = todo.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    if (!/\.tsx?$/.test(f)) continue;
    for (const spec of importsOf(readFileSync(join(root, f), "utf8"))) {
      const dep = resolveFrom(root, f, spec, workspace);
      if (dep && !seen.has(dep)) todo.push(dep);
    }
  }
  return [...seen].filter((f) => !skip.has(f)).sort();
};

const filesUnder = (root: string, path: string): string[] => {
  const full = join(root, path);
  if (!existsSync(full)) return [];
  if (!statSync(full).isDirectory()) return [path];
  return readdirSync(full, { recursive: true, encoding: "utf8" })
    .map((f) => `${path}/${f.split("\\").join("/")}`)
    .filter((f) => statSync(join(root, f)).isFile());
};

/** Every input file of a table, sorted: its modules and its data, not the tables it writes. */
export const inputFiles = (t: TableInputs, root = REPO): string[] => {
  // A table the generator imports (through the simulation) is the one it writes: not read, not followed.
  const out = new Set(t.outputs);
  return [...new Set([...moduleClosure(t.entries, root, out), ...t.data.flatMap((d) => filesUnder(root, d))])].filter((f) => !out.has(f)).sort();
};

/** Files a run reads that do not shape the tables: the packages' manifests the module runner looks up. */
const NOT_INPUTS = /(^|\/)package\.json$/;

/** The files of a run's trace (`read-trace.ts`) that no input of the table covers. */
export const missingInputs = (t: TableInputs, traced: readonly string[], root = REPO): string[] => {
  const inputs = new Set(inputFiles(t, root));
  return traced.filter((f) => f.length > 0 && !NOT_INPUTS.test(f) && !inputs.has(f));
};

/** The files of a run's trace a pull request could change without CI's "Map tables" job running (`tools/ci-scope`). */
export const unwatchedInputs = (traced: readonly string[]): string[] =>
  traced.filter((f) => f.length > 0 && !NOT_INPUTS.test(f)).filter((f) => {
    const s = scope([f], []);
    return !(s.tables || s.code);
  });
