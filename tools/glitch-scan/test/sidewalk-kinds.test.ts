import { describe, expect, it } from "vitest";
import type { GroundSurface } from "../../../packages/core/src";
import { SURFACE_LIFT } from "../../../packages/core/src";
import { gaps, junctionTest, steps, stretches, surfacePatches, widthJumps } from "./sidewalk-kinds";
import { type GroundLookup, sideProfile, stations } from "./sidewalk-profile";
import { SIDEWALK_RULES, ruleOf } from "./sidewalk-rules";

/*
 * The sidewalks' uniformity (the user's decision of 26.11) on a street drawn by hand: an east-west
 * carriageway 6 m wide along z = 0, its north side (z >= 3) paved by the function given.
 */
const street = (north: (x: number, z: number) => GroundSurface | "building" | null): GroundLookup => ({
  surfaces: (x, z) => {
    if (Math.abs(z) < 3) return ["road"];
    const s = z >= 3 ? north(x, z) : "sidewalk";
    return s && s !== "building" ? [s] : [];
  },
  lift: (x, z) => {
    if (Math.abs(z) < 3) return SURFACE_LIFT.road;
    const s = z >= 3 ? north(x, z) : "sidewalk";
    return s && s !== "building" ? SURFACE_LIFT[s] : 0;
  },
  building: (x, z) => z >= 3 && north(x, z) === "building",
});
const axis = [
  { x: 0, z: 0 },
  { x: 60, z: 0 },
];
const one = (g: GroundLookup, district = "krakowskie") =>
  stretches(g, { district: () => district, junction: () => false }, [{ id: "w1", points: axis, reach: 3 }]).filter((s) => s.side === "left");

describe("the sidewalks' profiles (sidewalk-profile.ts)", () => {
  it("measures a sidewalk 3 m wide from the kerb, out to the building behind it", () => {
    const g = street((_, z) => (z < 6 ? "sidewalk" : "building"));
    const p = sideProfile(g, { x: 10, z: 0 }, { x: 0, z: 1 }, 3)!;
    expect(p.strip).toEqual({ surface: "sidewalk", width: 3, next: "building" });
    expect(p.end).toBe("building");
    expect([p.gap, p.step]).toEqual([0, 0]);
  });

  it("finds no walk where the kerb gives onto bare ground, and steps where slabs meet a footway", () => {
    expect(sideProfile(street(() => null), { x: 10, z: 0 }, { x: 0, z: 1 }, 3)).toBeNull();
    const p = sideProfile(street((_, z) => (z < 5 ? "sidewalk" : z < 8 ? "footway" : null)), { x: 10, z: 0 }, { x: 0, z: 1 }, 3)!;
    expect(p.step).toBeCloseTo(SURFACE_LIFT.sidewalk - SURFACE_LIFT.footway);
    expect(p.strip.surface).toBe("sidewalk");
  });

  it("puts a station every metre along the axis, the normal to its left", () => {
    const s = stations(axis);
    expect(s).toHaveLength(60);
    expect(s[0]!.left).toEqual({ x: -0, z: 1 });
  });
});

describe("the sidewalks' kinds (sidewalk-kinds.ts)", () => {
  it("finds a footway by the kerb in a district of slabs, and none on its rule's surface", () => {
    const patch = street((x, z) => (z < 6 ? (x > 20 && x < 30 ? "footway" : "sidewalk") : null));
    const found = surfacePatches(one(patch));
    expect(found).toHaveLength(1);
    expect(found[0]!.what).toMatch(/footway by the kerb over 9 m, krakowskie has sidewalk/);
    // In the Old Town slabs and the footway alike are off its sett and granite: one run, the whole stretch.
    expect(surfacePatches(one(patch, "stare-miasto")).map((f) => f.what)).toEqual(["w1 left: sidewalk by the kerb over 60 m, stare-miasto has cobble or square"]);
    expect(surfacePatches(one(street((_, z) => (z < 6 ? "sidewalk" : null))))).toEqual([]);
  });

  it("takes a mapped square's paving to the kerb as no patch", () => {
    const square = street((x, z) => (z < 6 ? (x > 20 && x < 30 ? "square" : "sidewalk") : null));
    const ctx = (mapped?: (x: number, z: number) => boolean) => ({ district: () => "krakowskie", junction: () => false, ...(mapped ? { mapped } : {}) });
    const left = (mapped?: (x: number, z: number) => boolean) => stretches(square, ctx(mapped), [{ id: "w1", points: axis, reach: 3 }]).filter((s) => s.side === "left");
    expect(surfacePatches(left())).toHaveLength(1);
    expect(surfacePatches(left((x) => x > 20 && x < 30))).toEqual([]);
  });

  it("finds bare ground between walks, inside the band and as a hole by the kerb", () => {
    const hole = street((x, z) => (z < 6 && !(x > 20 && x < 25) ? "sidewalk" : null));
    expect(gaps(one(hole)).map((f) => f.what)).toEqual(["w1 left: no walk by the kerb over 4 m between walks"]);
    const inside = street((_, z) => (z < 4.5 || (z > 5.5 && z < 7) ? "sidewalk" : null));
    expect(gaps(one(inside))[0]!.what).toMatch(/1.25 m of no walk inside the band/);
  });

  it("finds pieces of the walk at different lifts", () => {
    expect(steps(one(street((_, z) => (z < 5 ? "sidewalk" : z < 7 ? "square" : null))))).toHaveLength(1);
    expect(steps(one(street((_, z) => (z < 7 ? "sidewalk" : null))))).toEqual([]);
  });

  it("finds a strip narrowing with room beside it, and not where a building takes the room", () => {
    const narrow = (behind: "building" | null) => street((x, z) => (x > 30 && x < 36 ? (z < 4.5 ? "sidewalk" : behind) : z < 6 ? "sidewalk" : null));
    expect(widthJumps(one(narrow(null)))[0]!.what).toMatch(/the strip 1.50 m wide against the stretch's 3.00 m/);
    expect(widthJumps(one(narrow("building")))).toEqual([]);
  });

  it("cuts a street at another's junction", () => {
    const streets = [
      { id: "a", points: axis, reach: 3 },
      { id: "b", points: [{ x: 30, z: -20 }, { x: 30, z: 20 }], reach: 3 },
    ];
    const at = junctionTest(streets);
    expect([at("a", 30, 0), at("a", 35, 0), at("a", 40, 0), at("b", 30, 0)]).toEqual([true, true, false, true]);
    const g = street((_, z) => (z < 6 ? "sidewalk" : null));
    expect(stretches(g, { district: () => "krakowskie", junction: at }, [streets[0]!]).filter((s) => s.side === "left")).toHaveLength(2);
  });

  it("has a rule for each district of the map, and none for a place off it", () => {
    expect(Object.keys(SIDEWALK_RULES).sort()).toEqual(["krakowskie", "nabrzeze", "podzamcze", "stare-miasto"]);
    expect(ruleOf(undefined)).toBeUndefined();
  });
});
