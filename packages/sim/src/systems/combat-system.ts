import {
  ENEMY_TYPES,
  type DefenderProfile,
  type EnemyTypeId,
  type HitZone,
  defenseOf,
  outfitDefense,
  wearGarments,
  wornGarments,
  type DerivedStats,
  type DialogueInterruptReason,
  type Vec3,
  addBloom,
  applyDamage,
  angleTo,
  directionFromAngles,
  guardOutcome,
  resolveAttack,
  sampleCone,
  spreadAngle,
  type RandomPort,
} from "@seki/core";
import type { Entity } from "../world/components";
import type { SimContext, System } from "../world/context";
import { crouchOf } from "../world/hitboxes";
import { aimOrigin, chestOf, hitscan, type HitscanResult } from "../world/hitscan";
import { consumeRound, loadedOf, readyToFire } from "../world/player-weapon";
import { playerStatsOf } from "./player-control-system";
import { disturb, isEngaged, noteViolence, offend, playerEngaged } from "../world/street";
import { deflectShot, deflects } from "../world/deflect";
import { playerHeld } from "../world/takedown";

/** Crit chances of NPC attacks (shots and swings). */
export const NPC_CRIT = { critChance: 0.05, critMultiplier: 1.5, damageBonus: 0 } as const;

/** An enemy firing this close to the player breaks off a conversation (metres). */
export const GUNFIRE_INTERRUPT_RADIUS = 8;
/** A shot passing this close to the player's chest counts as fired at them (metres). */
const NEAR_MISS_RADIUS = 1.5;
/** Armor of each enemy type's fixed outfit, resolved once. */
const OUTFIT_DEFENSE = new Map<EnemyTypeId, DefenderProfile>();
const enemyDefense = (type: EnemyTypeId): DefenderProfile => {
  let d = OUTFIT_DEFENSE.get(type);
  if (!d) OUTFIT_DEFENSE.set(type, (d = outfitDefense(ENEMY_TYPES[type].outfit)));
  return d;
};

export interface ShotRequest {
  readonly shooter: Entity;
  readonly origin: Vec3;
  /** Where the shooter aims; the shot leaves somewhere inside the cone around it. */
  readonly dir: Vec3;
  /** Half-angle of the aim cone in radians (see `aimSpreadOf`). */
  readonly spread: number;
  readonly critChance: number;
  readonly critMultiplier: number;
  readonly damageBonus: number;
}

/**
 * Armor per zone (ADR-0015): the player's implants and memories everywhere plus the clothes on
 * the zone hit; an enemy's fixed outfit; nothing for anyone else.
 */
export const defenderOf = (ctx: SimContext, target: Entity): DefenderProfile => {
  if (target.player) {
    const { inventory, equipment } = ctx.state.domain;
    return defenseOf(playerStatsOf(ctx.state.domain), wornGarments(inventory, equipment));
  }
  return target.enemy ? enemyDefense(target.enemy.type) : { armor: 0 };
};

/** A hit on the player wears the clothes covering that zone. */
export const wearPlayerClothes = (ctx: SimContext, zone: HitZone): void => {
  const domain = ctx.state.domain;
  const inventory = wearGarments(domain.inventory, domain.equipment, zone);
  if (inventory !== domain.inventory) ctx.state.domain = { ...domain, inventory };
};

/**
 * Current aim cone of a combatant: weapon, stance, movement, bloom and (for the player)
 * implants. The HUD crosshair shows the same number.
 */
export const aimSpreadOf = (e: Entity, stats: Pick<DerivedStats, "moveSpeed" | "aimStability"> | null): number => {
  const weapon = e.combatant?.stats;
  if (!e.combatant || !weapon) return 0;
  const speed = e.velocity ? Math.hypot(e.velocity.x, e.velocity.z) : 0;
  return spreadAngle(weapon.spread, {
    crouch: crouchOf(e),
    moving: stats ? speed / stats.moveSpeed : 0,
    sprinting: e.posture?.sprinting ?? false,
    bloom: e.combatant.bloom,
    aimStability: stats?.aimStability ?? 0,
    aim: e.posture?.aim ?? 0,
    aimMultiplier: weapon.ads?.spread ?? 1,
  });
};

/** Distance from a point to the segment a-b. */
const pointSegmentDistance = (p: Vec3, a: Vec3, b: Vec3): number => {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const len2 = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z;
  const t = len2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y + (p.z - a.z) * ab.z) / len2));
  return Math.hypot(a.x + ab.x * t - p.x, a.y + ab.y * t - p.y, a.z + ab.z * t - p.z);
};

/**
 * Violence near the player: remembered as the last threat (the app waits for calm before a
 * flashback) and, during a conversation or at the shop counter, ends it (ADR-0016).
 */
export const threaten = (ctx: SimContext, reason: DialogueInterruptReason, sourceId: number): void => {
  ctx.session.lastThreat = { tick: ctx.tick, sourceId };
  if (!ctx.session.dialogueActive || ctx.session.gameOver) return;
  ctx.session.dialogueActive = false;
  ctx.bus.emit("DialogueInterrupted", { reason, sourceId });
};

/**
 * Fires one trigger pull: every pellet (one for most weapons) gets its own direction in the cone
 * (two random numbers), ray and, on a hit, `resolveAttack` (one more). Uses a round, sets the
 * cooldown, adds bloom, emits events. Shared by player and AI. The result is the first pellet's.
 */
export const fireShot = (ctx: SimContext, shot: ShotRequest, rng: RandomPort): HitscanResult => {
  const combatant = shot.shooter.combatant;
  const weapon = combatant?.stats;
  if (!combatant || !weapon) throw new Error("fireShot: shooter has no weapon");
  combatant.cooldown = weapon.interval;
  consumeRound(ctx, shot.shooter);
  // Fire opened outside a fight is a crime once someone sees it (ADR-0029); judged before the shot alerts anyone.
  const crime = !!shot.shooter.player && !playerEngaged(ctx, shot.shooter);
  let first: HitscanResult | null = null;
  let hurtPlayer = false;
  let farthest: Vec3 = shot.origin;
  for (let i = 0; i < weapon.pellets; i++) {
    const dir = sampleCone(shot.dir, shot.spread, rng);
    const result = hitscan(ctx.world, shot.origin, dir, weapon.range, shot.shooter.id);
    if (!first) {
      first = result;
      ctx.bus.emit("ShotFired", { shooterId: shot.shooter.id, from: shot.origin, to: result.point, hitEntity: result.entity?.id ?? null });
    }
    farthest = result.point;
    const target = result.entity;
    if (!target?.health || !result.zone) continue;
    if (hitWithPellet(ctx, shot, weapon, { target, health: target.health, point: result.point, zone: result.zone }, rng)) hurtPlayer = true;
  }
  combatant.bloom = addBloom(weapon.spread, combatant.bloom);
  alertNearbyGangers(ctx, shot.origin, weapon.alertRadius);
  disturb(ctx, "gunshot", shot.origin, weapon.alertRadius, shot.shooter.id);
  if (crime) offend(ctx, "gunfire", shot.origin);
  const result = first ?? { distance: 0, point: farthest, entity: null, zone: null };
  if (!shot.shooter.player) warnPlayer(ctx, shot, hurtPlayer, result.point);
  return result;
};

/**
 * One pellet hits `target` in `zone`: a raised melee guard takes some of a shot from the front
 * (ADR-0019), `resolveAttack` draws the crit (one random number), the damage lands and any AI
 * hit is alerted. Returns whether the player was hurt. A dashing player is not there for the
 * bullet, and a guard with the Tsubame reflex sends it back instead (ADR-0033).
 */
const hitWithPellet = (
  ctx: SimContext,
  shot: ShotRequest,
  weapon: NonNullable<NonNullable<Entity["combatant"]>["stats"]>,
  { target, health, point, zone }: { target: Entity; health: NonNullable<Entity["health"]>; point: Vec3; zone: HitZone },
  rng: RandomPort,
): boolean => {
  if (target.player && (target.perks?.iframes ?? 0) > 0) return false;
  const guard = guardAgainst(target, shot.origin, "projectile");
  if (guard.blocked && deflects(ctx, target)) {
    deflectShot(ctx, { shooter: shot.shooter, defender: target, at: point, weapon }, (e) => defenderOf(ctx, e), rng);
    return false;
  }
  const outcome = resolveAttack(
    { damage: weapon.damage * guard.multiplier, zones: weapon.zones, critChance: shot.critChance, critMultiplier: shot.critMultiplier, damageBonus: shot.damageBonus * guard.multiplier },
    defenderOf(ctx, target),
    rng,
    zone,
  );
  if (guard.blocked) ctx.bus.emit("AttackBlocked", { attackerId: shot.shooter.id, defenderId: target.id, parried: false, kind: "projectile", at: point });
  if (shot.shooter.player) noteViolence(ctx, target, isEngaged(target), point);
  target.health = applyDamage(health, outcome.damage);
  target.lastHitBy = shot.shooter.id;
  if (target.player) wearPlayerClothes(ctx, outcome.zone);
  // Getting shot provokes any AI, whatever it thought of the shooter before.
  if (target.ai) target.ai.alerted = true;
  ctx.bus.emit("DamageDealt", {
    sourceId: shot.shooter.id,
    targetId: target.id,
    amount: outcome.damage,
    critical: outcome.critical,
    zone: outcome.zone,
    at: point,
  });
  return !!target.player;
};

/** An NPC's shot that hurt the player, was fired close by or passed near their chest is a threat (ADR-0016). */
const warnPlayer = (ctx: SimContext, shot: ShotRequest, hurtPlayer: boolean, impact: Vec3): void => {
  const player = ctx.world.with("player").first;
  if (hurtPlayer) threaten(ctx, "damage", shot.shooter.id);
  else if (player) {
    const close = Math.hypot(player.position.x - shot.origin.x, player.position.z - shot.origin.z) <= GUNFIRE_INTERRUPT_RADIUS;
    const nearMiss = pointSegmentDistance(chestOf(player), shot.origin, impact) <= NEAR_MISS_RADIUS;
    if (close || nearMiss) threaten(ctx, "gunfire", shot.shooter.id);
  }
};

export const alertNearbyGangers = (ctx: SimContext, at: { x: number; z: number }, radius: number): void => {
  for (const g of ctx.world.with("ai")) {
    // Someone knocked out hears nothing (ADR-0065).
    if (!g.unconscious && Math.hypot(g.position.x - at.x, g.position.z - at.z) <= radius) g.ai.alerted = true;
  }
};

/**
 * What the target's guard does with an attack from `from`: its melee weapon's block profile,
 * whether the guard is up and the parry window, against the angle off its facing.
 */
export const guardAgainst = (target: Entity, from: Vec3, kind: "melee" | "projectile") => {
  const block = target.combatant?.stats?.melee?.block ?? null;
  const m = target.melee;
  return guardOutcome(block, m?.guard ?? false, m?.parry ?? 0, kind, angleTo({ x: target.position.x, z: target.position.z, yaw: target.yaw }, from.x, from.z));
};

/** The player's trigger. Timers, holster, slots and reloads are handled by `weapon` just before. */
export const combatSystem: System = {
  name: "combat",
  run(ctx) {
    if (playerHeld(ctx) || !ctx.input.fire) return;
    for (const p of ctx.world.with("player", "combatant")) {
      // Melee weapons swing in the melee system; nobody fires while staggered or on a ladder.
      if (p.combatant.stats?.melee || (p.melee?.stagger ?? 0) > 0 || p.climb || p.mantle) continue;
      if (!readyToFire(p.combatant, loadedOf(ctx, p))) continue;
      // A shotgun with a shell in gives way to the trigger mid-reload.
      p.combatant.reloading = 0;
      const stats = playerStatsOf(ctx.state.domain);
      fireShot(
        ctx,
        {
          shooter: p,
          origin: aimOrigin(p, ctx.state.domain.preferences.cameraMode),
          dir: directionFromAngles(p.yaw, p.pitch),
          spread: aimSpreadOf(p, stats),
          critChance: stats.critChance,
          critMultiplier: stats.critMultiplier,
          damageBonus: stats.damageBonus,
        },
        ctx.rng,
      );
    }
  },
};
