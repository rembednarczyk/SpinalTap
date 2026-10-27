import { describe, expect, it } from "vitest";
import { WEAPON_CATALOG, angleTo, effectiveWeapon, guardOutcome, meleeReach, nextStrike, spreadAngle, strikeAt, strikeZone } from "../src";

const BATON = WEAPON_CATALOG.baton.melee;
const BLOCK = BATON.block;
const NORTH = { x: 0, z: 0, yaw: 0 };

describe("aim down sights in the spread cone (ADR-0019)", () => {
  const still = { crouch: 0, moving: 0, sprinting: false, bloom: 0, aimStability: 0 };
  const pistol = WEAPON_CATALOG.unity9;

  it("scales the whole cone with the eased aim", () => {
    const hip = spreadAngle(pistol.spread, still);
    expect(spreadAngle(pistol.spread, { ...still, aim: 1, aimMultiplier: pistol.ads.spread })).toBeCloseTo(hip * pistol.ads.spread);
    expect(spreadAngle(pistol.spread, { ...still, aim: 0.5, aimMultiplier: pistol.ads.spread })).toBeCloseTo(hip * (1 + (pistol.ads.spread - 1) * 0.5));
    expect(spreadAngle(pistol.spread, { ...still, aim: 1 })).toBeCloseTo(hip);
  });

  it("zooms more the longer the gun: pistol a little, SMG more, rifle most", () => {
    const zoom = (id: "unity9" | "hebi_smg" | "tessen_ar5") => effectiveWeapon(id, "common").ads!.zoom;
    expect(zoom("unity9")).toBeGreaterThan(zoom("hebi_smg"));
    expect(zoom("hebi_smg")).toBeGreaterThan(zoom("tessen_ar5"));
    expect(effectiveWeapon("baton", "common").ads).toBeNull();
    expect(effectiveWeapon("baton", "common").melee).toBe(BATON);
  });
});

describe("melee reach and zones (ADR-0019)", () => {
  it("measures the angle from the facing, signed and wrapped", () => {
    expect(angleTo(NORTH, 0, 5)).toBeCloseTo(0);
    expect(angleTo(NORTH, 5, 0)).toBeCloseTo(Math.PI / 2);
    expect(angleTo({ x: 0, z: 0, yaw: Math.PI * 1.9 }, 0, 5)).toBeCloseTo(Math.PI * 0.1);
  });

  it("reaches bodies in range and in the arc, counting their width", () => {
    expect(meleeReach(NORTH, 0, 2, 0.38, 2.2, BATON.arc)).toMatchObject({ distance: 2, angle: 0 });
    // The edge is in reach although the centre is not.
    expect(meleeReach(NORTH, 0, 2.5, 0.38, 2.2, BATON.arc)).not.toBeNull();
    expect(meleeReach(NORTH, 0, 2.7, 0.38, 2.2, BATON.arc)).toBeNull();
    expect(meleeReach(NORTH, 0, -1, 0.38, 2.2, BATON.arc)).toBeNull();
    expect(meleeReach(NORTH, 1.5, 0.3, 0.38, 2.2, BATON.arc)).toBeNull();
    expect(meleeReach(NORTH, 1, 1.4, 0.38, 2.2, BATON.arc)).not.toBeNull();
    // Overlapping bodies are always in the arc.
    expect(meleeReach(NORTH, 0.2, -0.1, 0.38, 2.2, BATON.arc)).not.toBeNull();
  });

  it("picks the zone by the height the blow crosses and catches an arm at the arc's edge", () => {
    expect(strikeZone(0.95, 0)).toBe("head");
    expect(strikeZone(0.7, 0)).toBe("torso");
    expect(strikeZone(0.7, 0.8)).toBe("arm");
    expect(strikeZone(0.7, -0.8)).toBe("arm");
    expect(strikeZone(0.3, 0)).toBe("leg");
  });
});

describe("guard and combo (ADR-0019)", () => {
  it("blocks melee from the front, parries in the window, takes part of a shot", () => {
    expect(guardOutcome(BLOCK, true, 0, "melee", 0.2)).toEqual({ blocked: true, parried: false, multiplier: BLOCK.melee });
    expect(guardOutcome(BLOCK, true, 0.1, "melee", 0.2)).toEqual({ blocked: true, parried: true, multiplier: 0 });
    expect(guardOutcome(BLOCK, true, 0.1, "projectile", 0)).toEqual({ blocked: true, parried: false, multiplier: BLOCK.projectile });
    expect(guardOutcome(BLOCK, true, 0.1, "melee", Math.PI)).toEqual({ blocked: false, parried: false, multiplier: 1 });
    expect(guardOutcome(BLOCK, false, 0.1, "melee", 0)).toMatchObject({ blocked: false, multiplier: 1 });
    expect(guardOutcome(null, true, 0.1, "melee", 0)).toMatchObject({ blocked: false, multiplier: 1 });
  });

  it("goes on with the combo inside its window and starts over after the finisher", () => {
    expect(nextStrike(BATON, 0, 0)).toBe(0);
    expect(nextStrike(BATON, 0, 0.2)).toBe(1);
    expect(nextStrike(BATON, 1, 0.2)).toBe(2);
    expect(nextStrike(BATON, 2, 0.2)).toBe(0);
    expect(strikeAt(BATON, 5)).toBe(BATON.combo[2]);
    expect(strikeAt(BATON, -1)).toBe(BATON.combo[2]);
    expect(BATON.combo[2].damage).toBeGreaterThan(BATON.combo[0].damage);
    // The NPC windup is a telegraph: longer than any of the player's own.
    for (const s of BATON.combo) expect(BATON.npcWindup).toBeGreaterThan(s.windup);
  });
});
