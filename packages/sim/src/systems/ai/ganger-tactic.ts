import type { Vec3 } from "@seki/core";
import type { World } from "miniplex";
import type { SimContext } from "../../world/context";
import { difficultyOf } from "../../world/difficulty";
import { enemyRankOf } from "../../world/enemy-grade";
import type { Entity, GunTactic } from "../../world/components";
import { straightWalk } from "./steering";
import { BACK_SPEED, type GangerBinding, type GangerWalk } from "./ganger-walk";

/*
 * A gunner in its weapon's band does not stand like a turret (ADR-0089 stage 3): it fires in
 * bursts with a pause after each, and steps aside round the player between them, facing her and
 * firing as it goes. Every choice is drawn from `ctx.rng` when it is made, not every step.
 */

/** A sidestep goes at the pace of a step back. */
export const SIDE_SPEED = BACK_SPEED;
/** A sidestep is 1.5 to 3 metres long. */
const STRIDE_MIN = 1.5;
const STRIDE_MAX = 3;
/** After a sidestep it stands 0.7-1.3 s: no more than two turns of its way in 3 s. */
export const REST_MIN = 0.7;
const REST_SPAN = 0.6;
/**
 * A Hebi regular in the lower half of its district's band (ADR-0089 stage 5, the user's decision of
 * 17.11): a novice holds its weapon's band and pauses long, but neither steps aside nor spreads out
 * round her. In the upper half, and Tessen and elites throughout, the full set. Ungraded (no band),
 * the full set too.
 */
export const novice = (e: Entity): boolean => {
  const g = e.enemy;
  if (!g || e.faction !== "hebi" || enemyRankOf(e) !== "regular" || g.level === undefined || !g.band) return false;
  return g.level < (g.band.min + g.band.max) / 2;
};
/** A novice's pause after a burst is this much longer. */
export const NOVICE_PAUSE = 1.5;

/** After a burst it holds its fire 0.6-1.2 s more than its weapon's interval: the player's window. */
export const PAUSE_MIN = 0.6;
const PAUSE_SPAN = 0.6;

/** Ways the sidesteps of a world have tried (`straightWalk` each), for the budget's test. */
const probes = new WeakMap<World<Entity>, { n: number }>();
export const sidestepProbes = (world: World<Entity>): number => probes.get(world)?.n ?? 0;
export const probed = (world: World<Entity>): void => {
  const p = probes.get(world);
  if (p) p.n += 1;
  else probes.set(world, { n: 1 });
};

/** Its burst and sidestep, made the first time it is asked for: a whole burst, a moment's stand. */
export const tacticOf = (ctx: SimContext, self: Entity): GunTactic | null => {
  const ai = self.ai;
  if (!ai?.burst) return null;
  ai.tactic ??= { shots: ai.burst, side: 1, stride: 0, rest: REST_MIN + ctx.rng.next() * REST_SPAN };
  return ai.tactic;
};

/** A shot of a burst fired: after the last it pauses, and the next burst is whole. */
export const burstShot = (ctx: SimContext, self: Entity): void => {
  const t = tacticOf(ctx, self);
  if (!t || !self.combatant) return;
  t.shots -= 1;
  if (t.shots > 0) return;
  t.shots = self.ai?.burst ?? 1;
  // Shorter under more pressure (ADR-0089 stage 5).
  self.combatant.cooldown += ((PAUSE_MIN + ctx.rng.next() * PAUSE_SPAN) * (novice(self) ? NOVICE_PAUSE : 1)) / difficultyOf(ctx).npcPressure;
};

/** The point `len` metres aside of `self` round the player at `from`, on `side`. */
export const aside = (self: Entity, from: Vec3, side: 1 | -1, len: number): Vec3 => {
  const dx = self.position.x - from.x;
  const dz = self.position.z - from.z;
  const d = Math.hypot(dx, dz) || 1;
  return { x: self.position.x - (dz / d) * side * len, y: self.position.y, z: self.position.z + (dx / d) * side * len };
};

/**
 * A step of the gunner's sidestep round the player at `from`: standing, it counts down its rest,
 * then picks a side and a length; a way that a wall, a bank or a ledge closes is dropped for the
 * other side, and with both closed it stands on.
 */
export const sidestep = (at: GangerBinding, walk: GangerWalk, from: Vec3): void => {
  const { ctx, self, timeScale } = at;
  if (!ctx || !self) return;
  const t = tacticOf(ctx, self);
  if (!t || novice(self)) return;
  const dt = ctx.dt * timeScale;
  if (t.stride <= 0) {
    t.rest -= dt;
    if (t.rest > 0) return;
    // More often under more pressure (ADR-0089 stage 5).
    t.rest = (REST_MIN + ctx.rng.next() * REST_SPAN) / difficultyOf(ctx).npcPressure;
    const len = STRIDE_MIN + ctx.rng.next() * (STRIDE_MAX - STRIDE_MIN);
    const sides: readonly (1 | -1)[] = ctx.rng.next() < 0.5 ? [1, -1] : [-1, 1];
    const side = sides.find((s) => {
      probed(ctx.world);
      return straightWalk(ctx.world, self.position, aside(self, from, s, len));
    });
    if (side === undefined) return;
    t.side = side;
    t.stride = len;
  }
  walk.goAt(aside(self, from, t.side, Math.min(t.stride, 1)), SIDE_SPEED);
  t.stride = Math.max(0, t.stride - SIDE_SPEED * dt);
};
