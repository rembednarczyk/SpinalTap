import { describe, expect, it } from "vitest";
import { SITE_CABIN, SITE_FENCE, siteFenceLayout, siteGateLayout } from "../../../packages/core/src/world/sites.ts";
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { enSite } from "../../../packages/ui/src/i18n/en/site.ts";
import { plSite } from "../../../packages/ui/src/i18n/pl/site.ts";
import { DIG_CELL, type SiteGround, lineDistance } from "../src/construction-ground.ts";
import { FLIGHT_CELL } from "../../../packages/sim/src/content/lublin/shape.ts";
import { distanceToPiece } from "../../../packages/sim/src/content/lublin/furniture.ts";
import { BOARD_KEYS, SETS, planSite, siteSeed, siteSet } from "../src/construction-site.ts";
import { FENCE_INSET, insetRing } from "../src/construction-fence.ts";
import { type Pt, pointInRing } from "../src/geometry.ts";

/**
 * The building sites' generator (ADR-0087 stage 1) on a plan: a site `w` x `d` m from (0, 0),
 * a pavement up to 0.1 m over its south edge, a carriageway south of it with a street on
 * its axis, a building in its north-east corner, the terrain falling to the west.
 */
const plan = (w: number, d: number, opts: { street?: boolean; building?: boolean } = {}) => {
  const outline: Pt[] = [
    { x: 0, z: 0 },
    { x: w, z: 0 },
    { x: w, z: d },
    { x: 0, z: d },
  ];
  const building: Pt[] = [
    { x: w - 8, z: d - 8 },
    { x: w + 4, z: d - 8 },
    { x: w + 4, z: d + 4 },
    { x: w - 8, z: d + 4 },
  ];
  const street = [
    { x: -50, z: -6 },
    { x: w + 50, z: -6 },
  ];
  const surface = (p: Pt): "road" | "walk" | "building" | null => {
    if (opts.building !== false && pointInRing(p, building)) return "building";
    if (p.z < -3 && p.z > -9) return "road";
    if (p.z <= 0.1 && p.z >= -3) return "walk";
    return null;
  };
  const ground: SiteGround = {
    free: (p) => surface(p) === null,
    open: (p) => surface(p) !== "building",
    heightAt: (p) => 0.03 * p.x + 0.005 * p.z,
    cellAt: () => 2.5,
    driveDistance: (p) => (opts.street === false ? Infinity : lineDistance(p, street)),
    walkDistance: (p) => Math.abs(p.z + 1.5),
  };
  return { outline, ground, surface };
};

/** Points of a piece's footprint in the world: along its local x and across its local z. */
const footprint = (p: StreetPropItem, hx: number, hz: number): Pt[] => {
  const out: Pt[] = [];
  const [c, s] = [Math.cos(p.yaw), Math.sin(p.yaw)];
  for (let i = -4; i <= 4; i++)
    for (const k of [-1, 0, 1]) {
      const [x, z] = [(hx * i) / 4, hz * k];
      out.push({ x: p.x + x * c + z * s, z: p.z - x * s + z * c });
    }
  return out;
};

const reach = (p: StreetPropItem): [number, number] =>
  p.prop === "site-fence" ? [siteFenceLayout(p.variant).length / 2, SITE_FENCE.thick / 2] : p.prop === "site-cabin" ? [SITE_CABIN.hx, SITE_CABIN.hz] : p.prop === "site-gate" ? [siteGateLayout(p.variant).width / 2 + 0.24, 0.12] : [1.2, 0.03];

describe("the building sites' generator (ADR-0087 stage 1)", () => {
  it("gives the same site twice and another for another outline's id", () => {
    const { outline, ground } = plan(40, 30);
    const a = planSite({ id: "w1", ring: outline }, ground);
    expect(planSite({ id: "w1", ring: outline }, ground)).toEqual(a);
    const b = planSite({ id: "w2", ring: outline }, ground);
    expect(b.seed).not.toBe(a.seed);
    expect(JSON.stringify(b.pieces)).not.toBe(JSON.stringify(a.pieces));
    expect(siteSeed("w1")).toBe(siteSeed("w1"));
  });

  it("lays no piece on a carriageway, a pavement or in a wall, the fence 0.3 m in", () => {
    const { outline, ground, surface } = plan(40, 30);
    for (const id of ["w1", "w2", "w3", "r7"]) {
      const s = planSite({ id, ring: outline }, ground);
      expect(s.pieces.length).toBeGreaterThan(20);
      for (const p of s.pieces) {
        const [hx, hz] = reach(p);
        expect(footprint(p, hx, hz).filter((q) => surface(q) !== null), `${id} ${p.prop} at ${p.x},${p.z}`).toEqual([]);
      }
      const [outer, inner] = [insetRing(outline, FENCE_INSET - 0.01), insetRing(outline, FENCE_INSET + 0.01)];
      for (const p of s.pieces.filter((q) => q.prop === "site-fence")) expect([pointInRing(p, outer), pointInRing(p, inner)]).toEqual([true, false]);
      // The panels stop short of the gate's posts and its parked leaf.
      const gate = s.pieces.find((q) => q.prop === "site-gate")!;
      for (const p of s.pieces.filter((q) => q.prop === "site-fence")) {
        const [hx] = reach(p);
        expect(Math.min(...footprint(p, hx, 0.04).map((q) => distanceToPiece(gate, q.x, q.z))), `panel at ${p.x},${p.z}`).toBeGreaterThan(0.01);
      }
      // The building's corner is left out of the fence.
      expect(s.unfenced).toBeGreaterThan(0);
    }
  });

  it("puts the gate on the side by the street, a wicket with no street a vehicle takes", () => {
    const { outline, ground } = plan(40, 30);
    for (const id of ["w1", "w2", "w3"]) {
      const s = planSite({ id, ring: outline }, ground);
      const gate = s.pieces.find((p) => p.prop === "site-gate")!;
      expect(siteGateLayout(gate.variant).wicket).toBe(false);
      // The south side, 0.3 m in from the outline: the gate faces the street (local +z to -z).
      expect(gate.z).toBeCloseTo(FENCE_INSET, 5);
      expect(Math.cos(gate.yaw)).toBeCloseTo(-1, 5);
      expect(s.board?.name).toMatch(/^site\.board\.name\.\d$/);
    }
    const walk = plan(40, 30, { street: false });
    const s = planSite({ id: "w1", ring: walk.outline }, walk.ground);
    expect(siteGateLayout(s.pieces.find((p) => p.prop === "site-gate")!.variant).wicket).toBe(true);
  });

  it("scales the set by the area: the fence alone, a yard, the full set", () => {
    expect([siteSet(SETS.fence), siteSet(SETS.fence + 1), siteSet(SETS.yard), siteSet(SETS.yard + 1)]).toEqual(["fence", "yard", "yard", "full"]);
    const count = (w: number, d: number, id: string) => {
      const { outline, ground } = plan(w, d, { building: false });
      const s = planSite({ id, ring: outline }, ground);
      return { set: s.set, cabins: s.pieces.filter((p) => p.prop === "site-cabin").length, dig: s.dig };
    };
    for (const id of ["w1", "w2", "w3", "w4"]) {
      const small = count(12, 10, id);
      expect(small).toEqual({ set: "fence", cabins: 0, dig: null });
      const yard = count(28, 20, id);
      expect(yard.set).toBe("yard");
      expect(yard.cabins).toBeGreaterThanOrEqual(1);
      expect(yard.cabins).toBeLessThanOrEqual(2);
      const full = count(50, 36, id);
      expect(full.set).toBe("full");
      expect(full.cabins).toBeGreaterThanOrEqual(2);
      expect(full.cabins).toBeLessThanOrEqual(3);
      expect(full.dig).not.toBeNull();
    }
  });

  it("digs the lowest free ground inside the fence, its blend and a cell past it on free ground", () => {
    const { outline, ground } = plan(50, 36, { building: false });
    const s = planSite({ id: "w5", ring: outline }, ground);
    const dig = s.dig!;
    expect(dig.area).toBeGreaterThanOrEqual(0.15 * s.area);
    expect(dig.area).toBeLessThanOrEqual(0.55 * s.area + 1);
    const xs = dig.outline.map((p) => p.x);
    // The terrain falls to the west: the dig keeps to the west half, its floor under the terrain in it.
    expect(Math.min(...xs)).toBeLessThan(25);
    expect(dig.y).toBeLessThan(Math.min(...dig.outline.map((p) => ground.heightAt(p))) - 1.1);
    const margin = dig.blend + 2.5 * Math.SQRT2;
    const inset = insetRing(outline, FENCE_INSET + margin - 0.01);
    for (const p of dig.outline) expect(pointInRing(p, inset)).toBe(true);
  });

  it("fits the dig to the grid the game refines under it", () => {
    expect(DIG_CELL).toBe(FLIGHT_CELL);
  });

  it("draws the board's texts from keys both catalogs hold", () => {
    for (const [pool, n] of Object.entries(BOARD_KEYS))
      for (let k = 0; k < n; k++) {
        const key = `site.board.${pool}.${k}`;
        expect(Object.keys(enSite)).toContain(key);
        expect(Object.keys(plSite)).toContain(key);
      }
    expect(Object.keys(enSite)).toHaveLength(Object.values(BOARD_KEYS).reduce((a, b) => a + b, 0));
  });
});
