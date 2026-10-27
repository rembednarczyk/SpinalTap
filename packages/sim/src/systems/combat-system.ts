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
  directionFromAngles,
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
const defenderOf = (ctx: SimContext, target: Entity): DefenderProfile => {
  if (target.player) {
    const { inventory, equipment } = ctx.state.domain;
    return defenseOf(playerStatsOf(ctx.state.domain), wornGarments(inventory, equipment));
  }
  return target.enemy ? enemyDefense(target.enemy.type) : { armor: 0 };
};

/** A hit on the player wears the clothes covering that zone. */
const wearPlayerClothes = (ctx: SimContext, zone: HitZone): void => {
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
const threaten = (ctx: SimContext, reason: DialogueInterruptReason, sourceId: number): void => {
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
    const outcome = resolveAttack(
      { damage: weapon.damage, zones: weapon.zones, critChance: shot.critChance, critMultiplier: shot.critMultiplier, damageBonus: shot.damageBonus },
      defenderOf(ctx, target),
      rng,
      result.zone,
    );
    target.health = applyDamage(target.health, outcome.damage);
    if (target.player) {
      hurtPlayer = true;
      wearPlayerClothes(ctx, outcome.zone);
    }
    // Getting shot provokes any AI, whatever it thought of the shooter before.
    if (target.ai) target.ai.alerted = true;
    ctx.bus.emit("DamageDealt", {
      sourceId: shot.shooter.id,
      targetId: target.id,
      amount: outcome.damage,
      critical: outcome.critical,
      zone: outcome.zone,
      at: result.point,
    });
  }
  combatant.bloom = addBloom(weapon.spread, combatant.bloom);
  alertNearbyGangers(ctx, shot.origin, weapon.alertRadius);
  const result = first ?? { distance: 0, point: farthest, entity: null, zone: null };
  if (!shot.shooter.player) {
    const player = ctx.world.with("player").first;
    if (hurtPlayer) threaten(ctx, "damage", shot.shooter.id);
    else if (player) {
      const close = Math.hypot(player.position.x - shot.origin.x, player.position.z - shot.origin.z) <= GUNFIRE_INTERRUPT_RADIUS;
      const nearMiss = pointSegmentDistance(chestOf(player), shot.origin, result.point) <= NEAR_MISS_RADIUS;
      if (close || nearMiss) threaten(ctx, "gunfire", shot.shooter.id);
    }
  }
  return result;
};

const alertNearbyGangers = (ctx: SimContext, at: { x: number; z: number }, radius: number): void => {
  for (const g of ctx.world.with("ai")) {
    if (Math.hypot(g.position.x - at.x, g.position.z - at.z) <= radius) g.ai.alerted = true;
  }
};

/** The player's trigger. Timers, holster, slots and reloads are handled by `weapon` just before. */
export const combatSystem: System = {
  name: "combat",
  run(ctx) {
    if (ctx.session.dialogueActive || ctx.session.gameOver || !ctx.input.fire) return;
    for (const p of ctx.world.with("player", "combatant")) {
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
