import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { IGNORED_DIRS, WATCHED_DIRS } from "./config.ts";

/** A file's size and sha256. */
export interface FileSig {
  readonly bytes: number;
  readonly sha256: string;
}

/** Repo path (with `/`) to signature, sorted by path. */
export type FileTable = Readonly<Record<string, FileSig>>;

const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

/** The watched files under `root` (`config.ts`) and their signatures. */
export const fileTable = (root: string, dirs: readonly string[] = WATCHED_DIRS): FileTable => {
  const paths: string[] = [];
  for (const d of dirs) {
    if (!existsSync(join(root, d))) continue;
    for (const f of readdirSync(join(root, d), { recursive: true, encoding: "utf8" })) {
      const p = `${d}/${f.split("\\").join("/")}`;
      if (IGNORED_DIRS.some((i) => p === i || p.startsWith(`${i}/`))) continue;
      if (statSync(join(root, p)).isFile()) paths.push(p);
    }
  }
  paths.sort();
  return Object.fromEntries(paths.map((p) => [p, { bytes: statSync(join(root, p)).size, sha256: sha256(readFileSync(join(root, p))) }]));
};

/** The manifests whose `fetched` dates change with every download of the same files. */
export const DATED_MANIFESTS = ["data/gugik/sources.json", "data/orto/sources.json"] as const;

const undated = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(undated);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => k !== "fetched").map(([k, x]) => [k, undated(x)]));
  return v;
};

/**
 * A manifest that differs from `before` only in its download dates gets its old text back: the
 * same files fetched again are no change of the map (and no pull request a week). Returns the
 * paths given back.
 */
export const restoreDateOnly = (root: string, before: ReadonlyMap<string, string>): string[] => {
  const back: string[] = [];
  for (const [p, old] of before) {
    const file = join(root, p);
    if (!existsSync(file)) continue;
    const now = readFileSync(file, "utf8");
    if (now === old) continue;
    try {
      if (JSON.stringify(undated(JSON.parse(now))) !== JSON.stringify(undated(JSON.parse(old)))) continue;
    } catch {
      continue;
    }
    writeFileSync(file, old);
    back.push(p);
  }
  return back;
};

/** The manifests' texts before a refresh, for `restoreDateOnly`. */
export const readManifests = (root: string, paths: readonly string[] = DATED_MANIFESTS): Map<string, string> =>
  new Map(paths.filter((p) => existsSync(join(root, p))).map((p) => [p, readFileSync(join(root, p), "utf8")]));
