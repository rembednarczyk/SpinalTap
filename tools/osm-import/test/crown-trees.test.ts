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
import type { Structure } from "../src/structures.ts";
import { CLEARED_BUILDINGS } from "../../../packages/sim/src/content/lublin/sites.ts";
import { CROWN_CLEARED, W3_CROWN_OFF } from "../src/crown-grid.ts";
import { KeepOut, PORTICO_OFF } from "../src/crown-ground.ts";
import { PORTICOES } from "../../../packages/sim/src/content/lublin/porticoes.ts";

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
const run = (chm: Chm, cover: Cover = everywhere, trees: { p: Pt; reach: number }[] = [], c = chunk(), structures: Structure[] = []) => crownTrees([RECT], new Site([c]), [cover], [chm], trees, structures);

describe("trees of the crowns (G-797)", () => {
  it("stands one tree under a crown, at its top, and none where neither the orthophoto nor its height shows a crown", () => {
    const chm = chmOf(highest(crown({ x: 20, z: 12 }, 12, 5)));
    const { trees } = run(chm);
    expect(trees).toHaveLength(1);
    expect(Math.hypot(trees[0]!.p.x - 20, trees[0]!.p.z - 12)).toBeLessThan(1.5);
    expect(trees[0]!.top).toBeGreaterThan(10);
    // Where the orthophoto shows no crown, a crown 8 m tall all round its top stands a tree all the
    // same (T-354: a crown over a lawn the cover reads as the lawn), a lower one none.
    expect(run(chm, coverOf(() => false)).trees).toHaveLength(1);
    expect(run(chmOf(highest(crown({ x: 20, z: 12 }, 7.5, 5))), coverOf(() => false)).trees).toEqual([]);
    // A district without its extracts (no surface model, no cover) stands none.
    expect(crownTrees([RECT], new Site([chunk()]), [everywhere], [], []).trees).toEqual([]);
    expect(crownTrees([RECT], new Site([chunk()]), [], [chm], []).trees).toEqual([]);
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

  it("puts the trunk of a crown over the road at the road's edge, never on it, by the roofs nowhere", () => {
    // Its top over the road's axis: the trunk at the highest of it off the road, within the crown's reach.
    const { trees } = run(chmOf(highest(crown({ x: 50, z: 30 }, 12, 6))));
    expect(trees).toHaveLength(1);
    expect([26.5, 33.5]).toContain(trees[0]!.p.z);
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

  it("stands no tree on a building site, a market, a canopy or a building of the map the game does not draw (G-815 P2, P3)", () => {
    const chm = chmOf(highest(crown({ x: 20, z: 12 }, 12, 5)));
    const ring = [
      { x: 10, z: 2 },
      { x: 30, z: 2 },
      { x: 30, z: 22 },
      { x: 10, z: 22 },
    ];
    for (const kind of ["construction", "marketplace", "canopy", "building"] as const)
      expect(run(chm, everywhere, [], chunk(), [{ id: "w5", kind, ring, holes: [], box: { minX: 10, maxX: 30, minZ: 2, maxZ: 22 } }]).trees, kind).toEqual([]);
    // In a courtyard of a building, a hole of its multipolygon, the tree stands.
    expect(run(chm, everywhere, [], chunk(), [{ id: "r5", kind: "building", ring: [{ x: 0, z: 0 }, { x: 40, z: 0 }, { x: 40, z: 24 }, { x: 0, z: 24 }], holes: [ring], box: { minX: 0, maxX: 40, minZ: 0, maxZ: 24 } }]).trees).toHaveLength(1);
  });

  it("keeps the trunks 2 m off a bridge's deck, whose height the surface model reads as a crown (G-815 P4)", () => {
    const chm = chmOf(highest(crown({ x: 20, z: 12 }, 12, 5)));
    const deck = chunk({ ground: [...chunk().ground, { surface: "footway", bridge: true, outline: [0, 13, 100, 13, 100, 16, 0, 16] }] });
    const trees = run(chm, everywhere, [], deck).trees;
    expect(trees.length).toBeGreaterThan(0);
    for (const t of trees) expect(13 - t.p.z).toBeGreaterThanOrEqual(2);
  });

  it("clears the game's set pieces as the simulation does (G-815 P5)", () => {
    // W-3's (all but the car wash's, the last) grown by W3_CROWN_OFF (ADR-0082, review round 2).
    const grown = (r: (typeof CLEARED_BUILDINGS)[number], d: number) => ({ minX: r.minX - d, maxX: r.maxX + d, minZ: r.minZ - d, maxZ: r.maxZ + d });
    const want = [...CLEARED_BUILDINGS.slice(0, -1).map((r) => grown(r, W3_CROWN_OFF)), CLEARED_BUILDINGS.at(-1)!];
    expect(CROWN_CLEARED).toHaveLength(want.length);
    CROWN_CLEARED.forEach((r, i) => (["minX", "maxX", "minZ", "maxZ"] as const).forEach((k) => expect(r[k]).toBeCloseTo(want[i]![k], 6)));
  });

  it("keeps the trunks off a portico's columns, under the balcony the surface model reads as a crown (G-814)", () => {
    const keep = new KeepOut(new Site([chunk()]));
    const [a, b] = [PORTICOES[0]!.columns[0]!, PORTICOES[0]!.columns[1]!];
    // Nowy Ratusz: a crown's tree stood 0.8 m before the second column once the walls only narrowed its crown.
    expect(keep.near({ x: 413.5, z: -87.5 })).toBe(true);
    expect(keep.near({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 - PORTICO_OFF + 0.1 })).toBe(true);
    expect(keep.near({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 - PORTICO_OFF - 0.5 })).toBe(false);
  });

  it("takes no crown's top beside a higher surface: a moss-grown edge of a shed OSM lacks (G-815 P1)", () => {
    // A shed 6 m high, x 60..70, z 10..20, not in the map; its east edge green on the orthophoto, 5.5 m.
    const chm = chmOf((p) => (p.z >= 10 && p.z < 20 ? (p.x >= 60 && p.x < 70 ? 6 : p.x >= 70 && p.x < 72 ? 5.5 : 0.2) : 0.2));
    expect(run(chm, coverOf((p) => p.x >= 70 && p.x < 72 && p.z >= 10 && p.z < 20)).trees).toEqual([]);
  });

  it("stands no tree on an eave the surface model joins to the roof with little crown on the orthophoto, one where the crown is whole (G-815 P1)", () => {
    // The houses' roof (outline from z = 50) reaches 4 m past the outline at 10 m, as the surface model reads it.
    const chm = chmOf((p) => (p.z >= 46 && p.x >= 40 && p.x < 50 ? 10 : 0.2));
    // Moss or copper on the overhang alone: no tree.
    expect(run(chm, coverOf((p) => p.z >= 45 && p.z < 48 && p.x >= 40 && p.x < 50)).trees).toEqual([]);
    // A crown over the wall, the orthophoto green all round: a tree under it, off the roof.
    const whole = run(chm, everywhere).trees;
    expect(whole).toHaveLength(1);
    expect(whole[0]!.p.z).toBeLessThan(48);
  });

  it("gives the plan a group of the trees keyed by their places", () => {
    const item = crownTreeItem([{ p: { x: 20.5, z: 12.5 }, top: 12 }]);
    expect(item).toMatchObject({ id: CROWN_GROUP, kind: "tree", points: [[20.5, 12.5]], osm: ["chm@20.5,12.5"], count: 1 });
  });
});
