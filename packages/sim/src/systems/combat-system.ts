import { WEAPONS, applyDamage, directionFromAngles, resolveAttack, type RandomPort } from "@seki/core";
import type { Entity } from "../world/components";
import type { SimContext, System } from "../world/context";
import { aimOrigin, hitscan, type HitscanResult } from "../world/hitscan";
import { worldTimeScale } from "./ability-system";
import { statsFor } from "./player-control-system";

const ALERT_RADIUS = 22;
/** Share of body height above which a hit counts as a headshot. */
export const HEAD_ZONE = 0.83;

export interface ShotRequest {
  readonly shooter: Entity;
  readonly origin: { x: number; y: number; z: number };
  readonly dir: { x: number; y: number; z: number };
  readonly critChance: number;
  readonly critMultiplier: number;
  readonly damageBonus: number;
}

const armorOf = (ctx: SimContext, target: Entity): number =>
  target.player ? statsFor(ctx.state.domain.character).armor : target.ai ? 3 : 0;

/** Fires one hitscan shot: resolves the hit, applies damage and emits events. Shared by player and AI. */
export const fireShot = (ctx: SimContext, shot: ShotRequest, rng: RandomPort): HitscanResult => {
  const combatant = shot.shooter.combatant;
  if (!combatant) throw new Error("fireShot: shooter has no weapon");
  const weapon = WEAPONS[combatant.weapon];
  combatant.cooldown = weapon.cooldown;
  const result = hitscan(ctx.world, shot.origin, shot.dir, weapon.range, shot.shooter.id);
  ctx.bus.emit("ShotFired", { shooterId: shot.shooter.id, from: shot.origin, to: result.point, hitEntity: result.entity?.id ?? null });
  alertNearbyGangers(ctx, shot.origin);
  const target = result.entity;
  if (!target?.health) return result;
  const headshot = !!target.body && result.point.y - target.position.y >= target.body.height * HEAD_ZONE;
  const outcome = resolveAttack(
    { weapon, critChance: shot.critChance, critMultiplier: shot.critMultiplier, damageBonus: shot.damageBonus },
    { armor: armorOf(ctx, target) },
    rng,
    headshot,
  );
  if (!outcome.hit) return result;
  target.health = applyDamage(target.health, outcome.damage);
  ctx.bus.emit("DamageDealt", {
    sourceId: shot.shooter.id,
    targetId: target.id,
    amount: outcome.damage,
    critical: outcome.critical,
    headshot,
    at: result.point,
  });
  return result;
};

const alertNearbyGangers = (ctx: SimContext, at: { x: number; z: number }): void => {
  for (const g of ctx.world.with("ai")) {
    if (Math.hypot(g.position.x - at.x, g.position.z - at.z) <= ALERT_RADIUS) g.ai.alerted = true;
  }
};

/** Ticks weapon cooldowns and handles the player's trigger. */
export const combatSystem: System = {
  name: "combat",
  run(ctx) {
    const enemyDt = ctx.dt * worldTimeScale(ctx);
    for (const e of ctx.world.with("combatant")) e.combatant.cooldown = Math.max(0, e.combatant.cooldown - (e.player ? ctx.dt : enemyDt));
    if (ctx.session.dialogueActive || ctx.session.gameOver || !ctx.input.fire) return;
    for (const p of ctx.world.with("player", "combatant")) {
      if (p.combatant.cooldown > 0) continue;
      const stats = statsFor(ctx.state.domain.character);
      fireShot(
        ctx,
        {
          shooter: p,
          origin: aimOrigin(p, ctx.state.domain.preferences.cameraMode),
          dir: directionFromAngles(p.yaw, p.pitch),
          critChance: stats.critChance,
          critMultiplier: stats.critMultiplier,
          damageBonus: stats.damageBonus,
        },
        ctx.rng,
      );
    }
  },
};
