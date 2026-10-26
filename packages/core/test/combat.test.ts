import { describe, expect, it } from "vitest";
import { WEAPONS, applyDamage, isDead, mitigate, resolveAttack, type AttackerProfile } from "../src";
import { sequenceRng } from "./helpers";

const attacker: AttackerProfile = { weapon: WEAPONS.pistol, critChance: 0.1, critMultiplier: 2, damageBonus: 0 };

describe("combat rules", () => {
  it("misses when the hit roll is above accuracy", () => {
    expect(resolveAttack(attacker, { armor: 0 }, sequenceRng(0.99, 0))).toEqual({ hit: false });
  });

  it("deals base damage reduced by armor", () => {
    expect(resolveAttack(attacker, { armor: 5 }, sequenceRng(0.1, 0.5))).toEqual({ hit: true, critical: false, damage: 17 });
  });

  it("applies the crit multiplier on a crit roll", () => {
    expect(resolveAttack(attacker, { armor: 0 }, sequenceRng(0.1, 0.05))).toEqual({ hit: true, critical: true, damage: 44 });
  });

  it("always consumes two random numbers", () => {
    const values: number[] = [];
    const rng = { next: () => { values.push(1); return 0.999; } };
    resolveAttack(attacker, { armor: 0 }, rng);
    expect(values).toHaveLength(2);
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
