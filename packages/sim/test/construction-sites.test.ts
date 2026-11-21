import { describe, expect, it } from "vitest";
import {
  SITE_CRANE,
  SITE_KINDS,
  SITE_SCAFFOLD,
  siteCraneLayout,
  siteCraneVariant,
  siteFenceLayout,
  siteFenceVariant,
  siteGateLayout,
  siteGateVariant,
  siteScaffoldLayout,
  siteScaffoldVariant,
  terrainHeightAt,
} from "@seki/core";
import { WORLD_STREET_PROPS, groundY } from "../src";
import { LUBLIN_CONSTRUCTION_SITES, SITE_ROW, digPads, sitePieces, withSitePieces } from "../src/content/lublin/construction";
import { SITE, SOLID_FURNITURE, furniturePrisms } from "../src/content/lublin/furniture";
import { type Pad, shapeGrid, shapeHeight } from "../src/content/lublin/shape";
import { DIG_PADS, MAP_CHUNKS, rawHeight } from "../src/content/lublin/sites";
import { siteGrid } from "../src/content/lublin/terrain";

/** The building sites of ADR-0087 stage 1 in the game: their pieces among the furniture, solid, and their digs in the terrain. */
describe("the building sites in the game (ADR-0087)", () => {
  const zielona = LUBLIN_CONSTRUCTION_SITES.find((s) => s.id === "w770678456");

  it("lays Zielona 5A's fence, gate, board and containers among the chunks' furniture", () => {
    expect(zielona?.set).toBe("full");
    const pieces = sitePieces([zielona!]);
    const kinds = new Set(pieces.map((p) => p.prop));
    // No scaffold: its only wall on the outline carries the board of FRYZURA Z PRZYTUPEM (G-893).
    // The cones and barriers of its street side on Zielona (ADR-0096 rule 2) come as `clutter`.
    expect([...kinds].sort()).toEqual(["clutter", "site-board", "site-cabin", "site-crane", "site-fence", "site-gate"]);
    const world = Object.values(WORLD_STREET_PROPS)
      .flat()
      .filter((p) => SITE_KINDS.has(p.prop) || p.prop === "clutter");
    // On the game's ground, which the dig leaves as the map has it there: within a few centimetres of the generator's foot.
    // The cones and barriers outside the fence stand on the pavement's shaping, which the generator does not see: 10 cm.
    const near = (p: { prop: string }) => (p.prop === "clutter" ? 0.1 : 0.05);
    for (const p of pieces) expect(world.some((w) => w.prop === p.prop && w.x === p.x && w.z === p.z && Math.abs(w.y - p.y) < near(p)), `${p.prop} ${p.x},${p.z}`).toBe(true);
  });

  it("puts a piece in the chunk holding it, half-open, and leaves out one in no chunk", () => {
    const chunks = [
      { id: "a", bounds: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 } },
      { id: "b", bounds: { minX: 10, maxX: 20, minZ: 0, maxZ: 10 } },
    ];
    const site = { id: "w1", seed: 1, set: "fence" as const, area: 100, outline: [0, 0, 10, 0, 10, 10], board: null, dig: null, pieces: { "site-fence": [10, 0, 5, 0, 250, 5, 0, 5, 0, 250, 30, 0, 5, 0, 250] } };
    const out = withSitePieces({ a: [] }, chunks, [site]);
    expect(out.a!.map((p) => p.x)).toEqual([5]);
    expect(out.b!.map((p) => p.x)).toEqual([10]);
  });

  it("makes the fence, the gate and the containers solids, the board none (the fence behind it is one)", () => {
    for (const k of ["site-fence", "site-gate", "site-cabin"] as const) expect(SOLID_FURNITURE.has(k)).toBe(true);
    expect(SOLID_FURNITURE.has("site-board")).toBe(false);
    const fence = { prop: "site-fence" as const, x: 0, y: 0, z: 0, yaw: 0, variant: siteFenceVariant({ length: 2.4, rise: 0.3, ad: null, led: 1 }) };
    const [prism] = furniturePrisms(fence);
    const xs = prism!.points.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(2.4, 5);
  });

  it("reads the variants as the core lays them out", () => {
    for (const length of [0.4, 1.7, 2.5])
      for (const rise of [-1.2, 0, 0.37])
        for (const ad of [null, 0, 3]) {
          const v = siteFenceVariant({ length, rise, ad, led: 2 });
          expect(siteFenceLayout(v)).toEqual({ length, rise, ad, led: 2 });
          expect([SITE.fenceLength(v), SITE.fenceRise(v)]).toEqual([length, rise]);
        }
    for (const wicket of [true, false])
      for (const leaf of [true, false]) {
        const g = siteGateLayout(siteGateVariant(wicket, 3, leaf));
        expect(SITE.gate(siteGateVariant(wicket, 3, leaf))).toEqual({ width: g.width, leaf: g.leaf });
        expect(g.leaf).toBe(leaf ? 1 : -1);
      }
    // Stage 2: the crane and the scaffold.
    for (const [height, jib, phase] of [
      [22, 31, 0],
      [26.4, 60, 15],
      [102.3, 102.3, 7],
    ] as const) {
      const v = siteCraneVariant({ height, jib, phase });
      expect(siteCraneLayout(v)).toEqual({ height, jib, phase });
      expect(SITE.craneHeight(v)).toBe(height);
    }
    for (const [length, height, rise, banner] of [
      [4, 4, -1.28, 0],
      [11.5, 10.2, 0.37, 3],
      [102.3, 51.1, 1.27, 2],
    ] as const) {
      const v = siteScaffoldVariant({ length, height, rise, banner });
      expect(siteScaffoldLayout(v)).toEqual({ length, height, rise, banner });
      expect(SITE.scaffold(v)).toEqual({ length, height, rise });
    }
  });

  it("makes the crane's mast and the scaffold solids, the scaffold on the site's side of the wall", () => {
    for (const k of ["site-crane", "site-scaffold"] as const) expect(SOLID_FURNITURE.has(k)).toBe(true);
    const mast = furniturePrisms({ prop: "site-crane", x: 0, y: 0, z: 0, yaw: 0, variant: siteCraneVariant({ height: 24, jib: 30, phase: 0 }) })[0]!;
    expect(Math.max(...mast.points.map((p) => p.x))).toBeCloseTo(SITE_CRANE.mast, 5);
    const scaffold = furniturePrisms({ prop: "site-scaffold", x: 0, y: 0, z: 0, yaw: 0, variant: siteScaffoldVariant({ length: 8, height: 10, rise: 0, banner: 0 }) })[0]!;
    const zs = scaffold.points.map((p) => p.z);
    expect([Math.min(...zs), Math.max(...zs)].map((z) => Math.round(z * 100) / 100)).toEqual([0, SITE_SCAFFOLD.depth]);
  });

  it("digs Zielona 5A's dig down to its floor and leaves the terrain under the fence as the map has it", () => {
    const dig = zielona!.dig!;
    const pts = Array.from({ length: dig.outline.length / 2 }, (_, k) => ({ x: dig.outline[2 * k]!, z: dig.outline[2 * k + 1]! }));
    const mid = { x: pts.reduce((s, p) => s + p.x, 0) / 4, z: pts.reduce((s, p) => s + p.z, 0) / 4 };
    expect(groundY(mid.x, mid.z)).toBeCloseTo(dig.y, 1);
    expect(rawHeight(mid.x, mid.z) - groundY(mid.x, mid.z)).toBeGreaterThan(1.1);
    // The chunks' grids refined under the digs, with them and without: the same under every piece of the site.
    for (const p of sitePieces([zielona!])) {
      const c = MAP_CHUNKS.find((k) => p.x >= k.bounds.minX && p.x < k.bounds.maxX && p.z >= k.bounds.minZ && p.z < k.bounds.maxZ)!;
      const not = siteGrid(c.terrain);
      const dug = shapeGrid(not, DIG_PADS, []);
      expect(terrainHeightAt(dug, p.x, p.z), `${p.prop} ${p.x},${p.z}`).toBe(terrainHeightAt(not, p.x, p.z));
    }
    expect(digPads(LUBLIN_CONSTRUCTION_SITES).every((p) => p.row === SITE_ROW)).toBe(true);
  });

  it("refines a 5 m grid with points within a dig's blend, and no other; no grid of the map has one", () => {
    const grid = { originX: 0, originZ: 0, cell: 5, cols: 11, rows: 11, heights: new Array<number>(121).fill(1) };
    const pad: Pad = { rect: { minX: 52, maxX: 70, minZ: 10, maxZ: 20 }, y: -1, blend: 3 };
    expect(siteGrid(grid, [pad]).cell).toBe(2.5);
    expect(siteGrid(grid, [{ ...pad, rect: { minX: 53.1, maxX: 70, minZ: 10, maxZ: 20 } }])).toBe(grid);
    for (const c of MAP_CHUNKS) expect(siteGrid(c.terrain), c.id).toBe(c.terrain);
  });

  it("levels a pad's ring, not its whole rectangle", () => {
    const ring = [
      { x: 0, z: 0 },
      { x: 10, z: 10 },
      { x: 0, z: 20 },
      { x: -10, z: 10 },
    ];
    const pad: Pad = { rect: { minX: -10, maxX: 10, minZ: 0, maxZ: 20 }, ring, y: -2, blend: 1 };
    expect(shapeHeight(0, 10, 0, [pad], [])).toBe(-2);
    // A corner of the rectangle, 7 m off the ring: as the terrain was.
    expect(shapeHeight(9.5, 0.5, 0, [pad], [])).toBe(0);
    expect(shapeHeight(9.5, 0.5, 0, [{ ...pad, ring: undefined }], [])).toBe(-2);
  });
});
