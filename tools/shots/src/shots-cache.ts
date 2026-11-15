/**
 * The cache of `shots:compare`: shots of a committed ref are kept under `<work>/cache/<key>`, so a
 * second round against the same main shoots only the change. The key is the commit, the hour and
 * a hash of what else decides the picture (the spots, the spec, `SHOT_MODELS`).
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

/** The newest entries kept by `pruneShotsCache`. */
export const SHOTS_CACHE_KEEP = 4;

/** The key of a ref's shots, or null when the ref is not a commit. */
export const shotsCacheKey = (root: string, ref: string, hour: number, inputs: readonly (string | Uint8Array)[]): string | null => {
  let sha: string;
  try {
    sha = execFileSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
  if (sha === "") return null;
  const h = createHash("sha1");
  for (const i of inputs) h.update(i).update("\0");
  return `${sha.slice(0, 12)}-h${hour}-${h.digest("hex").slice(0, 12)}`;
};

/** Removes all but the `keep` newest entries of the cache. */
export const pruneShotsCache = (dir: string, keep = SHOTS_CACHE_KEEP): void => {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir).map((d) => join(dir, d)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  for (const d of entries.slice(keep)) rmSync(d, { recursive: true, force: true });
};
