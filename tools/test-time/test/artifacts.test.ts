import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runs, shards } from "../src/artifacts.ts";
import { gateTests } from "../src/gate.ts";
import { mergeTests, mergeTimes, type TimesFile } from "../src/times.ts";

/**
 * The times in the layout `ci.yml` downloads them (job Unit test time): three unit shards since
 * 20.11, two before. The first runs of main after the change still have two shards.
 */

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A shard's file: its tests of 3 s each, `k` times slower. */
const shard = (file: string, k = 1): TimesFile => ({
  files: { [file]: { ms: 12 * 3000 * k, importMs: 0 } },
  tests: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`${file} > t ${i}`, { ms: 3000 * k, limitMs: 20_000 }])),
});

const write = (path: string, times: TimesFile): void => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(times));
};

const FILES = ["a.test.ts", "b.test.ts", "c.test.ts"];

describe("the unit shards' times as CI downloads them (G-376)", () => {
  it("reads three shards of the pull request and runs of main with three or two shards", () => {
    const root = mkdtempSync(join(tmpdir(), "test-time-artifacts-"));
    dirs.push(root);
    // The pull request: `download-artifact` with `merge-multiple`, one flat file a shard.
    FILES.forEach((f, i) => write(join(root, "head", `unit-times-${i + 1}.json`), shard(f, i === 2 ? 2 : 1)));
    // Main: `gh run download --pattern 'unit-times-*'`, a directory a run, an artifact's directory a shard.
    FILES.forEach((f, i) => write(join(root, "main", "1", `unit-times-${i + 1}`, `unit-times-${i + 1}.json`), shard(f)));
    for (const run of ["2", "3"]) {
      write(join(root, "main", run, "unit-times-1", "unit-times-1.json"), shard(FILES[0]!));
      write(join(root, "main", run, "unit-times-2", "unit-times-2.json"), { files: { ...shard(FILES[1]!).files, ...shard(FILES[2]!).files }, tests: { ...shard(FILES[1]!).tests, ...shard(FILES[2]!).tests } });
    }
    // A run whose download failed leaves nothing (ci.yml removes its directory; an empty one is no run).
    mkdirSync(join(root, "main", "4"));

    const head = shards(join(root, "head"));
    const main = runs(join(root, "main"));
    expect(head).toHaveLength(3);
    expect(main.map((r) => r.length)).toEqual([3, 2, 2]);
    // Every run of main has every file and test, however many shards ran them.
    for (const r of main) {
      expect(Object.keys(mergeTimes(r)).sort()).toEqual(FILES);
      expect(Object.keys(mergeTests(r))).toHaveLength(36);
    }
    // The gate takes a pace a shard of the pull request: the third ran on a runner twice as slow.
    const g = gateTests(mergeTests(head), main.map(mergeTests), [], head.map((f) => mergeTests([f])));
    expect(g.runs).toBe(3);
    expect(g.compared).toBe(36);
    expect(g.paces).toEqual([1, 1, 2]);
    expect(g.breaches).toEqual([]);
  });

  it("takes a single run's shards in the directory itself, and nothing from a missing one", () => {
    const root = mkdtempSync(join(tmpdir(), "test-time-artifacts-"));
    dirs.push(root);
    FILES.forEach((f, i) => write(join(root, `unit-times-${i + 1}.json`), shard(f)));
    expect(runs(root).map((r) => r.length)).toEqual([3]);
    expect(runs(join(root, "none"))).toEqual([]);
    expect(runs(undefined)).toEqual([]);
    expect(shards(join(root, "none"))).toEqual([]);
  });
});
