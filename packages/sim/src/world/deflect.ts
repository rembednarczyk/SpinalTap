import { type DefenderProfile, type RandomPort, type Vec3, type WeaponStats, applyDamage, directionFromAngles, hasPerk, resolveAttack } from "@seki/core";
import type { Entity } from "./components";
import type { SimContext } from "./context";
import { aimOrigin, hitscan } from "./hitscan";
import { isEngaged, noteViolence } from "./street";

/**
 * Bullet deflection (ADR-0033, Bullet Deflect in Cyberpunk 2.0): with the Tsubame reflex, a shot
 * that a raised melee guard faces while the guard's stamina is above DEFLECT_THRESHOLD flies back
 * along the defender's line of sight (the crosshair) instead of hurting her. It may hit the
 * shooter, someone else or a wall. The return shot cannot crit; its one random number goes
 * through `resolveAttack` and the RandomPort like any hit.
 */

/** Stamina the guard needs to send a bullet back (a third, as in the original perk). */
export const DEFLECT_THRESHOLD = 1 / 3;
/** Stamina one trigger pull costs (shared by all pellets of a shotgun blast). */
export const DEFLECT_COST = 0.12;

/** Does the defender send this shot back? Only the player has implants. */
export const deflects = (ctx: SimContext, target: Entity): boolean =>
  !!target.player &&
  !!target.combatant?.stats?.melee &&
  (target.melee?.guard ?? false) &&
  (target.perks?.stamina ?? 1) > DEFLECT_THRESHOLD &&
  hasPerk(ctx.state.domain.character.cyberware, "deflect");

export interface DeflectedShot {
  readonly shooter: Entity;
  readonly defender: Entity;
  /** Where the guard caught the bullet. */
  readonly at: Vec3;
  readonly weapon: WeaponStats;
}

/**
 * Sends one pellet back from the defender's aim origin along her facing and pitch. A body it
 * meets takes the weapon's damage (no crit, the hit zone's multiplier, its armour) from the
 * defender, as if she had fired it.
 */
export const deflectShot = (ctx: SimContext, shot: DeflectedShot, defenderOf: (e: Entity) => DefenderProfile, rng: RandomPort): void => {
  const { defender, weapon } = shot;
  if (defender.perks) defender.perks.stamina = Math.max(0, defender.perks.stamina - DEFLECT_COST / Math.max(1, weapon.pellets));
  const origin = aimOrigin(defender, ctx.state.domain.preferences.cameraMode);
  const result = hitscan(ctx.world, origin, directionFromAngles(defender.yaw, defender.pitch), weapon.range, defender.id);
  const target = result.entity;
  ctx.bus.emit("ProjectileReflected", { defenderId: defender.id, attackerId: shot.shooter.id, at: shot.at, to: result.point, hitEntity: target?.id ?? null });
  if (!target?.health || !result.zone) return;
  const outcome = resolveAttack({ damage: weapon.damage, zones: weapon.zones, critChance: 0, critMultiplier: 1, damageBonus: 0 }, defenderOf(target), rng, result.zone);
  noteViolence(ctx, target, isEngaged(target), result.point);
  target.health = applyDamage(target.health, outcome.damage);
  target.lastHitBy = defender.id;
  if (target.ai) target.ai.alerted = true;
  ctx.bus.emit("DamageDealt", { sourceId: defender.id, targetId: target.id, amount: outcome.damage, critical: false, zone: outcome.zone, at: result.point });
};
