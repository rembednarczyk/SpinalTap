import type { BlockProfile, MeleeProfile, MeleeStrike } from "../items/catalog";
import type { HitZone } from "./combat-rules";

/**
 * Melee rules (ADR-0019): who a swing reaches, which body part it lands on, what a guard
 * does with it, and how the combo goes on. Pure functions over plain numbers; the sim feeds
 * them positions and timers.
 */

/** A raised guard opens the parry window only if the previous raise was at least this long ago. */
export const PARRY_COOLDOWN = 0.8;
/** Walking speed multiplier while staggered. */
export const STAGGER_MOVE = 0.35;

export interface Facing {
  readonly x: number;
  readonly z: number;
  /** Rotation around Y; forward is (sin yaw, cos yaw). */
  readonly yaw: number;
}

const wrap = (a: number): number => {
  let d = a % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/** Signed horizontal angle from `from`'s facing to the point (x, z), in [-π, π]. */
export const angleTo = (from: Facing, x: number, z: number): number => wrap(Math.atan2(x - from.x, z - from.z) - from.yaw);

export interface MeleeReach {
  /** Distance between the centres on the ground plane. */
  readonly distance: number;
  /** Signed angle from the attacker's facing to the target. */
  readonly angle: number;
}

/**
 * Does a swing of `range` metres over the arc of half-angle `arc` reach a body of `radius`
 * standing at (x, z)? The body's own width counts: its edge may be in range and in the arc
 * while its centre is not.
 */
export const meleeReach = (attacker: Facing, x: number, z: number, radius: number, range: number, arc: number): MeleeReach | null => {
  const distance = Math.hypot(x - attacker.x, z - attacker.z);
  if (distance - radius > range) return null;
  const angle = angleTo(attacker, x, z);
  const widened = arc + (distance > radius ? Math.asin(Math.min(1, radius / distance)) : Math.PI);
  return Math.abs(angle) <= widened ? { distance, angle } : null;
};

/**
 * Body part a swing lands on. `height` is where the blade crosses the target, as a share of
 * its body height (the same bands as the hitboxes, ADR-0016); `side` is the target's angle in
 * the arc as a share of the arc (0 dead ahead, 1 at its edge). A blow at chest height near
 * the edge of the arc catches an arm.
 */
export const strikeZone = (height: number, side: number): HitZone => {
  if (height >= 0.875) return "head";
  if (height >= 0.5) return Math.abs(side) > 0.6 ? "arm" : "torso";
  return "leg";
};

export interface GuardOutcome {
  /** The guard faced the blow (melee or shot). */
  readonly blocked: boolean;
  /** A melee blow in the parry window: no damage, the attacker is stunned. */
  readonly parried: boolean;
  /** Damage multiplier: 1 unblocked, the block's share when blocked, 0 when parried. */
  readonly multiplier: number;
}

const OPEN: GuardOutcome = { blocked: false, parried: false, multiplier: 1 };

/**
 * What a guard does with an attack coming from `angle` off the defender's facing. Shots are
 * blocked only partially and never parried.
 */
export const guardOutcome = (block: BlockProfile | null, guarding: boolean, parryLeft: number, kind: "melee" | "projectile", angle: number): GuardOutcome => {
  if (!block || !guarding || Math.abs(angle) > block.arc) return OPEN;
  if (kind === "projectile") return { blocked: true, parried: false, multiplier: block.projectile };
  if (parryLeft > 0) return { blocked: true, parried: true, multiplier: 0 };
  return { blocked: true, parried: false, multiplier: block.melee };
};

/** Index of the next swing: the combo goes on inside its window, otherwise starts over. */
export const nextStrike = (profile: MeleeProfile, last: number, comboLeft: number): number =>
  comboLeft > 0 ? (last + 1) % profile.combo.length : 0;

/** The strike at `index` (wrapping), so a stale index never reads past the combo. */
export const strikeAt = (profile: MeleeProfile, index: number): MeleeStrike =>
  profile.combo[((index % profile.combo.length) + profile.combo.length) % profile.combo.length] ?? profile.combo[0];
