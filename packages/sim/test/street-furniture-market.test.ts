import { describe, expect, it } from "vitest";
import type { StreetPropItem, StreetPropKind } from "@seki/core";
import { WORLD_STREET_PROPS, groundY } from "../src";
import { FOOD_STALL, SOLID_FURNITURE, furniturePrisms } from "../src/content/lublin/furniture";
import { LUBLIN_STREET_PROPS } from "../src/content/lublin";

/** The market's furniture of ADR-0058 stage 3 in the game: the stock beside the stalls and the food booths. */

const piece = (prop: StreetPropKind, variant = 0): StreetPropItem => ({ prop, x: 0, y: 0, z: 0, yaw: 0, variant });

/** Width (x), depth (z), front edge and height of a piece's solid, unturned. */
const extent = (i: StreetPropItem) => {
  const prisms = furniturePrisms(i);
  const xs = prisms.flatMap((p) => p.points.map((q) => q.x));
  const zs = prisms.flatMap((p) => p.points.map((q) => q.z));
  return { w: Math.max(...xs) - Math.min(...xs), d: Math.max(...zs) - Math.min(...zs), front: Math.max(...zs), top: Math.max(...prisms.map((p) => p.top)) };
};

const all = Object.values(WORLD_STREET_PROPS).flat();
const ofKind = (prop: StreetPropKind) => all.filter((i) => i.prop === prop);

describe("the market's furniture of ADR-0058 stage 3", () => {
  it("the stock is a solid of its shape, the booth its counter, roof posts and stools", () => {
    expect(SOLID_FURNITURE.has("market-goods")).toBe(true);
    expect(SOLID_FURNITURE.has("food-stall")).toBe(true);
    // Cartons on a pallet, barrels, crates, goods under a canvas: four shapes by the variant's low bits.
    expect([0, 1, 2, 3].map((v) => extent(piece("market-goods", v)).top)).toEqual([1.0, 0.95, 0.9, 1.4]);
    expect(extent(piece("market-goods", 4))).toEqual(extent(piece("market-goods", 0)));
    for (const v of [0, 1, 2, 3]) expect(extent(piece("market-goods", v)).w).toBeLessThanOrEqual(1.4);
    const booth = extent(piece("food-stall"));
    expect(booth.top).toBe(FOOD_STALL.roof);
    // The stools stand in front of the counter, the customers' side (+z).
    expect(booth.front).toBeCloseTo(FOOD_STALL.stoolZ + 0.18);
    expect(furniturePrisms(piece("food-stall")).length).toBe(1 + 4 + 3);
  });

  it("Lublin has them where the rules put them, on the game's ground", () => {
    expect(ofKind("market-goods").length).toBeGreaterThan(50);
    expect(ofKind("food-stall").length).toBeGreaterThan(8);
    for (const i of [...ofKind("market-goods"), ...ofKind("food-stall")]) expect(i.y, i.prop).toBeCloseTo(groundY(i.x, i.z), 1);
  });

  it("keeps the stock exactly where its stall stays in the game, whichever chunk the stall is in", () => {
    // A stall and its stock (within 2.6 m) may lie on two sides of a chunk's edge.
    const stalls = ofKind("market-stall");
    const withStall = (g: { x: number; z: number }) => stalls.some((s) => Math.hypot(s.x - g.x, s.z - g.z) <= 2.6);
    for (const g of ofKind("market-goods")) expect(withStall(g), `${g.x},${g.z}`).toBe(true);
    // Every piece of the map's stock whose stall the game kept is in the game too: the stock by
    // Targ na Ruskiej (721.6, 564.2) in podzamcze-1-1 beside its stall (719.6, 565.1) in podzamcze-0-1.
    const map = Object.values(LUBLIN_STREET_PROPS)
      .flat()
      .filter((i) => i.prop === "market-goods");
    const kept = (g: { x: number; z: number }) => ofKind("market-goods").some((o) => Math.abs(o.x - g.x) < 1e-6 && Math.abs(o.z - g.z) < 1e-6);
    for (const g of map.filter(withStall)) expect(kept(g), `${g.x},${g.z}`).toBe(true);
    expect(map.some((g) => g.x === 721.6 && g.z === 564.2 && kept(g))).toBe(true);
  });
});
