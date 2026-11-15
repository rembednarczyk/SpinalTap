import { describe, expect, it } from "vitest";
import { type StreetPropItem, barrierVariant } from "../../../packages/core/src";
import type { Area, Line } from "../../osm-import/src/features.ts";
import { padsInWater, padsNotLevel, pathsCutByCleared, propsInWater, unseenWallsOnDeck } from "./w3-checks";

/** The audit's checks before W-3's stage 1 (ADR-0082) on small made-up maps. */

const river: Area = { id: "w1", osmId: 1, tags: { natural: "water" }, ring: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 100 }, { x: 0, z: 100 }], holes: 0 };
const item = (prop: string, x: number, y: number, z: number, variant = 0): StreetPropItem => ({ prop, x, y, z, yaw: 0, variant }) as StreetPropItem;

describe("pad-in-water", () => {
  it("counts a pad's reach over the water, less what lies in a mouth", () => {
    const pad = { rect: { minX: 8, maxX: 20, minZ: 10, maxZ: 20 }, y: -3, blend: 1 };
    // Its reach x 7..21: 3 m by 12 m over the river.
    expect(padsInWater([pad], [river], [])).toEqual([{ at: "14,15", what: "pad 0 (blend 1) over 36.0 m² of the water w1" }]);
    expect(padsInWater([pad], [river], [{ minX: 5, maxX: 12, minZ: 0, maxZ: 30 }])).toEqual([]);
    expect(padsInWater([{ ...pad, rect: { minX: 12, maxX: 20, minZ: 10, maxZ: 20 } }], [river], [])).toEqual([]);
  });
});

describe("prop-in-water", () => {
  it("finds furniture standing in the water on its bed, not on a bridge, nor a fountain's jets", () => {
    const bed = () => -2;
    const items = [item("lamp-park", 5, -2, 50), item("lamp-park", 5, 1, 60), item("fountain-jets", 5, -2, 70), item("bench", 20, 0, 50), item("lamp-park", 6, -2, 80)];
    const found = propsInWater(items, [river], bed, (_x, z) => z === 80);
    expect(found.map((f) => f.at)).toEqual(["5,50"]);
  });
});

describe("path-cut-by-cleared", () => {
  const way = (id: string, pts: [number, number][]): Line => ({ id, osmId: 1, tags: { highway: "footway" }, line: pts.map(([x, z]) => ({ x, z })) });
  const fence = (kind: "fence" | "gate", x: number, z: number) => item("barrier", x, 0, z, barrierVariant({ kind, length: 4, height: 2.7, rise: 0, material: "metal" }));

  it("finds a way into the cleared ground and one across the fence, not one through a gate or past both", () => {
    const cleared = [{ minX: 100, maxX: 120, minZ: 0, maxZ: 20 }];
    const found = pathsCutByCleared(
      [way("w1", [[90, 10], [110, 10]]), way("w2", [[50, 8], [50, 12]]), way("w3", [[60, 8], [60, 12]]), way("w4", [[0, 50], [10, 50]])],
      cleared,
      [fence("fence", 50, 10), fence("gate", 60, 10)].map((i) => ({ ...i, yaw: Math.PI / 2 })),
    );
    expect(found.map((f) => f.what)).toEqual(["w1 (footway) into the cleared ground", "w2 (footway) across the fence, no gate"]);
  });
});

describe("pad-not-level", () => {
  const pad = { rect: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, y: 0, blend: 1 };
  const wall = { minX: -2, maxX: 0, minZ: 0, maxZ: 10, top: 0 };
  // A groove a metre wide along the wall: the pad's edge slopes down to -0.5 at x 0.
  const groove = (x: number) => (x < 1 ? -0.5 * (1 - x) : 0);

  it("finds a groove along a floor-level wall, not the same dip with no wall beside it, nor under a solid", () => {
    expect(padsNotLevel([pad], groove, [wall]).map((f) => f.what)).toEqual(["pad 0 off its level by up to -0.4 m over 10.0 m² beside a floor"]);
    expect(padsNotLevel([pad], groove, [])).toEqual([]);
    expect(padsNotLevel([pad], groove, [wall, { minX: 0, maxX: 1, minZ: 0, maxZ: 10, top: 0 }])).toEqual([]);
    expect(padsNotLevel([pad], () => 0, [wall])).toEqual([]);
  });
});

describe("unseen-wall-on-deck", () => {
  const wall = (x: number, top: number) => ({ center: { x, y: 0, z: 0 }, prisms: [{ points: [{ x: -0.1, z: -1 }, { x: 0.1, z: -1 }, { x: 0.1, z: 1 }, { x: -0.1, z: 1 }], top }] });
  const deck = (x: number) => (x > 5 ? 1.8 : null);

  it("finds an unseen wall reaching onto a deck over it, not one off the deck or under its top", () => {
    expect(unseenWallsOnDeck([wall(5.05, 2.7), wall(3, 2.7), wall(6, 1.5)], deck).map((f) => f.at)).toEqual(["5,-1"]);
  });
});
