import { describe, expect, it } from "vitest";
import { GroundField, WORLD_CHUNKS, WORLD_METRO } from "../src";
import type { Rect } from "../src/content/builders";
import { ChunkIndex } from "../src/world/chunk-index";

/** The lookup as it was, asking every chunk (G-391): the first holding the point, else the nearest, the first among equals, shafts left out. */
const slowAt = (bounds: readonly Rect[], cuts: number, bucketed: boolean, x: number, z: number): number => {
  if (bucketed) for (let i = 0; i < bounds.length; i++) if (inside(bounds[i]!, x, z)) return i;
  let best = -1;
  let bestD = Infinity;
  for (let i = cuts; i < bounds.length; i++) {
    const r = bounds[i]!;
    const d = Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
};
const inside = (r: Rect, x: number, z: number): boolean => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;

/** A fixed sequence in [0, 1): the same points every run. */
const sequence = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 2 ** 32;
};

const here = WORLD_METRO.flatMap((s) => s.entrances.filter((e) => WORLD_CHUNKS.some((c) => c.id === e.chunk)));
const cuts = here.map((e) => e.cut);
const cityBounds: Rect[] = [...cuts.map((c) => c.bounds), ...WORLD_CHUNKS.map((c) => c.bounds)];
const box = {
  minX: Math.min(...cityBounds.map((b) => b.minX)),
  maxX: Math.max(...cityBounds.map((b) => b.maxX)),
  minZ: Math.min(...cityBounds.map((b) => b.minZ)),
  maxZ: Math.max(...cityBounds.map((b) => b.maxZ)),
};

/** Points along long rays from in and off the map, a metre apart, as `rayHit` steps them, up to 3 km off every side. */
const rayPoints = (seed: number, rays: number): [number, number][] => {
  const r = sequence(seed);
  const pad = 3000;
  const at = (): [number, number] => [box.minX - pad + r() * (box.maxX - box.minX + 2 * pad), box.minZ - pad + r() * (box.maxZ - box.minZ + 2 * pad)];
  const out: [number, number][] = [];
  for (let k = 0; k < rays; k++) {
    const [ox, oz] = at();
    const [tx, tz] = at();
    const len = Math.hypot(tx - ox, tz - oz);
    for (let t = 0; t < Math.min(len, 2500); t += 1) out.push([ox + ((tx - ox) / len) * t, oz + ((tz - oz) / len) * t]);
  }
  return out;
};

describe("the chunk whose ground is used at a point (G-391)", () => {
  it("is the one asking every chunk gives, in the city and kilometres off it, along long rays", () => {
    const index = new ChunkIndex(cityBounds, cuts.length, true);
    let off = 0;
    for (const seed of [1, 391, 2026]) {
      for (const [x, z] of rayPoints(seed, 40)) {
        const want = slowAt(cityBounds, cuts.length, true, x, z);
        if (index.at(x, z) !== want) expect([x, z, index.at(x, z)]).toEqual([x, z, want]);
        if (!cityBounds.some((b) => inside(b, x, z))) off++;
      }
    }
    // Most of them outside every chunk, where the nearest one is looked for.
    expect(off).toBeGreaterThan(50_000);
  });

  it("and so is the ground's: its grid, its shaft and its height at those points", () => {
    const field = new GroundField(WORLD_CHUNKS, cuts, here.flatMap((e) => e.platform?.vaults ?? []));
    for (const [x, z] of rayPoints(7, 15)) {
      const want = slowAt(cityBounds, cuts.length, true, x, z);
      expect(field.shaftAt(x, z)).toBe(want < cuts.length ? want : -1);
      if (want >= cuts.length) expect(field.gridAt(x, z)).toBe(WORLD_CHUNKS[want - cuts.length]!.terrain ?? null);
    }
  });

  it("is the first of equally near chunks, on the seams of the cells and at their corners, a shaft never standing in", () => {
    // Four equal chunks round a cross of gaps, and a shaft in the middle of it: on the cross's
    // axes two or four are equally near.
    const bounds: Rect[] = [
      { minX: -3, maxX: 3, minZ: -3, maxZ: 3 },
      { minX: -200, maxX: -10, minZ: -200, maxZ: -10 },
      { minX: 10, maxX: 200, minZ: -200, maxZ: -10 },
      { minX: -200, maxX: -10, minZ: 10, maxZ: 200 },
      { minX: 10, maxX: 200, minZ: 10, maxZ: 200 },
    ];
    for (const bucketed of [true, false]) {
      const index = new ChunkIndex(bounds, 1, bucketed);
      const r = sequence(5);
      const points: [number, number][] = [];
      for (let k = -40; k <= 40; k++) points.push([0, k * 37], [k * 37, 0], [k * 64 - 200, k * 64 - 200], [k * 64 - 200, 0], [k * 101, -k * 101]);
      for (let k = 0; k < 4000; k++) points.push([(r() - 0.5) * 3000, (r() - 0.5) * 3000]);
      for (const [x, z] of points) expect([x, z, index.at(x, z)]).toEqual([x, z, slowAt(bounds, 1, bucketed, x, z)]);
    }
  });

  it("is none without chunks, and the old answer far beyond the cells and at points that are not points", () => {
    expect(new ChunkIndex([], 0, true).at(5, 5)).toBe(-1);
    const index = new ChunkIndex(cityBounds, cuts.length, true);
    for (const [x, z] of [
      [1e9, -3e8],
      [-1e12, 0],
      [Infinity, 0],
      [0, -Infinity],
      [NaN, 10],
    ] as const) {
      expect(index.at(x, z)).toBe(slowAt(cityBounds, cuts.length, true, x, z));
    }
  });
});
