import type { RandomPort } from "../ports/random-port";
import type { SpreadProfile } from "./spread";

export interface Weapon {
  readonly id: string;
  readonly name: string;
  readonly baseDamage: number;
  /** Seconds between shots. */
  readonly cooldown: number;
  readonly range: number;
  /** Aim cone of the weapon. Whether a shot connects is decided by where the ray lands. */
  readonly spread: SpreadProfile;
}

export interface AttackerProfile {
  readonly weapon: Weapon;
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

export const WEAPONS = {
  pistol: {
    id: "pistol",
    name: "Unity-9",
    baseDamage: 22,
    cooldown: 0.28,
    range: 60,
    spread: { base: 0.02, crouch: 0.4, move: 0.03, sprint: 0.06, bloomPerShot: 0.018, bloomMax: 0.06, recovery: 0.07 },
  },
  gangerSmg: {
    id: "gangerSmg",
    name: "Hebi SMG",
    baseDamage: 7,
    cooldown: 0.9,
    range: 18,
    spread: { base: 0.055, crouch: 0.6, move: 0.04, sprint: 0.08, bloomPerShot: 0.01, bloomMax: 0.03, recovery: 0.04 },
  },
} as const satisfies Record<string, Weapon>;

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
  const raw = (attacker.weapon.baseDamage + attacker.damageBonus) * (critical ? attacker.critMultiplier : 1) * ZONE_MULTIPLIERS[zone];
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
