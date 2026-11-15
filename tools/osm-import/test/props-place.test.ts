import { describe, expect, it } from "vitest";
import { LUBLIN_PROP_TABLE } from "../../../packages/sim/src/content/lublin/props.generated.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import { generateProps } from "../src/props-gen.ts";
import { type SideSpot, offRoad, sideOffset, sideSpot, signalSide } from "../src/props-place.ts";
import { Site } from "../src/props-site.ts";

/** A 100 x 60 m chunk: a paved causeway 6.5 m wide along z = 30 between lawns, like Zamkowa's over the Błonie. */
const causeway = (): LublinChunkData => ({
  id: "test-0-0",
  district: "kanal",
  bounds: { minX: 0, maxX: 100, minZ: 0, maxZ: 60 },
  terrain: { originX: 0, originZ: 0, cell: 50, cols: 3, rows: 2, heights: [0, 0, 0, 0, 0, 0] },
  buildings: [],
  ground: [
    { surface: "grass", outline: [0, 0, 100, 0, 100, 60, 0, 60] },
    { surface: "square", outline: [0, 26.75, 100, 26.75, 100, 33.25, 0, 33.25] },
  ],
  streets: [{ name: "Zamkowa", kind: "pedestrian", line: [0, 30, 100, 30] }],
  markings: [],
  pois: [],
});

describe("a lamp of the plan beside a pedestrian street (G-477)", () => {
  const site = new Site([causeway()]);

  it("stands 0.3 m past the paving's edge, not the fallback out on the lawn", () => {
    for (const n of [{ x: 0, z: 1 }, { x: 0, z: -1 }]) {
      const d = sideOffset(site, { x: 50, z: 30 }, n, "kerb", 5, true)!;
      expect(d).toBeGreaterThan(3.5);
      expect(d).toBeLessThan(3.6);
    }
  });

  it("keeps the fallback on a paving wider than it, for other pieces and where the axis is not paved", () => {
    const wide = new Site([{ ...causeway(), ground: [{ surface: "square", outline: [0, 10, 100, 10, 100, 50, 0, 50] }] }]);
    expect(sideOffset(wide, { x: 50, z: 30 }, { x: 0, z: 1 }, "kerb", 5, true)).toBe(5);
    expect(sideOffset(site, { x: 50, z: 30 }, { x: 0, z: 1 }, "kerb", 5)).toBe(5);
    expect(sideOffset(site, { x: 50, z: 40 }, { x: 0, z: 1 }, "kerb", 5, true)).toBe(5);
  });
});

describe("a lamp of the plan beside a pedestrian street on a bridge (G-497)", () => {
  // Zamkowa's viaduct: its paving is bridge ground, which the site does not stand things on, over
  // the lawn of the bank; the abutment's paving on the ground goes on from it at x = 60.
  const viaduct = (): LublinChunkData => ({
    ...causeway(),
    ground: [
      { surface: "grass", outline: [0, 0, 100, 0, 100, 60, 0, 60] },
      { surface: "square", outline: [60, 26.75, 100, 26.75, 100, 33.25, 60, 33.25] },
      { surface: "cobble", outline: [0, 26.75, 60, 26.75, 60, 33.25, 0, 33.25], bridge: true, deck: [0, 30, 60, 30] },
    ],
  });
  const site = new Site([viaduct()]);

  it("stands 0.3 m past the deck's paving, as past the abutment's, not the fallback out on the bank", () => {
    for (const x of [30, 59.8]) {
      for (const n of [{ x: 0, z: 1 }, { x: 0, z: -1 }]) {
        const d = sideOffset(site, { x, z: 30 }, n, "kerb", 5, true)!;
        expect(d).toBeGreaterThan(3.5);
        expect(d).toBeLessThan(3.6);
      }
    }
  });

  it("keeps the fallback for other pieces and off the deck", () => {
    expect(sideOffset(site, { x: 30, z: 30 }, { x: 0, z: 1 }, "kerb", 5)).toBe(5);
    expect(sideOffset(site, { x: 30, z: 40 }, { x: 0, z: 1 }, "kerb", 5, true)).toBe(5);
  });

  it("keeps to the bank 0.3 m past the deck's paving where the deck is low over it, at the abutment", () => {
    // The deck level with its abutments' ground (0 m) over a valley 5 m deep from x = 20 to 40, rising back by x = 60.
    const valley = new Site([{ ...viaduct(), terrain: VALLEY }]);
    const end = sideSpot(valley, { x: 57, z: 30 }, { x: 0, z: 1 }, "kerb", 5, true)!;
    expect(end.deck).toBe(false);
    expect(end.d).toBeGreaterThan(3.5);
    expect(end.d).toBeLessThan(3.6);
  });
});

/** Terrain for the viaduct: its abutments' ground level with the deck (0 m), a valley 5 m deep from x = 20 to 40 under it, rising back by x = 60. */
const VALLEY = { originX: 0, originZ: 0, cell: 20, cols: 6, rows: 1, heights: [0, -5, -5, 0, 0, 0] };

describe("a lamp of the plan on a viaduct's span (G-503)", () => {
  const span = (ground: LublinChunkData["ground"] = []): LublinChunkData => ({
    ...causeway(),
    terrain: VALLEY,
    ground: [
      { surface: "grass", outline: [0, 0, 100, 0, 100, 60, 0, 60] },
      ...ground,
      { surface: "cobble", outline: [0, 26.75, 60, 26.75, 60, 33.25, 0, 33.25], bridge: true, deck: [0, 30, 60, 30] },
    ],
  });
  const onDeck = (spot: SideSpot | null) => {
    expect(spot?.deck).toBe(true);
    // 0.3 m in from the deck's edge 3.25 m off the axis, by its parapet.
    expect(spot!.d).toBeGreaterThan(2.9);
    expect(spot!.d).toBeLessThan(2.96);
  };

  it("stands on the deck 0.3 m in from its edge on both sides, not on the valley's ground under it", () => {
    for (const n of [{ x: 0, z: 1 }, { x: 0, z: -1 }]) onDeck(sideSpot(new Site([span()]), { x: 30, z: 30 }, n, "kerb", 5, true));
  });

  it("stands on the deck at the abutment where its bank lies 1.85 m under it, the lantern over the walkers' heads (G-507)", () => {
    // Zamkowa's at (756.8; 175.7): the bank 1.85 m under the deck put the lantern 1.55 m over its paving.
    const site = new Site([span()]);
    expect(site.deckHeightAt({ x: 52.6, z: 33 })! - site.heightAt({ x: 52.6, z: 33.55 })).toBeCloseTo(1.85, 2);
    for (const n of [{ x: 0, z: 1 }, { x: 0, z: -1 }]) onDeck(sideSpot(site, { x: 52.6, z: 30 }, n, "kerb", 5, true));
  });

  it("stands on the deck over a path under the span, which is not the street's paving", () => {
    // A path crossing under the viaduct at x = 30, as Podwale's under Zamkowa's.
    const under = new Site([span([{ surface: "sidewalk", outline: [27, 0, 33, 0, 33, 60, 27, 60] }])]);
    onDeck(sideSpot(under, { x: 30, z: 30 }, { x: 0, z: 1 }, "kerb", 5, true));
  });

  it("keeps other pieces, and lamps without the paving's edge, off the deck", () => {
    const site = new Site([span()]);
    expect(sideSpot(site, { x: 30, z: 30 }, { x: 0, z: 1 }, "kerb", 5)).toEqual({ d: 5, deck: false });
    expect(sideSpot(site, { x: 30, z: 30 }, { x: 0, z: 1 }, "kerb", 5, true, false)).toEqual({ d: 5, deck: false });
  });

  it("gives the lamps on the deck the deck's height for their foot, by the abutments 2.5 m over the bank too (G-507)", () => {
    const plan = { items: [{ id: "lamps.wiadukt", kind: "lamp-pastoral", line: [0, 30, 60, 30], spacing: 20 }] };
    const lamps = generateProps(plan, [span()]).byChunk.get("test-0-0")!.filter((i) => i.prop === "lamp-pastoral");
    expect(lamps.map((i) => [i.x, i.y, i.z])).toEqual([
      [10, 0, 32.9],
      [30, 0, 32.9],
      [50, 0, 32.9],
    ]);
  });
});

/** A junction's asphalt 100 x 60 m, the pavement 8 m north of its node and `south` m south of it; a one-way street driven east up to the node. */
const junction = (south: number): LublinChunkData => ({
  ...causeway(),
  ground: [
    { surface: "sidewalk", outline: [0, 38, 100, 38, 100, 60, 0, 60] },
    { surface: "road", outline: [0, 30 - south, 100, 30 - south, 100, 38, 0, 38] },
    { surface: "sidewalk", outline: [0, 0, 100, 0, 100, 30 - south, 0, 30 - south] },
  ],
  streets: [{ name: "Aleja", kind: "primary", line: [0, 30, 50, 30], oneway: true }],
});

describe("a traffic light from a node on the road (G-825 r2, T-031)", () => {
  const node = { x: 50, z: 30 };

  it("stands on the right of the traffic driven up to the node where that pavement is about as near as any", () => {
    const site = new Site([junction(9)]);
    expect(offRoad(site, node)!.z).toBeGreaterThan(38);
    expect(offRoad(site, node, 12, 0.6, signalSide(site, node))!.z).toBeLessThan(21);
  });

  it("keeps to the nearest pavement where the right's is much farther", () => {
    const site = new Site([junction(11)]);
    expect(offRoad(site, node, 12, 0.6, signalSide(site, node))!.z).toBeGreaterThan(38);
  });

  it("stands by Al. Tysiąclecia's south kerb at Rondo Dmowskiego, not on the wedge of the junction's asphalt the map paves", () => {
    // n1946478264 (1099.0; 272.3): the light stood at (1104.7; 266.6) before G-825 moved the kerb to
    // z 265.8; the wedge (1088-1098; 278-282) is asphalt with lane lines on the orthophoto.
    const rows = LUBLIN_PROP_TABLE["podzamcze-2-0"]?.["traffic-signal"] ?? [];
    const near = Array.from({ length: rows.length / 5 }, (_, k) => ({ x: rows[5 * k]!, z: rows[5 * k + 2]! })).filter((p) => Math.hypot(p.x - 1099, p.z - 272.3) < 13);
    expect(near.length).toBe(1);
    expect(near[0]!.z).toBeLessThan(265.8);
  });
});
