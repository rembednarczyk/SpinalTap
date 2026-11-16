/**
 * `node --import ./tools/osm-import/src/read-trace.ts <script>`: records every file of the repository
 * the script reads, as modules or as data, and writes the list (relative paths, sorted) to
 * `$READ_TRACE` at exit. The `tables` job of CI checks with it that the tables' fingerprints
 * (`fingerprint.ts`) cover every input of `pnpm osm:build` and `pnpm osm:props`.
 */
import fs from "node:fs";
import { registerHooks, syncBuiltinESMExports } from "node:module";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { REPO } from "./paths.ts";

const read = new Set<string>();
const note = (p: unknown): void => {
  const path = p instanceof URL ? fileURLToPath(p) : typeof p === "string" ? p : null;
  if (path === null) return;
  const rel = relative(REPO, path.startsWith("file:") ? fileURLToPath(path) : path).split("\\").join("/");
  if (!rel.startsWith("..") && !rel.startsWith("node_modules/") && !rel.includes("/node_modules/")) read.add(rel);
};

type AnyFn = (...args: never[]) => unknown;
const wrap = <T extends object>(target: T, names: readonly string[]): void => {
  for (const name of names) {
    const own = (target as Record<string, AnyFn>)[name];
    if (typeof own !== "function") continue;
    (target as Record<string, AnyFn>)[name] = function (this: unknown, ...args: never[]) {
      note(args[0]);
      return Reflect.apply(own, this, args);
    } as AnyFn;
  }
};
wrap(fs, ["readFileSync", "readFile", "openSync", "open", "createReadStream", "readdirSync", "readdir"]);
wrap(fs.promises, ["readFile", "open", "readdir"]);
syncBuiltinESMExports();
registerHooks({
  load(url, context, next) {
    if (url.startsWith("file:")) note(url);
    return next(url, context);
  },
});

process.on("exit", () => {
  const out = process.env.READ_TRACE;
  // Files only: a directory listed is read through the files under it.
  const files = [...read].filter((f) => fs.statSync(join(REPO, f), { throwIfNoEntry: false })?.isFile() === true);
  if (out) fs.writeFileSync(out, `${files.sort().join("\n")}\n`);
});
