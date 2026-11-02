import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FIGURE_SEAT, type StreetPropItem, doorVariant, figureLayout, isSitting, seatAt } from "../../../packages/core/src";
import { cellKey } from "../../../packages/engine/src/renderer/mapcity/map-index";
import { PROP_BLOCK } from "../../../packages/engine/src/renderer/mapcity/prop-shapes";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { NABRZEZE_CHUNKS } from "../../../packages/sim/src/content/lublin/nabrzeze.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import { LUBLIN_PROP_TABLE } from "../../../packages/sim/src/content/lublin/props.generated.ts";
import { groundY, surfaceY } from "../../../packages/sim/src/content/lublin/terrain";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import { crowdClear } from "../src/crowd-clear.ts";
import { gameDoors } from "../src/game-doors.ts";
import { REPO } from "../src/paths.ts";
import { PROP_STRIDE, emitProps } from "../src/props-emit.ts";
import { type FigureContext, addFigures } from "../src/props-figures.ts";
import { Site } from "../src/props-site.ts";

/**
 * The still crowd of ADR-0058 stage 8 on a small map of its own: a square (paving 0.08 m over the
 * ground) at z < 20, a sidewalk (0.16 m) at z 20..26, a road at z 26..34, a house at x 40..60, z 0..10.
 * Every piece gets people (`share` 1), so each rule shows on its own.
 */

const chunk = (): LublinChunkData =>
  ({
    id: "t-0-0",
    district: "targ",
    bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 },
    buildings: [{ id: "w1", x: 50, z: 5, outline: [-10, -5, 10, -5, 10, 5, -10, 5] }],
    streets: [{ name: "S", kind: "residential", line: [-100, 30, 100, 30] }],
    markings: [],
    pois: [],
    terrain: { originX: -100, originZ: -100, cell: 200, cols: 2, rows: 2, heights: [0, 0, 0, 0] },
    ground: [
      { surface: "square", outline: [-100, -100, 100, -100, 100, 20, -100, 20] },
      { surface: "sidewalk", outline: [-100, 20, 100, 20, 100, 26, -100, 26] },
      { surface: "road", outline: [-100, 26, 100, 26, 100, 34, -100, 34] },
    ],
  }) as unknown as LublinChunkData;

const ALL = { share: 1, most: 3 } as const;
const SHARES = { bench: ALL, "bus-stop": ALL, "food-stall": ALL, door: ALL, "cafe-garden": ALL } as const;
const ctx = (over: Partial<FigureContext> = {}): FigureContext => ({
  groundY: () => 0,
  surfaceY: (p) => (p.z < 20 ? 0.08 : p.z < 26 ? 0.16 : 0.1),
  share: SHARES,
  ...over,
});

const piece = (prop: StreetPropItem["prop"], x: number, z: number, yaw = 0, variant = 0): StreetPropItem => ({ prop, x, y: 0, z, yaw, variant });

/** The figures added round the pieces. */
const figuresOf = (pieces: StreetPropItem[], over: Partial<FigureContext> = {}): StreetPropItem[] => {
  const table = new Map([["t-0-0", [...pieces]]]);
  addFigures(table, new Site([chunk()]), ctx(over));
  return table.get("t-0-0")!.filter((i) => i.prop === "figure");
};

describe("the still crowd (ADR-0058 stage 8)", () => {
  it("sits people on a bench's seats, on its foot, facing its front, the seat's top in the variant", () => {
    const bench = piece("bench", 0, 0, 0.5, 0);
    const got = figuresOf([bench]);
    expect(got.length).toBeGreaterThan(0);
    for (const f of got) {
      const l = figureLayout(f.variant);
      expect(isSitting(l.pose)).toBe(true);
      expect(seatAt(bench, f.x, f.z)).not.toBeNull();
      expect(f.y).toBe(0);
      expect(f.yaw).toBeCloseTo(0.5, 2);
      expect(l.seat).toBe(0.45);
      // The feet on the square's paving (0.08 m): within 8 cm over it, 3 cm in it.
      const drop = l.seat - FIGURE_SEAT[l.pose as "sit" | "perch"][l.body] - 0.08;
      expect(drop).toBeLessThanOrEqual(0.08);
      expect(drop).toBeGreaterThanOrEqual(-0.03);
    }
  });

  it("perches people on a bench sunk in a sidewalk's paving, which leaves too little under the seat to sit", () => {
    const got = figuresOf([piece("bench", 0, 22, 0, 0)]);
    expect(got.length).toBeGreaterThan(0);
    for (const f of got) expect(figureLayout(f.variant).pose).toBe("perch");
  });

  it("puts no one with the feet on the road or in a building", () => {
    // A bench facing the road from its kerb, and one with its back to the house.
    expect(figuresOf([piece("bench", 0, 25.75, 0, 0)])).toEqual([]);
    expect(figuresOf([piece("bench", 50, 9.95, Math.PI, 0)])).toEqual([]);
  });

  it("keeps clear of the moving crowd's spots and lanes", () => {
    const bench = piece("bench", 0, 0, 0, 0);
    const free = figuresOf([bench]);
    expect(free.length).toBeGreaterThan(0);
    const spot = { x: free[0]!.x, z: free[0]!.z + 0.6 };
    const near = figuresOf([bench], { crowd: { spots: [spot], lanes: [] } });
    expect(near.some((f) => Math.hypot(f.x - free[0]!.x, f.z - free[0]!.z) < 0.01)).toBe(false);
    expect(figuresOf([bench], { crowd: { spots: [], lanes: [[{ x: -5, z: 0.6 }, { x: 5, z: 0.6 }]] } })).toEqual([]);
  });

  it("queues people behind a booth's stools facing it, and keeps them off its solid and each other", () => {
    const booth = piece("food-stall", 0, 0, 0);
    const got = figuresOf([booth]);
    expect(got.length).toBeGreaterThan(0);
    for (const f of got) {
      expect(isSitting(figureLayout(f.variant).pose)).toBe(false);
      expect(f.z).toBeGreaterThan(1.2);
      expect(Math.cos(f.yaw)).toBeCloseTo(-1, 5);
      expect(f.y).toBe(0.08);
    }
    for (const f of got) for (const g of got) if (f !== g) expect(Math.hypot(f.x - g.x, f.z - g.z)).toBeGreaterThan(0.5);
  });

  it("stands a smoker beside a shop's door and none by a garage's", () => {
    const shop = piece("door", 0, 10, 0, doorVariant({ model: "shop", width: 1.8, height: 2.2 }));
    const garage = piece("door", 20, 10, 0, doorVariant({ model: "shutter", width: 2.5, height: 2.2 }));
    const got = figuresOf([shop, garage]);
    expect(got.length).toBeGreaterThan(0);
    for (const f of got) {
      expect(figureLayout(f.variant).pose).toBe("smoke");
      // Beside the shop's door (0.9 m its half), out of its way.
      expect(Math.abs(f.x)).toBeGreaterThan(0.9 + 0.5);
      expect(Math.abs(f.x)).toBeLessThan(5);
    }
  });

  it("adds nobody to a block of the renderer's furniture the furniture leaves empty", () => {
    // The bench with a back seats two, 0.45 m either side of its middle: both in the next block.
    expect(figuresOf([piece("bench", 0, 0, 0, 1)], { blockOf: (p) => (p.x === 0 && p.z === 0 ? "home" : "next") })).toEqual([]);
    expect(figuresOf([piece("bench", 0, 0, 0, 1)], { blockOf: () => "home" }).length).toBeGreaterThan(0);
  });

  it("matches the committed table: the figures of its other pieces as `pnpm osm:props` adds them", () => {
    const chunks = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS];
    const table = new Map<string, StreetPropItem[]>();
    for (const [id, rows] of Object.entries(LUBLIN_PROP_TABLE)) {
      const items: StreetPropItem[] = [];
      for (const [prop, row] of Object.entries(rows)) {
        if (prop === "figure") continue;
        for (let k = 0; k < row.length; k += PROP_STRIDE) items.push({ prop: prop as StreetPropItem["prop"], x: row[k]!, y: row[k + 1]!, z: row[k + 2]!, yaw: row[k + 3]!, variant: row[k + 4]! });
      }
      table.set(id, items);
    }
    addFigures(table, new Site(chunks), {
      groundY: (p) => groundY(p.x, p.z),
      surfaceY: (p) => surfaceY(p.x, p.z),
      crowd: crowdClear(),
      gameDoors: gameDoors(),
      blockOf: (p) => cellKey(p.x, p.z, PROP_BLOCK),
    });
    expect(emitProps(table)).toBe(readFileSync(join(REPO, "packages/sim/src/content/lublin/props.generated.ts"), "utf8"));
  });
});
