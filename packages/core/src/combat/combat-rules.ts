import type { RandomPort } from "../ports/random-port";

export interface AttackerProfile {
  /** Damage per projectile before zone, crit and armor. */
  readonly damage: number;
  /** Per-zone multipliers of the weapon; ZONE_MULTIPLIERS when absent. */
  readonly zones?: Readonly<Record<HitZone, number>>;
  readonly critChance: number;
  readonly critMultiplier: number;
  readonly damageBonus: number;
}

/** Body part a hitscan ray landed on. */
export type HitZone = "head" | "torso" | "arm" | "leg";

export const HIT_ZONES: readonly HitZone[] = ["head", "torso", "arm", "leg"];

/** Damage multiplier per body part. Head is the weak spot, limbs take less than the torso. */
export const ZONE_MULTIPLIERS: Readonly<Record<HitZone, number>> = { head: 2, torso: 1, arm: 0.65, leg: 0.7 };

export interface DefenderProfile {
  /** Flat armor on every zone. */
  readonly armor: number;
  /** Extra armor on single zones, e.g. a vest on the torso or plating under the scalp. */
  readonly zoneArmor?: Readonly<Partial<Record<HitZone, number>>>;
}

export interface AttackOutcome {
  readonly damage: number;
  readonly critical: boolean;
  readonly zone: HitZone;
}

/** Minimum share of damage that always passes through armor. */
const MIN_DAMAGE_RATIO = 0.2;

/** Damage after flat armor reduction; never below MIN_DAMAGE_RATIO of the raw value. */
export const mitigate = (raw: number, armor: number): number =>
  Math.max(raw * MIN_DAMAGE_RATIO, raw - Math.max(0, armor));

/** Armor that protects a given zone: the flat value plus the zone's own. */
export const armorFor = (defender: DefenderProfile, zone: HitZone): number => defender.armor + (defender.zoneArmor?.[zone] ?? 0);

/** Seconds from starting to draw a holstered weapon to the first allowed shot. */
export const DRAW_TIME = 0.4;

/**
 * Damage of a shot that landed on `zone`. Consumes exactly one random number (the crit roll),
 * so the RNG stream stays aligned between runs. Missing is decided earlier, by the spread
 * cone and the hitboxes.
 */
export const resolveAttack = (attacker: AttackerProfile, defender: DefenderProfile, rng: RandomPort, zone: HitZone = "torso"): AttackOutcome => {
  const critical = rng.next() < attacker.critChance;
  const raw = (attacker.damage + attacker.damageBonus) * (critical ? attacker.critMultiplier : 1) * (attacker.zones ?? ZONE_MULTIPLIERS)[zone];
  return { critical, zone, damage: Math.round(mitigate(raw, armorFor(defender, zone))) };
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
