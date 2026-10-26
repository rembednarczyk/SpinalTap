/** Additive modifiers contributed by cyberware and recovered memories. */
export interface StatModifiers {
  readonly critChance?: number;
  readonly critMultiplier?: number;
  readonly damageBonus?: number;
  readonly armor?: number;
  readonly moveSpeed?: number;
  readonly maxHp?: number;
}

export interface DerivedStats {
  readonly critChance: number;
  readonly critMultiplier: number;
  readonly damageBonus: number;
  readonly armor: number;
  /** Walk speed in m/s. */
  readonly moveSpeed: number;
  readonly maxHp: number;
}

export const BASE_STATS: DerivedStats = {
  critChance: 0.08,
  critMultiplier: 1.8,
  damageBonus: 0,
  armor: 2,
  moveSpeed: 4.2,
  maxHp: 100,
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
    }),
    base,
  );
