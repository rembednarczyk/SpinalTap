import { mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { pruneShotsCache, shotsCacheKey } from "../src/shots-cache";

const root = process.cwd();
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("shots:compare cache", () => {
  it("keys a commit by its sha, the hour and the inputs", () => {
    const a = shotsCacheKey(root, "HEAD", 13, ["spots", "spec", "on"]);
    expect(a).toMatch(/^[0-9a-f]{12}-h13-[0-9a-f]{12}$/);
    expect(shotsCacheKey(root, "HEAD", 13, ["spots", "spec", "on"])).toBe(a);
    expect(shotsCacheKey(root, "HEAD", 22, ["spots", "spec", "on"])).not.toBe(a);
    expect(shotsCacheKey(root, "HEAD", 13, ["other spots", "spec", "on"])).not.toBe(a);
    expect(shotsCacheKey(root, "HEAD", 13, ["spots", "spec", ""])).not.toBe(a);
  });

  it("has no key for a ref that is not a commit", () => {
    expect(shotsCacheKey(root, "no-such-ref-xyz", 13, [])).toBeNull();
  });

  it("keeps only the newest entries", () => {
    const dir = mkdtempSync(join(tmpdir(), "shots-cache-"));
    dirs.push(dir);
    for (let i = 0; i < 6; i++) {
      const d = join(dir, `e${i}`);
      mkdirSync(d);
      utimesSync(d, 1000 + i, 1000 + i);
    }
    pruneShotsCache(dir, 4);
    expect(readdirSync(dir).sort()).toEqual(["e2", "e3", "e4", "e5"]);
  });
});
