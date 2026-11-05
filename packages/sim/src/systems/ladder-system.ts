import type { Entity, LadderDef, LadderSettle } from "../world/components";
import type { SimContext, System } from "../world/context";
import { inCreationOrder } from "../world/ordering";
import { playerHeld } from "../world/takedown";

/** Climbing speed on a ladder, m/s. */
export const CLIMB_SPEED = 2.2;
/** Walking into the foot of a ladder grabs it from this close (metres, horizontally)... */
const GRAB_REACH = 0.6;
/** ...facing it within this angle (radians). */
const GRAB_FACING = 0.9;
/** A grab from the top starts this far below the top, so the climber is on the rungs. */
const TOP_GRAB_DROP = 0.8;
/**
 * A grab from the top swings her over the edge in this long (seconds), the first `TOP_GRAB_ACROSS`
 * of it across onto the ladder's line at the roof's height, the rest down onto the rungs.
 */
const TOP_GRAB_TIME = 0.6;
const TOP_GRAB_ACROSS = 0.45;
/** Letting go with the jump button pushes off the wall at this speed, m/s. */
const PUSH_OFF = 1.6;
/**
 * At the top she pulls herself over onto the exit, from this far below the top (metres) and
 * over this long (seconds): the last rungs and the step across, not a jump onto the roof.
 */
const STEP_OFF_LIFT = 0.6;
const STEP_OFF_TIME = 0.6;

type Ladder = Entity & { ladder: LadderDef };

const ladders = (ctx: SimContext): Ladder[] => inCreationOrder(ctx.world.with("ladder"));

const angleBetween = (a: number, b: number): number => {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
};

/** The way onto the rungs: how long it takes, and whether it swings over the edge first. */
type Settle = Pick<LadderSettle, "over" | "duration">;

/**
 * Puts `e` on the ladder at feet height `y`, facing it: at once (a game saved on the ladder), or
 * eased onto the rungs from where she stands over `settle`.
 */
const hangOn = (ctx: SimContext, e: Entity, l: LadderDef, y: number, settle?: Settle): void => {
  if (settle) {
    e.climb = { ladder: l.key, speed: 0, settle: { from: e.position, fromYaw: e.yaw, y, t: 0, ...settle } };
  } else {
    e.climb = { ladder: l.key, speed: 0 };
    e.position = { x: l.x, y, z: l.z };
    e.yaw = l.yaw;
  }
  delete e.fall;
  delete e.airPeak;
  if (e.velocity) e.velocity = { x: 0, y: 0, z: 0 };
  ctx.bus.emit("LadderClimb", { entityId: e.id, ladder: l.key, on: true });
};

const ease = (v: number): number => v * v * (3 - 2 * v);

/** Shortest signed turn from `a` to `b`, radians. */
const turn = (a: number, b: number): number => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/** Moves the way onto the rungs on; at its end she hangs on the ladder's line, facing it. */
const stepSettle = (e: Entity, l: LadderDef, s: LadderSettle, dt: number): void => {
  s.t = Math.min(s.duration, s.t + dt);
  const f = s.t / s.duration;
  const across = ease(s.over ? Math.min(1, f / TOP_GRAB_ACROSS) : f);
  const down = ease(s.over ? Math.max(0, (f - TOP_GRAB_ACROSS) / (1 - TOP_GRAB_ACROSS)) : f);
  e.position = { x: s.from.x + (l.x - s.from.x) * across, y: s.from.y + (s.y - s.from.y) * down, z: s.from.z + (l.z - s.from.z) * across };
  e.yaw = s.fromYaw + turn(s.fromYaw, l.yaw) * ease(f);
  if (s.t >= s.duration) {
    e.position = { x: l.x, y: s.y, z: l.z };
    e.yaw = l.yaw;
    if (e.climb) delete e.climb.settle;
  }
};

const letGo = (ctx: SimContext, e: Entity, key: string): void => {
  delete e.climb;
  ctx.bus.emit("LadderClimb", { entityId: e.id, ladder: key, on: false });
};

/** The interact key on a ladder's grab point (ADR-0021): climb on at that end. */
export const grabLadder = (ctx: SimContext, e: Entity, key: string, end: "bottom" | "top"): void => {
  if (e.climb) return;
  const l = ladders(ctx).find((x) => x.ladder.key === key)?.ladder;
  if (!l) return;
  if (end === "top") hangOn(ctx, e, l, l.top - TOP_GRAB_DROP, { over: true, duration: TOP_GRAB_TIME });
  else hangOn(ctx, e, l, l.bottom);
};

/** A climber standing in a ladder's line between its ends (a game saved mid-climb). */
const onLadderLine = (e: Entity, l: LadderDef): boolean =>
  Math.hypot(e.position.x - l.x, e.position.z - l.z) < 0.05 && e.position.y > l.bottom + 0.05 && e.position.y < l.top - 0.05;

/**
 * Fire escape ladders (ADR-0021). Walking forward into the foot of a ladder, or the interact
 * key at either end, puts the player on it; forward climbs up, back climbs down, at the top
 * she pulls herself over onto the roof (a mantle), at the bottom steps onto the street. The jump button lets go. On the
 * ladder there is no gravity and no walking; movement skips the climber. Runs after player
 * control (which sets the walk velocity this overrides) and before movement.
 */
export const ladderSystem: System = {
  name: "ladder",
  run(ctx) {
    const all = ladders(ctx);
    if (all.length === 0) return;
    const { input } = ctx;
    const frozen = playerHeld(ctx);
    for (const p of ctx.world.with("player", "velocity")) {
      if (!p.climb) {
        // No ladder with a body on her shoulder (ADR-0065): both hands are full.
        if (frozen || p.fall !== undefined || p.mantle || ctx.session.carrying !== null) continue;
        // A game saved on a ladder: back on it, where it was.
        const held = all.find((l) => onLadderLine(p, l.ladder));
        if (held) {
          hangOn(ctx, p, held.ladder, p.position.y);
          continue;
        }
        if (input.moveZ <= 0.5) continue;
        for (const { ladder: l } of all) {
          const near = Math.hypot(p.position.x - l.x, p.position.z - l.z) <= GRAB_REACH;
          if (near && Math.abs(p.position.y - l.bottom) < 0.3 && angleBetween(p.yaw, l.yaw) <= GRAB_FACING) {
            hangOn(ctx, p, l, l.bottom);
            break;
          }
        }
        continue;
      }
      const l = all.find((x) => x.ladder.key === p.climb?.ladder)?.ladder;
      if (!l) {
        // The ladder streamed out under the climber: drop.
        letGo(ctx, p, p.climb.ladder);
        continue;
      }
      p.velocity = { x: 0, y: 0, z: 0 };
      if (frozen) {
        p.climb.speed = 0;
        continue;
      }
      if (p.climb.settle) {
        stepSettle(p, l, p.climb.settle, ctx.dt);
        continue;
      }
      if (input.jump) {
        // Push off backwards and fall.
        letGo(ctx, p, l.key);
        p.fall = 0;
        p.airPeak = p.position.y;
        p.velocity = { x: -Math.sin(l.yaw) * PUSH_OFF, y: 0, z: -Math.cos(l.yaw) * PUSH_OFF };
        if (p.jump) p.jump.buffer = 0;
        continue;
      }
      const speed = Math.max(-1, Math.min(1, input.moveZ)) * CLIMB_SPEED;
      p.climb.speed = speed;
      const y = p.position.y + speed * ctx.dt;
      if (speed > 0 && y >= l.top - STEP_OFF_LIFT) {
        // The pull-over plays in movement, as a mantle onto a ledge does.
        letGo(ctx, p, l.key);
        p.mantle = { from: { x: l.x, y, z: l.z }, to: { ...l.exit }, duration: STEP_OFF_TIME, t: 0 };
        continue;
      }
      if (speed < 0 && y <= l.bottom) {
        letGo(ctx, p, l.key);
        p.position = { x: l.x, y: l.bottom, z: l.z };
        continue;
      }
      if (y !== p.position.y) p.position = { x: l.x, y, z: l.z };
    }
  },
};
