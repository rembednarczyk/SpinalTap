import { MOST_STRIDE, type Vec3, attackTokensFor } from "@seki/core";
import { difficultyOf } from "../../world/difficulty";
import type { World } from "miniplex";
import type { SimContext } from "../../world/context";
import { SIM_HZ } from "../../step-rate";
import type { Entity } from "../../world/components";
import { straightWalk } from "./steering";
import { GANGER_SPEED, type GangerBinding, type GangerWalk } from "./ganger-walk";
import { aside, novice, probed, tacticOf } from "./ganger-tactic";

/*
 * Attack tokens (ADR-0089 stage 4): no more than `ATTACK_TOKENS` gunners fire at the player at
 * once. A gunner takes a free token when it would fire; one nearer her than a holder that has
 * held its token `TOKEN_HOLD` seconds takes it over. One without a token holds its fire and
 * steps round her until it stands `SPREAD` off the nearest holder's bearing, so a group parts
 * to the sides instead of firing from one line.
 */

/** Gunners firing at her at once on Normal; the difficulty's `npcPressure` sets it (stage 5: Story 1, Hard 3). */
export const ATTACK_TOKENS = attackTokensFor(1);
/** A token is held this long before a nearer gunner may take it over (s). */
export const TOKEN_HOLD = 2;
/** A gunner without a token stands at least this far round her from the nearest holder (radians, 35°). */
export const SPREAD = (35 * Math.PI) / 180;
/** It steps round to this, a little past `SPREAD`, so that it does not stand on the edge (40°). */
const SPREAD_AIM = (40 * Math.PI) / 180;
/** A holder keeps its token this long after it last fired on it: a body crossing its line does not pass it on (s). */
const TOKEN_GRACE = 0.5;
/** A token is taken over only by a gunner this much nearer her than its holder (m). */
const TAKEOVER_NEARER = 2;
/** Holding its fire, it steps round her at a walk, in strides up to this long (m), standing a moment between. */
const SPREAD_STRIDE = MOST_STRIDE;
const SPREAD_REST = 0.3;

const GRACE_STEPS = Math.round(TOKEN_GRACE * SIM_HZ);

/** Does `g` hold a token at step `tick`: taken, not lost, and fired on it within `TOKEN_GRACE`? */
export const holdsToken = (g: Entity, tick: number): boolean => {
  const token = g.ai?.tactic?.token;
  return !!token && token.last >= tick - GRACE_STEPS && (g.health?.current ?? 0) > 0 && !g.unconscious;
};

const flat = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);

/** The other gunners holding a token, in creation order. */
const holders = (world: World<Entity>, tick: number, self: Entity): Entity[] =>
  [...world.with("ai")].filter((g) => g !== self && holdsToken(g, tick)).sort((a, b) => a.id - b.id);

/**
 * Whether `self`, `distance` from the player at `her`, fires this step: it keeps its token, takes a
 * free one, or takes over the farthest holder's that has held it long enough and is farther off.
 */
export const takeToken = (ctx: SimContext, self: Entity, her: Vec3): boolean => {
  const t = tacticOf(ctx, self);
  if (!t) return true;
  if (t.token && holdsToken(self, ctx.tick)) {
    t.token.last = ctx.tick;
    return true;
  }
  delete t.token;
  const others = holders(ctx.world, ctx.tick, self);
  if (others.length >= attackTokensFor(difficultyOf(ctx).npcPressure)) {
    const mine = flat(self.position, her);
    const held = Math.round(TOKEN_HOLD / ctx.dt);
    const yields = others
      .filter((g) => ctx.tick - g.ai!.tactic!.token!.since >= held && flat(g.position, her) > mine + TAKEOVER_NEARER)
      .sort((a, b) => flat(b.position, her) - flat(a.position, her) || a.id - b.id)[0];
    if (!yields) return false;
    delete yields.ai!.tactic!.token;
  }
  t.token = { since: ctx.tick, last: ctx.tick };
  return true;
};

/** The bearing of `p` round the player at `her`. */
const bearing = (p: Vec3, her: Vec3): number => Math.atan2(p.x - her.x, p.z - her.z);
const apart = (a: number, b: number): number => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/** How far round her, radians, `self` stands from the nearest holder at step `tick`; Infinity with none. */
export const spreadOf = (world: World<Entity>, tick: number, self: Entity, her: Vec3): number => {
  const mine = bearing(self.position, her);
  return Math.min(Infinity, ...holders(world, tick, self).map((g) => apart(bearing(g.position, her), mine)));
};

/** The signed turn from bearing `a` to `b`, -π..π. */
const turn = (a: number, b: number): number => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/**
 * A step of a gunner without a token: nearer a holder's bearing than `SPREAD_AIM`, it walks round
 * her to the nearest bearing `SPREAD_AIM` off every holder (past one of them where two leave no
 * room between), in strides of its way checked once each as a sidestep's; else it stands.
 */
export const spreadOut = (at: GangerBinding, walk: GangerWalk, her: Vec3): void => {
  const { ctx, self, timeScale } = at;
  if (!ctx || !self) return;
  const t = tacticOf(ctx, self);
  // A novice holds its fire where it stands (stage 5).
  if (!t || novice(self)) return;
  const dt = ctx.dt * timeScale;
  if (t.stride <= 0) {
    const others = holders(ctx.world, ctx.tick, self).map((g) => bearing(g.position, her));
    const room = (b: number): number => Math.min(Infinity, ...others.map((o) => apart(o, b)));
    const mine = bearing(self.position, her);
    if (others.length === 0 || room(mine) >= SPREAD) return;
    t.rest -= dt;
    if (t.rest > 0) return;
    t.rest = SPREAD_REST;
    const free = others.flatMap((o) => [o + SPREAD_AIM, o - SPREAD_AIM]).filter((b) => room(b) >= SPREAD_AIM - 1e-9);
    const goal = free.sort((a, b) => Math.abs(turn(mine, a)) - Math.abs(turn(mine, b)))[0];
    if (goal === undefined) return;
    const r = flat(self.position, her);
    const len = Math.min(SPREAD_STRIDE, Math.max(1, Math.abs(turn(mine, goal)) * r));
    // The side whose step turns its bearing the goal's way.
    const side = ([1, -1] as const).find((sd) => Math.sign(turn(mine, bearing(aside(self, her, sd, 0.5), her))) === Math.sign(turn(mine, goal))) ?? 1;
    probed(ctx.world);
    if (!straightWalk(ctx.world, self.position, aside(self, her, side, len))) return;
    t.side = side;
    t.stride = len;
  }
  walk.goAt(aside(self, her, t.side, Math.min(t.stride, 1)), GANGER_SPEED);
  t.stride = Math.max(0, t.stride - GANGER_SPEED * dt);
};
