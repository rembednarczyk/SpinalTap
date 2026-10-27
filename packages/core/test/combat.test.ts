import { describe, expect, it } from "vitest";
import {
  BASE_STATS,
  CYBERWARE_CATALOG,
  MAX_AIM_STABILITY,
  WEAPON_CATALOG,
  ZONE_MULTIPLIERS,
  addBloom,
  applyDamage,
  armorFor,
  combineModifiers,
  dot,
  isDead,
  mitigate,
  normalize,
  recoverBloom,
  resolveAttack,
  sampleCone,
  spreadAngle,
  type AttackerProfile,
  type HitZone,
  type ShooterState,
} from "../src";
import { sequenceRng } from "./helpers";

const attacker: AttackerProfile = { damage: WEAPON_CATALOG.unity9.damage, critChance: 0.1, critMultiplier: 2, damageBonus: 0 };

describe("combat rules", () => {
  it("deals base damage reduced by armor on a torso hit", () => {
    expect(resolveAttack(attacker, { armor: 5 }, sequenceRng(0.5))).toEqual({ critical: false, zone: "torso", damage: 17 });
  });

  it("applies the crit multiplier on a crit roll", () => {
    expect(resolveAttack(attacker, { armor: 0 }, sequenceRng(0.05))).toEqual({ critical: true, zone: "torso", damage: 44 });
  });

  it("always consumes exactly one random number", () => {
    let calls = 0;
    const rng = {
      next: () => {
        calls += 1;
        return 0.999;
      },
    };
    resolveAttack(attacker, { armor: 0 }, rng, "head");
    expect(calls).toBe(1);
  });

  it("never lets armor reduce damage below the floor", () => {
    expect(mitigate(10, 100)).toBe(2);
    expect(mitigate(10, -5)).toBe(10);
  });

  it("clamps health at zero and ignores negative damage", () => {
    const h = applyDamage({ current: 10, max: 100 }, 25);
    expect(h.current).toBe(0);
    expect(isDead(h)).toBe(true);
    expect(applyDamage({ current: 10, max: 100 }, -5).current).toBe(10);
  });
});

describe("hit zones", () => {
  const plain = { ...attacker, critChance: 0 };
  const dmg = (zone: HitZone, armor = 0) => resolveAttack(plain, { armor }, sequenceRng(0.9), zone).damage;

  it("weights damage by body part: head 2.0, torso 1.0, limbs below", () => {
    expect(ZONE_MULTIPLIERS).toEqual({ head: 2, torso: 1, arm: 0.65, leg: 0.7 });
    expect(dmg("head")).toBe(44);
    expect(dmg("torso")).toBe(22);
    expect(dmg("arm")).toBe(Math.round(22 * 0.65));
    expect(dmg("leg")).toBe(Math.round(22 * 0.7));
  });

  it("zone armor protects only its zone", () => {
    const vest = { armor: 1, zoneArmor: { torso: 3 } };
    expect(armorFor(vest, "torso")).toBe(4);
    expect(armorFor(vest, "head")).toBe(1);
    expect(resolveAttack(plain, vest, sequenceRng(0.9), "torso").damage).toBe(18);
    expect(resolveAttack(plain, vest, sequenceRng(0.9), "leg").damage).toBe(Math.round(22 * 0.7 - 1));
  });

  it("the subdermal weave covers the head as well", () => {
    const stats = combineModifiers(BASE_STATS, [CYBERWARE_CATALOG.subdermal_weave.modifiers]);
    expect(stats.headArmor).toBe(3);
    expect(resolveAttack(plain, { armor: 0, zoneArmor: { head: stats.headArmor } }, sequenceRng(0.9), "head").damage).toBe(41);
  });
});

describe("weapon spread", () => {
  const p = WEAPON_CATALOG.unity9.spread;
  const still: ShooterState = { crouch: 0, moving: 0, sprinting: false, bloom: 0, aimStability: 0 };

  it("is wider moving, narrower standing still and clearly narrowest crouched", () => {
    const standing = spreadAngle(p, still);
    const crouched = spreadAngle(p, { ...still, crouch: 1 });
    const walking = spreadAngle(p, { ...still, moving: 1 });
    const sprinting = spreadAngle(p, { ...still, moving: 1, sprinting: true });
    expect(standing).toBeCloseTo(p.base);
    expect(crouched).toBeLessThan(standing * 0.5);
    expect(walking).toBeGreaterThan(standing);
    expect(sprinting).toBeGreaterThan(walking);
    // Halfway down is halfway between.
    expect(spreadAngle(p, { ...still, crouch: 0.5 })).toBeCloseTo((standing + crouched) / 2);
  });

  it("moving crouched costs less than moving upright", () => {
    const upright = spreadAngle(p, { ...still, moving: 1 }) - spreadAngle(p, still);
    const low = spreadAngle(p, { ...still, moving: 1, crouch: 1 }) - spreadAngle(p, { ...still, crouch: 1 });
    expect(low).toBeLessThan(upright);
  });

  it("aim stability from implants narrows the cone, up to a cap", () => {
    const withGrip = combineModifiers(BASE_STATS, [CYBERWARE_CATALOG.steady_grip.modifiers]);
    expect(withGrip.aimStability).toBeCloseTo(0.3);
    expect(spreadAngle(p, { ...still, aimStability: withGrip.aimStability })).toBeCloseTo(p.base * 0.7);
    const stacked = combineModifiers(BASE_STATS, [{ aimStability: 0.5 }, { aimStability: 0.5 }]);
    expect(stacked.aimStability).toBe(MAX_AIM_STABILITY);
    expect(BASE_STATS.aimStability).toBe(0);
  });

  it("blooms with every shot up to a cap and recovers over time", () => {
    let bloom = 0;
    for (let i = 0; i < 10; i++) bloom = addBloom(p, bloom);
    expect(bloom).toBe(p.bloomMax);
    expect(spreadAngle(p, { ...still, bloom })).toBeCloseTo(p.base + p.bloomMax);
    bloom = recoverBloom(p, bloom, 0.25);
    expect(bloom).toBeCloseTo(p.bloomMax - p.recovery * 0.25);
    expect(recoverBloom(p, bloom, 10)).toBe(0);
  });

  it("samples directions inside the cone with exactly two random numbers", () => {
    const dir = normalize({ x: 0.3, y: -0.2, z: 1 });
    const angle = 0.05;
    let calls = 0;
    sampleCone(dir, angle, {
      next: () => {
        calls += 1;
        return 0.5;
      },
    });
    expect(calls).toBe(2);
    for (const [u, v] of [
      [0, 0],
      [1, 0],
      [1, 0.25],
      [0.5, 0.75],
      [0.999, 0.5],
    ] as const) {
      const out = sampleCone(dir, angle, sequenceRng(u, v));
      expect(Math.hypot(out.x, out.y, out.z)).toBeCloseTo(1);
      expect(Math.acos(Math.min(1, dot(out, dir)))).toBeLessThanOrEqual(angle + 1e-9);
    }
    // u = 1 lands on the rim of the cone.
    expect(Math.acos(dot(sampleCone(dir, angle, sequenceRng(1, 0.3)), dir))).toBeCloseTo(angle);
    expect(sampleCone(dir, 0, sequenceRng(0.7, 0.2))).toEqual(dir);
    // A straight-down aim uses the other helper axis.
    const down = sampleCone({ x: 0, y: -1, z: 0 }, angle, sequenceRng(1, 0.1));
    expect(Math.acos(-down.y)).toBeCloseTo(angle);
  });
});
