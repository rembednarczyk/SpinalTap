import { describe, expect, it } from "vitest";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import { puwgToWorld } from "../../gugik/src/frame.ts";
import { CHM_STEP, type Chm, NO_DATA, encodeChm } from "../../gugik/src/nmpt.ts";
import { COVER } from "../../orto/src/classify.ts";
import { type Cover, emptyCover } from "../../orto/src/cover.ts";
import type { Thresholds } from "../../orto/src/thresholds.ts";
import { CROWN_GROUP, crownReach, crownTreeItem, crownTrees } from "../src/crown-trees.ts";
import type { Pt } from "../src/geometry.ts";
import { worldToPuwg } from "../src/project.ts";
import { Site } from "../src/props-site.ts";

/** The rule of the crowns' trees (G-797) on a 100 x 60 m chunk: a lawn, a road along z = 30, houses north of z = 50, a car park and a wall. */

const RECT = { minX: 0, maxX: 100, minZ: 0, maxZ: 60 };
const chunk = (extra: Partial<LublinChunkData> = {}): LublinChunkData => ({
  id: "test-0-0",
  district: "kanal",
  bounds: RECT,
  terrain: { originX: 0, originZ: 0, cell: 50, cols: 3, rows: 2, heights: [0, 0, 0, 0, 0, 0] },
  buildings: [{ id: "w1", x: 50, z: 55, y: 0, outline: [-50, -5, 50, -5, 50, 5, -50, 5], parts: [], height: 12, plinth: 0, levels: 3, use: "residential", look: 1, source: "default" }],
  ground: [
    { surface: "grass", outline: [0, 0, 100, 0, 100, 27, 0, 27] },
    { surface: "road", outline: [0, 27, 100, 27, 100, 33, 0, 33] },
    { surface: "grass", outline: [0, 33, 100, 33, 100, 50, 0, 50] },
  ],
  streets: [{ name: "Testowa", kind: "residential", line: [0, 30, 100, 30] }],
  markings: [],
  pois: [],
  ...extra,
});

/** An extract over the chunk, each cell the height `at` its centre's world point gives. */
const chmOf = (at: (p: Pt) => number): Chm => {
  const corners = [
    { x: -5, z: -5 },
    { x: 105, z: -5 },
    { x: -5, z: 65 },
    { x: 105, z: 65 },
  ].map((p) => worldToPuwg(p));
  const e0 = Math.floor(Math.min(...corners.map((c) => c.e)));
  const e1 = Math.ceil(Math.max(...corners.map((c) => c.e)));
  const n1 = Math.ceil(Math.max(...corners.map((c) => c.n)));
  const n0 = Math.floor(Math.min(...corners.map((c) => c.n)));
  const [cols, rows] = [e1 - e0, n1 - n0];
  const cells = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells[r * cols + c] = encodeChm(at(puwgToWorld(e0 + c + 0.5, n1 - r - 0.5)));
  return { header: { source: "test", of: "test", crs: "EPSG:2180", e0, n0: n1, cols, rows, step: 1, scale: CHM_STEP, noData: NO_DATA }, cells };
};

/** The orthophoto's cover of the chunk, crown where `crown` says. */
const coverOf = (crown: (p: Pt) => boolean): Cover => {
  const c = emptyCover("test", RECT, {} as Thresholds);
  const h = c.header;
  for (let row = 0; row < h.height; row++)
    for (let col = 0; col < h.width; col++) {
      const p = { x: h.x0 + (col + 0.5) * h.step, z: h.z1 - (row + 0.5) * h.step };
      c.cls[row * h.width + col] = crown(p) ? COVER.canopy : COVER.green;
    }
  return c;
};

/** A crown of `top` m reaching `r` m round `at`, as a cone. */
const crown = (at: Pt, top: number, r: number) => (p: Pt) => Math.max(0, top - (top / r) * Math.hypot(p.x - at.x, p.z - at.z));
const highest =
  (...fs: ((p: Pt) => number)[]) =>
  (p: Pt) =>
    Math.max(0.2, ...fs.map((f) => f(p)));
const everywhere = coverOf(() => true);
const run = (chm: Chm, cover: Cover = everywhere, trees: { p: Pt; reach: number }[] = [], c = chunk()) => crownTrees([RECT], new Site([c]), [cover], [chm], trees);

describe("trees of the crowns (G-797)", () => {
  it("stands one tree under a crown, at its top, and none where the orthophoto shows no crown", () => {
    const chm = chmOf(highest(crown({ x: 20, z: 12 }, 12, 5)));
    const { trees } = run(chm);
    expect(trees).toHaveLength(1);
    expect(Math.hypot(trees[0]!.p.x - 20, trees[0]!.p.z - 12)).toBeLessThan(1.5);
    expect(trees[0]!.top).toBeGreaterThan(10);
    expect(run(chm, coverOf(() => false)).trees).toEqual([]);
  });

  it("leaves a crown with a tree of the game under it, and one lower than a tree (a hedge, a car)", () => {
    const chm = chmOf(highest(crown({ x: 20, z: 12 }, 12, 5)));
    expect(run(chm, everywhere, [{ p: { x: 22, z: 13 }, reach: 2 }]).trees).toEqual([]);
    expect(run(chmOf(highest(crown({ x: 20, z: 12 }, 3.5, 3))), everywhere).trees).toEqual([]);
  });

  it("stands two trees under two crowns further apart than their reach, one under two nearer", () => {
    expect(run(chmOf(highest(crown({ x: 20, z: 12 }, 12, 5), crown({ x: 34, z: 12 }, 10, 5)))).trees).toHaveLength(2);
    expect(crownReach(12)).toBeGreaterThan(4);
    const near = run(chmOf(highest(crown({ x: 20, z: 12 }, 12, 5), crown({ x: 23, z: 12 }, 10, 5)))).trees;
    expect(near).toHaveLength(1);
  });

  it("puts the trunks of a crown over the road at the road's edges, never on it, by the roofs nowhere", () => {
    // Its top over the road's axis: the highest of it off the road on either side, 7 m apart, as the rows of a street's trees.
    const { trees } = run(chmOf(highest(crown({ x: 50, z: 30 }, 12, 6))));
    expect(trees.map((t) => t.p.z).sort()).toEqual([26.5, 33.5]);
    // A crown against the houses' wall (z = 50) is read 2 m off it at the least, and its eaves stand no tree.
    expect(run(chmOf(highest(crown({ x: 70, z: 50.5 }, 9, 2)))).trees).toEqual([]);
  });

  it("keeps the trunks out of a car park and off a barrier's line", () => {
    const chm = chmOf(highest(crown({ x: 20, z: 12 }, 12, 5)));
    const park = chunk({ carParks: [{ id: "w9", kind: "surface", outline: [10, 2, 30, 2, 30, 22, 10, 22] }] });
    expect(run(chm, everywhere, [], park).trees).toEqual([]);
    const wall = chunk({ barriers: [{ id: "w8", kind: "wall", height: 2, line: [0, 12, 100, 12] }] });
    const by = run(chm, everywhere, [], wall).trees;
    expect(by.length).toBeGreaterThan(0);
    for (const t of by) expect(Math.abs(t.p.z - 12)).toBeGreaterThanOrEqual(1);
  });

  it("gives the plan a group of the trees keyed by their places", () => {
    const item = crownTreeItem([{ p: { x: 20.5, z: 12.5 }, top: 12 }]);
    expect(item).toMatchObject({ id: CROWN_GROUP, kind: "tree", points: [[20.5, 12.5]], osm: ["chm@20.5,12.5"], count: 1 });
  });
});
