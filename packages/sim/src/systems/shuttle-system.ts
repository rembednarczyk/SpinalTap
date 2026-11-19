import { GAME_SECONDS_PER_REAL_SECOND } from "@seki/core";
import type { Entity, Shuttle } from "../world/components";
import type { SimContext, System } from "../world/context";
import { inCreationOrder } from "../world/ordering";

type Runner = Entity & { shuttle: Shuttle; solid: NonNullable<Entity["solid"]> };

/**
 * Where along its run a shuttle stands at real second `t`: 0 at its start, 1 at its far end; it
 * stands still for `pause` of its period at each end and runs at an even speed between them.
 */
export const shuttleProgress = (s: Shuttle, t: number): number => {
  const u = (((t / s.period + s.phase) % 1) + 1) % 1;
  const run = 0.5 - s.pause;
  if (u < s.pause) return 0;
  if (u < s.pause + run) return (u - s.pause) / run;
  if (u < 2 * s.pause + run) return 1;
  return 1 - (u - 2 * s.pause - run) / run;
};

/** The shuttle's box and middle at progress `p`, its velocity the way it went since the last step. */
const place = (e: Runner, p: number, dt: number): void => {
  const { base, axis, travel } = e.shuttle;
  const d = travel * p;
  const dx = axis === "x" ? d : 0;
  const dz = axis === "z" ? d : 0;
  const was = e.position;
  e.solid = { min: { x: base.min.x + dx, y: base.min.y, z: base.min.z + dz }, max: { x: base.max.x + dx, y: base.max.y, z: base.max.z + dz } };
  e.position = { x: (base.min.x + base.max.x) / 2 + dx, y: (base.min.y + base.max.y) / 2, z: (base.min.z + base.max.z) / 2 + dz };
  e.velocity = dt > 0 ? { x: (e.position.x - was.x) / dt, y: 0, z: (e.position.z - was.z) / dt } : { x: 0, y: 0, z: 0 };
};

/** A body's clearance from a shuttle it was pushed off, over its radius. */
const CLEAR = 0.02;

/**
 * Bodies a shuttle's new box reaches into go aside across its run, to the nearer side: a cart on a
 * lane pushes whoever stands in its way onto the walkway beside it (P-2's lane has 1.5 m each side).
 */
const pushAside = (ctx: SimContext, e: Runner): void => {
  const b = e.solid;
  const along = e.shuttle.axis;
  for (const o of inCreationOrder(ctx.world.with("body"))) {
    const r = o.body.radius;
    const p = o.position;
    if (p.y >= b.max.y || p.y + o.body.height <= b.min.y) continue;
    if (p.x <= b.min.x - r || p.x >= b.max.x + r || p.z <= b.min.z - r || p.z >= b.max.z + r) continue;
    if (along === "z") {
      const mid = (b.min.x + b.max.x) / 2;
      o.position = { ...p, x: p.x < mid ? b.min.x - r - CLEAR : b.max.x + r + CLEAR };
    } else {
      const mid = (b.min.z + b.max.z) / 2;
      o.position = { ...p, z: p.z < mid ? b.min.z - r - CLEAR : b.max.z + r + CLEAR };
    }
  }
};

/**
 * P-2's robots and any solid that runs by the clock (ADR-0074 stage 5b). Before movement, as the
 * lifts and doors: this step's collision sees the robot where it is now, and whoever stands in its
 * way is pushed aside. Its place follows from the domain's time (real seconds of it), so a loaded game puts it
 * back where it was and a wait moves it on.
 */
export const shuttleSystem: System = {
  name: "shuttles",
  run(ctx: SimContext) {
    const runners = inCreationOrder(ctx.world.with("shuttle", "solid"));
    if (runners.length === 0) return;
    const t = ctx.state.domain.clock.seconds / GAME_SECONDS_PER_REAL_SECOND;
    for (const e of runners) {
      place(e, shuttleProgress(e.shuttle, t), ctx.dt);
      pushAside(ctx, e);
    }
  },
};
