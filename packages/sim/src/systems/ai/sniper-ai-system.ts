import { factionStance, normalize, sub, type Vec3 } from "@seki/core";
import type { Entity } from "../../world/components";
import type { SimContext, System } from "../../world/context";
import { chestOf, eyeOf, lineOfSight } from "../../world/hitscan";
import { inCreationOrder } from "../../world/ordering";
import { readyToFire } from "../../world/player-weapon";
import { LEVEL_GAP, routeAcrossLevels } from "../../world/nav";
import { WORLD_NAV } from "../../content/world-map";
import { worldTimeScale } from "../ability-system";
import { NPC_CRIT, aimSpreadOf, fireShot } from "../combat-system";

/** Seconds the laser is on before the shot: the telegraph (ADR-0024). */
export const SNIPER_AIM_TIME = 1.4;
/** A sniper whose target came this close (metres, in 3D) falls back to its farthest perch. */
export const SNIPER_RETREAT_RADIUS = 14;
/** Pause after losing the line before it tries again. */
const LOST_SIGHT_REST = 0.6;
const SNIPER_SPEED = 3.4;
/** On its perch within this distance. */
const ON_PERCH = 0.8;
/** It only bothers to move when the new perch is this much farther from the player. */
const RETREAT_GAIN = 4;
const TURN_RATE = 5;

type Sniper = Entity & { sniper: NonNullable<Entity["sniper"]>; velocity: NonNullable<Entity["velocity"]> };

const dist3 = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

const face = (self: Entity, at: Vec3, maxTurn: number): void => {
  const desired = Math.atan2(at.x - self.position.x, at.z - self.position.z);
  let delta = (desired - self.yaw) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  self.yaw += Math.max(-maxTurn, Math.min(maxTurn, delta));
};

/**
 * Where to fall back to: the perch farthest from the player among those that lie away from
 * the player as seen from the sniper (it does not run past Seki to get there); the farthest of
 * all when none does. Lowest index on a tie.
 */
export const retreatPerch = (perches: readonly Vec3[], self: Vec3, player: Vec3): number => {
  let best = -1;
  let bestD = -1;
  let any = 0;
  let anyD = -1;
  perches.forEach((p, i) => {
    const d = dist3(p, player);
    if (d > anyD) {
      any = i;
      anyD = d;
    }
    const away = (p.x - self.x) * (self.x - player.x) + (p.z - self.z) * (self.z - player.z) > 0;
    if (away && d > bestD) {
      best = i;
      bestD = d;
    }
  });
  return best >= 0 ? best : any;
};

/** Knee height of the "can I walk straight there" test (as for the gangers, ADR-0021). */
const KNEE = 0.6;
const knee = (p: Vec3): Vec3 => ({ x: p.x, y: p.y + KNEE, z: p.z });

/**
 * Walks towards the perch: straight when it is on the same floor in plain view, through the
 * level graph otherwise (two roofs of nearly the same height are still different floors).
 */
const walkTo = (ctx: SimContext, self: Sniper, goal: Vec3): void => {
  const from = self.position;
  const apart = Math.abs(goal.y - from.y) > LEVEL_GAP;
  const raised = from.y > LEVEL_GAP || goal.y > LEVEL_GAP;
  const straight = !apart && (!raised || lineOfSight(ctx.world, knee(from), knee(goal)));
  const next = straight ? goal : (routeAcrossLevels(ctx.world, WORLD_NAV, from, goal)?.next ?? goal);
  const dx = next.x - from.x;
  const dz = next.z - from.z;
  const d = Math.hypot(dx, dz);
  self.velocity = d < 1e-6 ? { x: 0, y: 0, z: 0 } : { x: (dx / d) * SNIPER_SPEED, y: 0, z: (dz / d) * SNIPER_SPEED };
  if (d > 1e-6) self.yaw = Math.atan2(dx, dz);
};

const stopAiming = (ctx: SimContext, self: Sniper, target: Entity | null): void => {
  if (self.sniper.phase === "aim") ctx.bus.emit("SniperAimed", { entityId: self.id, targetId: target?.id ?? self.id, duration: 0 });
};

/**
 * Tessen snipers (ADR-0024). A sniper holds a perch high up. Seeing the player in range (and
 * not liked by Tessen), it turns its laser on and fires `SNIPER_AIM_TIME` later if the line is
 * still clear: the laser is the warning, cover is the answer. Between shots it rests. When the
 * player comes within `SNIPER_RETREAT_RADIUS`, it walks to the perch farthest from them, by the
 * stairs when that perch is on another level, and does not shoot on the way. Deterministic:
 * entities in creation order, randomness only through the shot itself.
 */
export const sniperAiSystem: System = {
  name: "sniper-ai",
  run(ctx) {
    const player = ctx.session.gameOver ? null : (ctx.world.with("player").first ?? null);
    const scale = worldTimeScale(ctx);
    const dt = ctx.dt * scale;
    for (const self of inCreationOrder(ctx.world.with("sniper", "velocity"))) {
      const s = self.sniper;
      if (self.combatant) self.combatant.engaged = false;
      self.velocity = { x: 0, y: 0, z: 0 };
      const perch = s.perches[s.perch];
      if (!player || !perch) {
        stopAiming(ctx, self, null);
        s.phase = "idle";
        continue;
      }
      const near = dist3(player.position, self.position) <= SNIPER_RETREAT_RADIUS;
      if (near) {
        const away = retreatPerch(s.perches, self.position, player.position);
        const there = s.perches[away];
        if (away !== s.perch && there && dist3(there, player.position) > dist3(perch, player.position) + RETREAT_GAIN) {
          stopAiming(ctx, self, player);
          s.perch = away;
          s.phase = "move";
        }
      }
      const goal = s.perches[s.perch] ?? perch;
      if (s.phase === "move" || dist3(goal, self.position) > ON_PERCH) {
        if (dist3(goal, self.position) <= ON_PERCH) s.phase = "idle";
        else {
          stopAiming(ctx, self, player);
          s.phase = "move";
          walkTo(ctx, self, goal);
          continue;
        }
      }
      const range = self.combatant?.stats?.range ?? 0;
      const hostile = factionStance(ctx.state.domain.reputation, self.faction ?? "tessen") !== "friendly";
      const inLine = hostile && dist3(player.position, self.position) <= range && lineOfSight(ctx.world, eyeOf(self), chestOf(player));
      if (s.phase === "rest") {
        s.timer = Math.max(0, s.timer - dt);
        if (inLine) face(self, player.position, TURN_RATE * dt);
        if (s.timer === 0) s.phase = "idle";
        continue;
      }
      if (s.phase === "idle") {
        if (!inLine || !self.combatant || !readyToFire(self.combatant, self.combatant.loaded)) continue;
        s.phase = "aim";
        s.timer = SNIPER_AIM_TIME;
        ctx.bus.emit("SniperAimed", { entityId: self.id, targetId: player.id, duration: SNIPER_AIM_TIME });
      }
      // Aiming: track the target; a broken line switches the laser off.
      if (!inLine) {
        stopAiming(ctx, self, player);
        s.phase = "rest";
        s.timer = LOST_SIGHT_REST;
        continue;
      }
      face(self, player.position, TURN_RATE * dt);
      if (self.combatant) self.combatant.engaged = true;
      s.timer = Math.max(0, s.timer - dt);
      if (s.timer > 0 || !self.combatant || !readyToFire(self.combatant, self.combatant.loaded)) continue;
      const origin = eyeOf(self);
      fireShot(ctx, { shooter: self, origin, dir: normalize(sub(chestOf(player), origin)), spread: aimSpreadOf(self, null), ...NPC_CRIT }, ctx.rng);
      ctx.bus.emit("SniperAimed", { entityId: self.id, targetId: player.id, duration: 0 });
      s.phase = "rest";
      s.timer = self.combatant.stats?.interval ?? SNIPER_AIM_TIME;
    }
  },
};
