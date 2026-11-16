import { describe, expect, it } from "vitest";
import { COVER } from "../src/classify.ts";
import { type Cover, emptyCover } from "../src/cover.ts";
import { deckDiff, surfaceDiff, terrainDiff } from "../src/diff-map.ts";
import { type Grid2, type MapSnapshot, type SnapChunk, type SnapDeck } from "../src/diff-snapshot.ts";
import { THRESHOLDS } from "../src/thresholds.ts";

const ALL = { minX: -Infinity, minZ: -Infinity, maxX: Infinity, maxZ: Infinity };
const sq = (x0: number, z0: number, x1: number, z1: number) => [
  { x: x0, z: z0 },
  { x: x1, z: z0 },
  { x: x1, z: z1 },
  { x: x0, z: z1 },
];
const grid = (heights: number[]): Grid2 => ({ originX: 0, originZ: 0, cell: 5, cols: 3, rows: 3, heights });
const chunk = (over: Partial<SnapChunk>): SnapChunk => ({ id: "t-0-0", bounds: { minX: 0, minZ: 0, maxX: 10, maxZ: 10 }, ground: [], buildings: [], nmt: grid(Array(9).fill(1)), shaped: grid(Array(9).fill(1)), ...over });
const snap = (chunks: SnapChunk[], decks: SnapDeck[] = []): MapSnapshot => ({ ref: "x", sha: "0", chunks, decks });

/** A 10 × 10 m raster at 0.5 m: west half green, east half asphalt. */
const cover = (): Cover => {
  const c = emptyCover("t", { minX: 0, minZ: 0, maxX: 10, maxZ: 10 }, THRESHOLDS);
  for (let k = 0; k < c.cls.length; k++) c.cls[k] = k % c.header.width < 10 ? COVER.green : COVER.asphalt;
  return c;
};

describe("orto:diff's numbers", () => {
  it("counts the paving added and removed on the cover's classes, by surface and cell", () => {
    const a = snap([chunk({ ground: [{ surface: "grass", ring: sq(0, 0, 10, 10) }] })]);
    // B paves 4 × 10 m across the middle (2 m on the green, 2 m on the asphalt) and puts a 2 × 2 m building on the grass.
    const b = snap([chunk({ ground: [{ surface: "grass", ring: sq(0, 0, 10, 10) }, { surface: "asphalt", ring: sq(3, 0, 7, 10) }], buildings: [sq(0, 0, 2, 2)] })]);
    const d = surfaceDiff([cover()], a, b, ALL, [{ id: "t-0-0", rect: { minX: 0, minZ: 0, maxX: 10, maxZ: 10 } }]);
    expect(d.changedM2).toBe(44);
    expect(d.bySurface.asphalt!.added).toMatchObject({ green: 20, asphalt: 20 });
    expect(d.bySurface.grass!.removed).toMatchObject({ green: 24, asphalt: 20 });
    expect(d.bySurface.building!.added.green).toBe(4);
    expect(Object.keys(d.byCell)).toEqual(["t-0-0"]);
    // A box keeps only what lies in it.
    expect(surfaceDiff([cover()], a, b, { minX: 5, minZ: 0, maxX: 10, maxZ: 10 }, []).bySurface.asphalt!.added).toMatchObject({ green: 0, asphalt: 20 });
    expect(surfaceDiff([cover()], a, a, ALL, []).changedM2).toBe(0);
  });

  it("measures the terrain points moved, against the NMT", () => {
    const a = snap([chunk({})]);
    const b = snap([chunk({ shaped: grid([1, 1, 1, 1, 0.4, 1, 1, 1, 2.5]) })]);
    const t = terrainDiff(a, b, ALL);
    expect(t.total).toMatchObject({ points: 2, m2: 50, maxAbs: 1.5, medianAbs: 1.05, maxUp: 1.5, maxDown: 0.6 });
    expect(t.total.offNmtBefore).toEqual({ median: 0, max: 0 });
    expect(t.total.offNmtAfter).toEqual({ median: 1.05, max: 1.5 });
    expect(t.largest[0]).toMatchObject({ x: 10, z: 10, before: 1, after: 2.5 });
    expect(terrainDiff(a, b, { minX: -1, minZ: -1, maxX: 6, maxZ: 6 }).total.points).toBe(1);
    // A finer grid in B: A's surface under each of its points.
    const fine: Grid2 = { originX: 0, originZ: 0, cell: 2.5, cols: 5, rows: 5, heights: Array(25).fill(1) };
    expect(terrainDiff(a, snap([chunk({ shaped: fine })]), ALL).total.points).toBe(0);
  });

  it("matches the decks by their outline and reports their ends and heights", () => {
    const deck = (ax: number, ya: number, box = { minX: 0, minZ: -2, maxX: 40, maxZ: 2 }): SnapDeck => ({ a: { x: ax, z: 0 }, b: { x: 40, z: 0 }, ya, yb: 2, box, flight: false, area: 160 });
    const a = snap([], [deck(0, 1), deck(0, 1, { minX: 100, minZ: 0, maxX: 110, maxZ: 5 })]);
    const b = snap([], [deck(3, 1.2), deck(0, 1, { minX: 200, minZ: 0, maxX: 210, maxZ: 5 })]);
    const d = deckDiff(a, b, ALL);
    expect(d.changed).toHaveLength(1);
    expect(d.changed[0]).toMatchObject({ moveA: 3, moveB: 0, dya: 0.2, dyb: 0 });
    expect(d.added.map((x) => x.box.minX)).toEqual([200]);
    expect(d.removed.map((x) => x.box.minX)).toEqual([100]);
    expect(deckDiff(a, a, ALL)).toMatchObject({ changed: [], added: [], removed: [], unchanged: 2 });
  });
});
