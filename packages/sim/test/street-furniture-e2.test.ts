import { describe, expect, it } from "vitest";
import type { StreetPropItem, StreetPropKind } from "@seki/core";
import { WORLD_STREET_PROPS, groundY } from "../src";
import { SOLID_FURNITURE, furniturePrisms } from "../src/content/lublin/furniture";

/** The street furniture of ADR-0058 stage 2 in the game: solids and where Lublin has them. */

const piece = (prop: StreetPropKind, yaw = 0): StreetPropItem => ({ prop, x: 0, y: 0, z: 0, yaw, variant: 0 });

/** Width (x), depth (z) and height of a kind's solid, unturned. */
const extent = (prop: StreetPropKind) => {
  const prisms = furniturePrisms(piece(prop));
  const xs = prisms.flatMap((p) => p.points.map((q) => q.x));
  const zs = prisms.flatMap((p) => p.points.map((q) => q.z));
  return { w: Math.max(...xs) - Math.min(...xs), d: Math.max(...zs) - Math.min(...zs), top: Math.max(...prisms.map((p) => p.top)) };
};

const all = Object.values(WORLD_STREET_PROPS).flat();
const ofKind = (prop: StreetPropKind) => all.filter((i) => i.prop === prop);

describe("street furniture of ADR-0058 stage 2", () => {
  it("cash machines, hydrants, bike racks with their bikes, food carts and containers are solids of their size", () => {
    for (const k of ["atm", "hydrant", "bike-rack", "food-cart", "container"] as const) expect(SOLID_FURNITURE.has(k), k).toBe(true);
    expect(extent("food-cart")).toEqual({ w: 3.9, d: 1.5, top: 2.65 });
    expect(extent("container").w).toBeCloseTo(6.06);
    expect(extent("container").d).toBeCloseTo(2.44);
    expect(extent("atm")).toEqual({ w: 0.7, d: 0.6, top: 1.75 });
    expect(extent("hydrant").top).toBe(0.9);
    // The bikes stand across the rack's hoops: 1.76 m deep, the hoops' 1.6 m row and a handlebar wide.
    expect(extent("bike-rack").d).toBeCloseTo(1.76);
    expect(extent("bike-rack").w).toBeCloseTo(2);
    // Turned a quarter, the long cart runs along z.
    const turned = furniturePrisms(piece("food-cart", Math.PI / 2))[0]!.points;
    expect(Math.max(...turned.map((q) => q.z)) - Math.min(...turned.map((q) => q.z))).toBeCloseTo(3.9);
  });

  it("Lublin has them where the data and the rules put them, on the game's ground", () => {
    // Of OSM's eleven cash machines one in a facade by the kerb has no pavement in front and two
    // stand where the game's own set pieces are.
    expect(ofKind("atm").length).toBeGreaterThanOrEqual(8);
    expect(ofKind("hydrant").length).toBeGreaterThanOrEqual(30);
    expect(ofKind("food-cart").length).toBeGreaterThanOrEqual(5);
    expect(ofKind("container").length).toBe(8);
    // Three food carts by the market on Ruska, the containers in the riverside's yard.
    expect(ofKind("food-cart").filter((i) => i.x > 700 && i.x < 860 && i.z > 500 && i.z < 600).length).toBeGreaterThanOrEqual(3);
    for (const c of ofKind("container")) {
      expect(c.x).toBeGreaterThan(2440);
      expect(c.x).toBeLessThan(2560);
    }
    for (const i of [...ofKind("atm"), ...ofKind("hydrant"), ...ofKind("food-cart"), ...ofKind("container")]) expect(i.y, i.prop).toBeCloseTo(groundY(i.x, i.z), 1);
  });
});
