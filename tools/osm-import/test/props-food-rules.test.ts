import { describe, expect, it } from "vitest";
import { crossingBand, inCrossingBand } from "../../../packages/sim/src/content/lublin/crossing-bands.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import type { BoardSpan } from "../src/props-boards.ts";
import { Clearances, type MarketContext, foodStalls, stallGoods } from "../src/props-food.ts";
import type { Placed } from "../src/props-gen.ts";
import { fnv } from "../src/props-place.ts";
import { Site } from "../src/props-site.ts";

/**
 * The rules of the market's furniture (ADR-0058 stage 3) on a small map of their own: a house at
 * x 0..20, z 0..10 with a fast-food venue whose board hangs on its north wall (x 8..12), a pavement
 * in front of it (z 10..30), and a market square round a stall at (0, 50). Each rule moves the
 * booth or the stock off what it keeps clear of, or leaves none.
 */

type Extra = Partial<Pick<LublinChunkData, "streets" | "ground" | "passages" | "busStops" | "serviceWays">>;

const PAVEMENT = { surface: "sidewalk", outline: [-30, 10, 50, 10, 50, 70, -30, 70] } as const;

const chunk = (extra: Extra = {}): LublinChunkData =>
  ({
    id: "t-0-0",
    district: "targ",
    bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 },
    buildings: [{ id: "w1", x: 10, z: 5, outline: [-10, -5, 10, -5, 10, 5, -10, 5], venues: [{ x: 0, z: 5, kind: "fast-food", name: "BAR", color: "#ff4040" }] }],
    streets: [],
    markings: [],
    pois: [],
    ...extra,
    ground: [PAVEMENT, ...(extra.ground ?? [])],
  }) as unknown as LublinChunkData;

const BOARD: BoardSpan = { a: { x: 8, z: 10 }, b: { x: 12, z: 10 }, nx: 0, nz: 1, bottom: 3, top: 4, wallA: { x: 0, z: 10 }, wallB: { x: 20, z: 10 }, text: "BAR" };

const booth = (extra: Extra = {}, ctx: MarketContext = {}): Placed | null => {
  const c = [chunk(extra)];
  return foodStalls(new Site(c), new Clearances(c, ctx), [BOARD], [])[0] ?? null;
};

/** The booth's footprint (its roof and posts behind, its stools in front), every 0.25 m. */
const footprint = (b: Placed) => {
  const out = [];
  for (let x = -1.2; x <= 1.2 + 1e-9; x += 0.25) for (let z = -0.8; z <= 1.05 + 1e-9; z += 0.25) out.push({ x: b.p.x + x, z: b.p.z + z });
  return out;
};
const least = (b: Placed, at: { x: number; z: number }) => Math.min(...footprint(b).map((q) => Math.hypot(q.x - at.x, q.z - at.z)));

describe("the food booth's rules (ADR-0058 stage 3)", () => {
  it("stands beside the board, back to the wall, on clear pavement", () => {
    const b = booth()!;
    // The first slide clearing the board by 0.6 m: 2.3 m off its west end.
    expect(b.p).toEqual({ x: 5.7, z: 11.35 });
    expect(b.yaw).toBe(0);
  });

  it("keeps off a car street's lanes: none with a street's axis 2.6 m in front of its stools", () => {
    expect(booth({ streets: [{ name: "S", kind: "residential", line: [-30, 15, 50, 15] }] })).toBeNull();
  });

  it("keeps 2 m of pavement between its stools and the carriageway's edge from the map data", () => {
    // The stools' front at z 12.4; a carriageway 6 m wide with its edge 1.5 m or 2.5 m away.
    const road = (edge: number): MarketContext => ({ roads: [{ line: [{ x: -30, z: 12.4 + edge + 3 }, { x: 50, z: 12.4 + edge + 3 }], half: 3 }] });
    expect(booth({}, road(1.5))).toBeNull();
    expect(booth({}, road(2.5))).not.toBeNull();
  });

  it("keeps 10 m from a bus stop's post", () => {
    const stop = { x: 5.7, z: 14 };
    const b = booth({ busStops: [stop.x, stop.z] })!;
    expect(b).not.toBeNull();
    expect(least(b, stop)).toBeGreaterThanOrEqual(10);
  });

  it("keeps 3 m from a zebra's band", () => {
    const zebra = { surface: "crossing", outline: [5, 15, 7, 15, 7, 25, 5, 25] } as const;
    const band = crossingBand(zebra.outline)!;
    const b = booth({ ground: [zebra] })!;
    expect(b).not.toBeNull();
    expect(footprint(b).some((q) => inCrossingBand(band, q, 3))).toBe(false);
  });

  it("keeps 4 m from a passage's mouth and 3 m from the game's doors", () => {
    const mouth = { x: 6, z: 10 };
    const viaPassage = booth({ passages: [{ building: "w1", from: mouth, to: { x: 6, z: 0 }, width: 3, height: 3, rise: 0 }] })!;
    expect(least(viaPassage, mouth)).toBeGreaterThanOrEqual(4);
    const byDoor = booth({}, { doors: [{ a: { x: 5, z: 10 }, b: { x: 7, z: 10 } }] })!;
    expect(least(byDoor, { x: 7, z: 10 })).toBeGreaterThanOrEqual(3);
  });

  it("keeps 1.5 m from a service way's carriageway: a lane 3 m wide by its west end moves it east", () => {
    // The way's axis at x 2.5, half 1.5 m: its edge at x 4, 0.5 m from the booth's west side (x 4.5)
    // where it stands without the way, so it must slide until its footprint keeps x ≥ 5.5.
    const b = booth({ serviceWays: [{ line: [2.5, 10, 2.5, 30], width: 3 }] })!;
    expect(b).not.toBeNull();
    expect(Math.min(...footprint(b).map((q) => q.x))).toBeGreaterThanOrEqual(5.5 - 1e-6);
  });
});

describe("the market stock's rules (ADR-0058 stage 3)", () => {
  // A stall that gets stock by the hash of its key (one in two do).
  const key = ["m~0", "m~1", "m~2", "m~3", "m~4", "m~5"].find((k) => ((fnv(`${k}#stock`) >>> 16) & 1) === 0)!;
  const STALL: Placed = { prop: "market-stall", p: { x: 0, z: 50 }, yaw: 0, key };
  const ring = [
    { x: -20, z: 40 },
    { x: 20, z: 40 },
    { x: 20, z: 60 },
    { x: -20, z: 60 },
  ];
  const stock = (extra: Extra = {}, ctx: MarketContext = {}) => {
    const c = [chunk(extra)];
    return stallGoods(new Site(c), new Clearances(c, ctx), [STALL], ring, [], [STALL]);
  };

  it("stands beside its stall on clear paving", () => {
    const [g] = stock();
    expect(Math.abs(g!.p.x)).toBeCloseTo(2.15);
    expect(g!.p.z).toBeCloseTo(49.7);
  });

  it("keeps 4.5 m from a car street's axis: none with one along the row 3.8 m off", () => {
    expect(stock({ streets: [{ name: "S", kind: "residential", line: [-30, 45.5, 50, 45.5] }] })).toEqual([]);
  });

  it("keeps 3 m from the game's doors: a door by its side moves it to the other", () => {
    const side = Math.sign(stock()[0]!.p.x);
    const door = { a: { x: side * 5, z: 50 }, b: { x: side * 6, z: 50 } };
    const [g] = stock({}, { doors: [door] });
    expect(Math.sign(g!.p.x)).toBe(-side);
  });
});
