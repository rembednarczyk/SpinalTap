import {
  DRAW_TIME,
  WEAPONS,
  type DefenderProfile,
  type DerivedStats,
  type DialogueInterruptReason,
  type Vec3,
  addBloom,
  applyDamage,
  directionFromAngles,
  recoverBloom,
  resolveAttack,
  sampleCone,
  spreadAngle,
  type RandomPort,
} from "@seki/core";
import type { Entity } from "../world/components";
import type { SimContext, System } from "../world/context";
import { crouchOf } from "../world/hitboxes";
import { aimOrigin, chestOf, hitscan, type HitscanResult } from "../world/hitscan";
import { worldTimeScale } from "./ability-system";
import { statsFor } from "./player-control-system";

const ALERT_RADIUS = 22;
/** An enemy firing this close to the player breaks off a conversation (metres). */
export const GUNFIRE_INTERRUPT_RADIUS = 8;
/** A shot passing this close to the player's chest counts as fired at them (metres). */
const NEAR_MISS_RADIUS = 1.5;
/** Gangers wear a vest over the torso. */
const GANGER_ARMOR: DefenderProfile = { armor: 2, zoneArmor: { torso: 3 } };

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

const defenderOf = (ctx: SimContext, target: Entity): DefenderProfile => {
  if (target.player) {
    const stats = statsFor(ctx.state.domain.character);
    return { armor: stats.armor, zoneArmor: { head: stats.headArmor } };
  }
  return target.ai ? GANGER_ARMOR : { armor: 0 };
};

/**
 * Current aim cone of a combatant: weapon, stance, movement, bloom and (for the player)
 * implants. The HUD crosshair shows the same number.
 */
export const aimSpreadOf = (e: Entity, stats: Pick<DerivedStats, "moveSpeed" | "aimStability"> | null): number => {
  if (!e.combatant) return 0;
  const speed = e.velocity ? Math.hypot(e.velocity.x, e.velocity.z) : 0;
  return spreadAngle(WEAPONS[e.combatant.weapon].spread, {
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

/** Fires one hitscan shot: spreads it, resolves the hit, applies damage and emits events. Shared by player and AI. */
export const fireShot = (ctx: SimContext, shot: ShotRequest, rng: RandomPort): HitscanResult => {
  const combatant = shot.shooter.combatant;
  if (!combatant) throw new Error("fireShot: shooter has no weapon");
  const weapon = WEAPONS[combatant.weapon];
  combatant.cooldown = weapon.cooldown;
  const dir = sampleCone(shot.dir, shot.spread, rng);
  combatant.bloom = addBloom(weapon.spread, combatant.bloom);
  const result = hitscan(ctx.world, shot.origin, dir, weapon.range, shot.shooter.id);
  ctx.bus.emit("ShotFired", { shooterId: shot.shooter.id, from: shot.origin, to: result.point, hitEntity: result.entity?.id ?? null });
  alertNearbyGangers(ctx, shot.origin);
  const target = result.entity;
  let hurtPlayer = false;
  if (target?.health && result.zone) {
    const outcome = resolveAttack(
      { damage: weapon.baseDamage, critChance: shot.critChance, critMultiplier: shot.critMultiplier, damageBonus: shot.damageBonus },
      defenderOf(ctx, target),
      rng,
      result.zone,
    );
    target.health = applyDamage(target.health, outcome.damage);
    hurtPlayer = !!target.player;
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

const alertNearbyGangers = (ctx: SimContext, at: { x: number; z: number }): void => {
  for (const g of ctx.world.with("ai")) {
    if (Math.hypot(g.position.x - at.x, g.position.z - at.z) <= ALERT_RADIUS) g.ai.alerted = true;
  }
};

/**
 * Ticks weapon cooldowns and bloom and handles the player's weapon: holster / draw (pulling
 * the trigger with the weapon put away draws it) and the trigger itself.
 */
export const combatSystem: System = {
  name: "combat",
  run(ctx) {
    const enemyDt = ctx.dt * worldTimeScale(ctx);
    for (const e of ctx.world.with("combatant")) {
      const dt = e.player ? ctx.dt : enemyDt;
      e.combatant.cooldown = Math.max(0, e.combatant.cooldown - dt);
      e.combatant.drawing = Math.max(0, e.combatant.drawing - dt);
      e.combatant.bloom = recoverBloom(WEAPONS[e.combatant.weapon].spread, e.combatant.bloom, dt);
    }
    if (ctx.session.dialogueActive || ctx.session.gameOver) return;
    for (const p of ctx.world.with("player", "combatant")) {
      const c = p.combatant;
      if (ctx.input.toggleWeapon || (c.holstered && ctx.input.fire)) {
        c.holstered = !c.holstered;
        c.drawing = c.holstered ? 0 : DRAW_TIME;
        ctx.bus.emit("WeaponToggled", { entityId: p.id, drawn: !c.holstered });
      }
    }
    if (!ctx.input.fire) return;
    for (const p of ctx.world.with("player", "combatant")) {
      if (p.combatant.cooldown > 0 || p.combatant.holstered || p.combatant.drawing > 0) continue;
      const stats = statsFor(ctx.state.domain.character);
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
