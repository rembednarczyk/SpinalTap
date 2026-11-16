import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

/**
 * The files a test reaches by its imports, for the glitch scan's part (`scan-scope.ts`): relative
 * imports and the workspace's packages (`@seki/*` by their `exports`), static, dynamic and
 * type-only, read with a regular expression and no install (job "What changed" has no
 * `node_modules`). A comment that looks like an import adds a file: the scan then runs more often,
 * never less. Packages from `node_modules` and Node's own are left out.
 */

const IMPORT = /\b(?:import|export)\s[^;]*?\bfrom\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)|^\s*import\s*["']([^"']+)["']/gm;
const EXTS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

/** The workspace's packages: `@seki/sim/lublin` -> `packages/sim/src/content/lublin/index.ts` (absolute). */
export const workspaceExports = (root: string): Map<string, string> => {
  const out = new Map<string, string>();
  for (const top of ["packages", "tools"]) {
    for (const d of readdirSync(join(root, top), { withFileTypes: true })) {
      const file = join(root, top, d.name, "package.json");
      if (!d.isDirectory() || !existsSync(file)) continue;
      const pkg = JSON.parse(readFileSync(file, "utf8")) as { name?: string; exports?: string | Record<string, string> };
      if (!pkg.name) continue;
      const exports = typeof pkg.exports === "string" ? { ".": pkg.exports } : (pkg.exports ?? {});
      for (const [sub, target] of Object.entries(exports)) if (typeof target === "string") out.set(sub === "." ? pkg.name : `${pkg.name}/${sub.replace(/^\.\//, "")}`, join(root, top, d.name, target));
    }
  }
  return out;
};

const fileAt = (base: string): string | undefined => {
  for (const e of EXTS) {
    const f = `${base}${e}`;
    if (existsSync(f) && statSync(f).isFile()) return f;
  }
  const ts = base.replace(/\.js$/, ".ts");
  return ts !== base && existsSync(ts) ? ts : undefined;
};

/** Every file the entries reach by imports, as paths from the root with `/`. */
export const importClosure = (root: string, entries: readonly string[]): Set<string> => {
  const packages = workspaceExports(root);
  const seen = new Set<string>();
  const todo = entries.map((e) => join(root, e));
  while (todo.length > 0) {
    const file = todo.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const m of readFileSync(file, "utf8").matchAll(IMPORT)) {
      const spec = m[1] ?? m[2] ?? m[3]!;
      const target = spec.startsWith(".") ? fileAt(join(dirname(file), spec)) : packages.get(spec);
      if (target !== undefined && !seen.has(target)) todo.push(target);
    }
  }
  return new Set([...seen].map((f) => relative(root, f).split("\\").join("/")));
};

/** The glitch scan's test file. */
export const GLITCH_SCAN = "tools/glitch-scan/test/glitch-scan.test.ts";
