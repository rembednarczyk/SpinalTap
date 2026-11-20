import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { TimesFile } from "./times.ts";

/**
 * The times as `ci.yml` downloads them, for any number of unit shards (G-376: two, three since
 * 20.11). A run's directory holds one `*.json` a shard, flat (`merge-multiple`, the pull request)
 * or each in its artifact's directory (`gh run download --pattern`, a run of main); every `*.json`
 * under it is one shard, so runs of main with two shards and with three compare alike.
 */

const jsonFiles = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { recursive: true, encoding: "utf8" })
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => join(dir, f))
    : [];

/** The shards of one run: every `*.json` under `dir`, at any depth. */
export const shards = (dir: string): TimesFile[] => jsonFiles(dir).map((f) => JSON.parse(readFileSync(f, "utf8")) as TimesFile);

/** The runs of main, newest first: one a subdirectory (`1`, `2`, ...), or the directory itself as one run. */
export const runs = (dir: string | undefined): TimesFile[][] => {
  if (!dir || !existsSync(dir)) return [];
  const subs = readdirSync(dir)
    .filter((d) => statSync(join(dir, d)).isDirectory())
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const out = subs.length > 0 ? subs.map((d) => shards(join(dir, d))) : [shards(dir)];
  return out.filter((r) => r.length > 0);
};
