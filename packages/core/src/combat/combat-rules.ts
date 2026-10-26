import type { RandomPort } from "../ports/random-port";

export interface Weapon {
  readonly id: string;
  readonly name: string;
  readonly baseDamage: number;
  /** Seconds between shots. */
  readonly cooldown: number;
  readonly range: number;
  /** Probability in [0, 1] that a shot on target connects. */
  readonly accuracy: number;
}

export interface AttackerProfile {
  readonly weapon: Weapon;
  readonly critChance: number;
  readonly critMultiplier: number;
  readonly damageBonus: number;
}

export interface DefenderProfile {
  readonly armor: number;
}

export type AttackOutcome =
  | { readonly hit: false }
  | { readonly hit: true; readonly damage: number; readonly critical: boolean };

export const WEAPONS = {
  pistol: { id: "pistol", name: "Unity-9", baseDamage: 22, cooldown: 0.28, range: 60, accuracy: 0.92 },
  gangerSmg: { id: "gangerSmg", name: "Hebi SMG", baseDamage: 7, cooldown: 0.9, range: 18, accuracy: 0.55 },
} as const satisfies Record<string, Weapon>;

/** Minimum share of damage that always passes through armor. */
const MIN_DAMAGE_RATIO = 0.2;

/** Damage after flat armor reduction; never below MIN_DAMAGE_RATIO of the raw value. */
export const mitigate = (raw: number, armor: number): number =>
  Math.max(raw * MIN_DAMAGE_RATIO, raw - Math.max(0, armor));

/**
 * Resolves a single attack. Consumes exactly two random numbers (hit roll, crit roll)
 * regardless of the outcome, so the RNG stream stays aligned between runs.
 */
/** Extra multiplier for hits in the head zone. */
export const HEADSHOT_MULTIPLIER = 1.6;

export const resolveAttack = (
  attacker: AttackerProfile,
  defender: DefenderProfile,
  rng: RandomPort,
  headshot = false,
): AttackOutcome => {
  const hitRoll = rng.next();
  const critRoll = rng.next();
  if (hitRoll >= attacker.weapon.accuracy) return { hit: false };
  const critical = critRoll < attacker.critChance;
  const raw =
    (attacker.weapon.baseDamage + attacker.damageBonus) * (critical ? attacker.critMultiplier : 1) * (headshot ? HEADSHOT_MULTIPLIER : 1);
  return { hit: true, critical, damage: Math.round(mitigate(raw, defender.armor)) };
};

export interface Health {
  readonly current: number;
  readonly max: number;
}

export const applyDamage = (health: Health, amount: number): Health => ({
  max: health.max,
  current: Math.max(0, health.current - Math.max(0, amount)),
});

export const isDead = (health: Health): boolean => health.current <= 0;
