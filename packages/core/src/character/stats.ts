/** Additive modifiers contributed by cyberware, recovered memories, clothes, buffs, the level and the attributes. */
export interface StatModifiers {
  readonly critChance?: number;
  readonly critMultiplier?: number;
  readonly damageBonus?: number;
  readonly armor?: number;
  readonly moveSpeed?: number;
  readonly maxHp?: number;
  /** Share of weapon spread removed, 0..MAX_AIM_STABILITY (see combat/spread). */
  readonly aimStability?: number;
  /** Extra armor on head hits only. */
  readonly headArmor?: number;
  /** Share added to melee damage (Might, ADR-0059). */
  readonly meleeDamage?: number;
  /** Extra armor on every zone a worn garment protects (Tech, ADR-0059). */
  readonly garmentArmor?: number;
}

export interface DerivedStats {
  readonly critChance: number;
  readonly critMultiplier: number;
  readonly damageBonus: number;
  readonly armor: number;
  /** Walk speed in m/s. */
  readonly moveSpeed: number;
  readonly maxHp: number;
  readonly aimStability: number;
  readonly headArmor: number;
  readonly meleeDamage: number;
  readonly garmentArmor: number;
}

/** Cap on aim stability: implants steady the hand, they never make a weapon a laser. */
export const MAX_AIM_STABILITY = 0.6;

export const BASE_STATS: DerivedStats = {
  critChance: 0.08,
  critMultiplier: 1.8,
  damageBonus: 0,
  armor: 2,
  // A run of 3.5 m/s (12.6 km/h, user's notes of 21.11: 4.2 was too fast from the start), about the
  // run clip's own pace (3.65 m/s at 171 steps a minute); the sprint is 1.7 times it (`SPRINT_MULTIPLIER`).
  moveSpeed: 3.5,
  maxHp: 100,
  aimStability: 0,
  headArmor: 0,
  meleeDamage: 0,
  garmentArmor: 0,
};

export const combineModifiers = (base: DerivedStats, mods: readonly StatModifiers[]): DerivedStats =>
  mods.reduce<DerivedStats>(
    (acc, m) => ({
      critChance: Math.min(1, acc.critChance + (m.critChance ?? 0)),
      critMultiplier: acc.critMultiplier + (m.critMultiplier ?? 0),
      damageBonus: acc.damageBonus + (m.damageBonus ?? 0),
      armor: acc.armor + (m.armor ?? 0),
      moveSpeed: acc.moveSpeed + (m.moveSpeed ?? 0),
      maxHp: acc.maxHp + (m.maxHp ?? 0),
      aimStability: Math.min(MAX_AIM_STABILITY, acc.aimStability + (m.aimStability ?? 0)),
      headArmor: acc.headArmor + (m.headArmor ?? 0),
      meleeDamage: acc.meleeDamage + (m.meleeDamage ?? 0),
      garmentArmor: acc.garmentArmor + (m.garmentArmor ?? 0),
    }),
    base,
  );
