/**
 * The fingerprint of the map tables' inputs (ADR-0083 step 1): `pnpm osm:build` and `pnpm osm:props`
 * write the SHA-1 of every file they read into the header of each table they write, and the unit
 * test compares the fingerprint of the files as they are now with it, in milliseconds, instead of
 * generating the whole city again. CI's `tables` job still generates them and compares byte for
 * byte, and checks with `read-trace.ts` that every file the generators read is an input here.
 *
 * The inputs of a table, by an explicit list: the generator's entry modules with every module they
 * import (followed through the sources, `moduleClosure`), and the data it reads (`data`). The
 * tables it writes are no input of their own.
 *
 * The fingerprint in the header covers only the inputs the map owns (`OWNED`: the import's and the
 * orthophoto's tools, the content of `lublin`, the data). The rest of the closure (through the
 * barrels of `@seki/sim` and `@seki/engine`, about 800 modules) would make every change of the
 * simulation or the renderer ask for the tables again with the same bytes and a new header, and
 * conflict in every branch (15.11, PR #582). A change there that does shape the tables is caught
 * byte for byte by CI's "Map tables" job, which runs on every change of code.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
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
    entries: ["tools/osm-import/src/props.ts", "tools/osm-import/src/decal-walls.ts", "tools/osm-import/src/game-doors.ts", "tools/osm-import/src/crowd-clear.ts"],
    // The districts' tables come in as modules of the closure, with the fingerprint of their own inputs.
    data: ["data/osm", "data/terrain", "data/orto", "data/gugik", "docs/world/lublin-props.todo.json"],
  },
} as const satisfies Record<string, TableInputs>;

export type TableName = keyof typeof TABLES;

/** The modules of the closure the map owns, by their path's start: the header's fingerprint covers these and the data. */
export const OWNED = ["tools/osm-import/", "tools/orto/", "tools/gugik/", `${LUBLIN}/`] as const;

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

/** SHA-1 (hex) of the input files' paths and bytes, in their order. */
export const fingerprintOf = (files: readonly string[], root = REPO): string => {
  const h = createHash("sha1");
  for (const f of files) h.update(f).update("\0").update(readFileSync(join(root, f))).update("\0");
  return h.digest("hex");
};

/** The inputs the header's fingerprint covers: the data and the modules the map owns (`OWNED`). */
export const fingerprintFiles = (t: TableInputs, root = REPO): string[] => {
  const data = t.data;
  return inputFiles(t, root).filter((f) => OWNED.some((o) => f.startsWith(o)) || data.some((d) => f === d || f.startsWith(`${d}/`)));
};

export const tableFingerprint = (name: TableName, root = REPO): string => fingerprintOf(fingerprintFiles(TABLES[name], root), root);

const LINE = /^\/\/ Inputs: sha1 ([0-9a-f]{40}) \(`[^`]+`, ADR-0083\)\.$/m;

/** The table's text with the fingerprint line after its first line (the generator's). */
export const withFingerprint = (text: string, fingerprint: string, command: string): string => {
  const nl = text.indexOf("\n");
  return `${text.slice(0, nl + 1)}// Inputs: sha1 ${fingerprint} (\`${command}\`, ADR-0083).\n${text.slice(nl + 1)}`;
};

/** The fingerprint a table's text was written with; null with none. */
export const fingerprintIn = (text: string): string | null => LINE.exec(text)?.[1] ?? null;

/** The text without its fingerprint line: what the generator emits. */
export const withoutFingerprint = (text: string): string => text.replace(/^\/\/ Inputs: sha1 [0-9a-f]{40} .*\n/m, "");

/** Null when the table was written from the inputs as they are; else what is wrong and what to run. */
export const staleTable = (path: string, text: string, fingerprint: string, command: string): string | null => {
  const written = fingerprintIn(text);
  if (written === fingerprint) return null;
  const what = written === null ? "has no fingerprint of its inputs" : `was written from other inputs (sha1 ${written.slice(0, 12)}, now ${fingerprint.slice(0, 12)})`;
  return `${path} ${what}: run \`${command}\` and commit the tables it writes (ADR-0083; \`pnpm osm:build\` comes before \`pnpm osm:props\`, whose inputs are the districts' tables).`;
};
