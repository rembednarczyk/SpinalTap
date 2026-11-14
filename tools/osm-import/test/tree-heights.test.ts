import { describe, expect, it } from "vitest";
import { TREE_CROWN, TREE_SCALE, treeHeight, treeScale } from "../../../packages/core/src/world/trees.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import { puwgToWorld } from "../../gugik/src/frame.ts";
import { CHM_STEP, type Chm, NO_DATA, encodeChm } from "../../gugik/src/nmpt.ts";
import type { Pt } from "../src/geometry.ts";
import { worldToPuwg } from "../src/project.ts";
import { Site } from "../src/props-site.ts";
import { TREE_RANGE, measureTree, osmTreeHeight, treeVariant, withTreeHeights } from "../src/tree-heights.ts";

/** A 100 x 60 m flat chunk with a row of houses whose south wall runs along z = 38. */
const site = new Site([
  {
    id: "test-0-0",
    district: "kanal",
    bounds: { minX: 0, maxX: 100, minZ: 0, maxZ: 60 },
    terrain: { originX: 0, originZ: 0, cell: 50, cols: 3, rows: 2, heights: [0, 0, 0, 0, 0, 0] },
    buildings: [{ id: "w1", x: 50, z: 45, y: 0, outline: [-50, -7, 50, -7, 50, 7, -50, 7], parts: [], height: 12, plinth: 0, levels: 3, use: "residential", look: 1, source: "default" }],
    ground: [],
    streets: [],
    markings: [],
    pois: [],
  } satisfies LublinChunkData,
]);

/** An extract over the chunk (its PUWG box), each cell the height `at` its centre's world point gives (NaN: no data). */
const chmOf = (at: (p: Pt) => number): Chm => {
  const corners = [
    { x: -5, z: -5 },
    { x: 105, z: -5 },
    { x: -5, z: 65 },
    { x: 105, z: 65 },
  ].map((p) => worldToPuwg(p));
  const e0 = Math.floor(Math.min(...corners.map((c) => c.e)));
  const e1 = Math.ceil(Math.max(...corners.map((c) => c.e)));
  const n0 = Math.floor(Math.min(...corners.map((c) => c.n)));
  const n1 = Math.ceil(Math.max(...corners.map((c) => c.n)));
  const [cols, rows] = [e1 - e0, n1 - n0];
  const cells = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells[r * cols + c] = encodeChm(at(puwgToWorld(e0 + c + 0.5, n1 - r - 0.5)));
  return { header: { source: "test", of: "test", crs: "EPSG:2180", e0, n0: n1, cols, rows, step: 1, scale: CHM_STEP, noData: NO_DATA }, cells };
};

const near = (p: Pt, q: Pt, r: number) => Math.hypot(p.x - q.x, p.z - q.z) <= r;
/** Crowns of 12.4 m at (50, 5), 9 m at (50, 35) under the houses' 20 m roofs, 2 m at (20, 5), 40 m at (80, 5), 32 m at (80, 20); no data west of x = 10. */
const CITY = chmOf((p) => {
  if (p.x < 10) return Number.NaN;
  if (p.z >= 37.5) return 20;
  if (near(p, { x: 50, z: 5 }, 2)) return 12.4;
  if (near(p, { x: 50, z: 35 }, 2)) return 9;
  if (near(p, { x: 20, z: 5 }, 2)) return 2;
  if (near(p, { x: 80, z: 5 }, 2)) return 40;
  if (near(p, { x: 80, z: 20 }, 2)) return 32;
  return 0.3;
});

/** A Plac Litewski oak with OSM `height=20`, and a seed of each species at the old spread's middle. */
const OAK = { height: "20" };
const seeds = [0x70, 0x71, 0x72];

describe("tree heights by rule: OSM height, else NMPT less NMT around the node (audit ADR-0077 gap 4)", () => {
  it("reads OSM height in metres, with a unit or a decimal comma, and refuses what no tree has", () => {
    expect(osmTreeHeight(OAK)).toBe(20);
    expect(osmTreeHeight({ height: "20 m" })).toBe(20);
    expect(osmTreeHeight({ height: "12,5" })).toBe(12.5);
    expect(osmTreeHeight({ height: "tall" })).toBeNull();
    expect(osmTreeHeight({ height: "80" })).toBeNull();
    expect(osmTreeHeight(undefined)).toBeNull();
  });

  it("takes OSM height first, wherever the surface model says otherwise", () => {
    expect(measureTree(site, { x: 50, z: 5 }, OAK, [CITY])).toEqual({ height: 20, from: "osm" });
  });

  it("measures the highest crown within reach of the node", () => {
    expect(measureTree(site, { x: 50, z: 5 }, undefined, [CITY])).toEqual({ height: 12.4, from: "nmpt" });
    // 2.5 m off the crown's edge: still in reach.
    expect(measureTree(site, { x: 54, z: 5 }, undefined, [CITY])?.height).toBe(12.4);
    // Out of reach: the low growth around it, as the smallest tree.
    expect(measureTree(site, { x: 56, z: 5 }, undefined, [CITY])?.height).toBe(TREE_RANGE.min);
  });

  it("leaves out the roofs of the buildings by the tree", () => {
    // 3 m off the wall: the houses' 20 m eaves are in reach, the crown is what counts.
    expect(measureTree(site, { x: 50, z: 35 }, undefined, [CITY])).toEqual({ height: 9, from: "nmpt" });
  });

  it("clamps to the range of trees, and takes no tree's height from a reading no crown has", () => {
    expect(measureTree(site, { x: 20, z: 5 }, undefined, [CITY])?.height).toBe(TREE_RANGE.min);
    expect(measureTree(site, { x: 80, z: 20 }, undefined, [CITY])?.height).toBe(TREE_RANGE.max);
    expect(measureTree(site, { x: 80, z: 5 }, undefined, [CITY])).toBeNull();
  });

  it("has no height where the surface model has no data", () => {
    expect(measureTree(site, { x: 5, z: 5 }, undefined, [CITY])).toBeNull();
    expect(measureTree(site, { x: 50, z: 5 }, undefined, [])).toBeNull();
  });

  it("takes the extract's OSM height of a tree into its tags, never over the tags' own", () => {
    const tags = withTreeHeights(new Map([["n2", { natural: "tree", height: "7" }]]), [
      { id: "n1", p: { x: 0, z: 0 }, tag: "natural=tree", detail: "25" },
      { id: "n2", p: { x: 0, z: 0 }, tag: "natural=tree", detail: "9" },
      { id: "n3", p: { x: 0, z: 0 }, tag: "amenity=bench", detail: "" },
    ]);
    expect(tags.get("n1")?.height).toBe("25");
    expect(tags.get("n2")?.height).toBe("7");
    expect(tags.has("n3")).toBe(false);
  });
});

describe("trees grown to their measured height (G-422)", () => {
  it("grows a tree in the open to its height, keeping its species", () => {
    for (const seed of seeds) {
      const v = treeVariant(site, { x: 50, z: 5 }, seed, undefined, 20);
      expect(v % 3).toBe(seed % 3);
      expect(Math.abs(treeHeight(v) - 20)).toBeLessThan(0.15);
    }
  });

  it("leaves a tree with no measurement at its seed", () => {
    expect(treeVariant(site, { x: 50, z: 5 }, 0x71, undefined, null)).toBe(0x71);
  });

  it("stops a crown short of the wall it would grow into, never under its seed's size", () => {
    for (const seed of seeds) {
      // 6 m off the wall: the seed's crown is clear, the oak's would reach 6.4-8.75 m.
      const v = treeVariant(site, { x: 50, z: 32 }, seed, undefined, 20);
      const reach = TREE_CROWN[seed % 3]! * treeScale(v);
      expect(reach).toBeLessThan(6);
      expect(reach).toBeGreaterThan(5.5);
      expect(treeScale(v)).toBeGreaterThan(treeScale(seed));
      // By the wall even the seed's crown reaches into it: the seed's size stays.
      expect(treeVariant(site, { x: 50, z: 36 }, seed, undefined, 20)).toBe(seed);
    }
  });

  it("shrinks a tree measured lower than its seed's size, down to the smallest size", () => {
    const v = treeVariant(site, { x: 50, z: 5 }, 0xf0, undefined, TREE_RANGE.min);
    expect(treeScale(v)).toBe(TREE_SCALE.min);
  });
});
