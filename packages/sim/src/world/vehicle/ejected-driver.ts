import type { CarPose, EntityId, Vec3 } from "@seki/core";
import type { EjectedDriver } from "./thrown-types";

export type { EjectedDriver } from "./thrown-types";
import { castViewOf } from "../../content/cast";
import type { Entity } from "../components";
import type { SimContext } from "../context";
import { solidIndexOf } from "../solid-index";
import { circleTouches, pushCircleOut } from "../solids";
import { stepStruck, strike } from "./struck";

/*
 * The driver of a street car she takes (ADR-0097, the user's clips of 21.11): pulled out of the
 * seat (“Removing Driver”), thrown onto the road and back on its feet as anyone a car knocks
 * down (`struck.ts`), and off at a run, away from the car, until out of the way. A transient figure: unkeyed, never saved, nobody's target.
 */

/** Ids of the ejected drivers: past the player's cars (`PLAYER_CAR_ID_BASE`). */
export const DRIVER_ID_BASE = 3_995_000;

/** The span of the pull's clip played (seconds of clip) and its pace; the run in seconds. */
const PULL = { from: 0, to: 3.6, rate: 1.6 } as const;
const RUN = { speed: 5.5, seconds: 8 } as const;
/** Where the pull carries the hips (the clip table, leg lengths of 0.86 m): out to the car's left by 0.9 leg. */
const PULLED_OUT = 0.77;
const RADIUS = 0.38;
/** He keeps to the way he runs while this much of it ahead is clear (m), and picks a way with this much clear (m). */
const KEEP_CLEAR = 1.5;
const LOOK_AHEAD = 8;

/** The car's left (the driver's door) in the world, for heading `yaw`. */
const leftOf = (yaw: number): { x: number; z: number } => ({ x: -Math.cos(yaw), z: Math.sin(yaw) });

/** The driver of the car taken at `seat` (its hips in the world), heading `yaw`, on the ground at `floor`. */
export const ejectDriver = (ctx: SimContext, id: EntityId, seat: Vec3, yaw: number, floor: number): Entity => {
  const position = { x: seat.x, y: floor, z: seat.z };
  return ctx.world.add({
    id,
    position,
    prevPosition: { ...position },
    yaw,
    prevYaw: yaw,
    pitch: 0,
    velocity: { x: 0, y: 0, z: 0 },
    view: { kind: "npc", preset: "civilian", ...castViewOf(undefined, `driver:${id}`) },
    ejected: { phase: "pulled", t: PULL.from, yaw, spot: { ...seat }, floor },
  });
};

/** Plays the driver on by `dt`; true once it is out of the way (to be removed). */
const stepDriver = (ctx: SimContext, e: Entity & { ejected: EjectedDriver }, dt: number): boolean => {
  const d = e.ejected;
  const left = leftOf(d.yaw);
  if (d.phase === "pulled") {
    d.t += dt * PULL.rate;
    e.carPose = { act: "pulled", t: d.t, yaw: d.yaw, seat: d.spot, floor: d.floor } satisfies CarPose;
    e.position = { x: d.spot.x, y: d.floor, z: d.spot.z };
    e.prevPosition = { ...e.position };
    if (d.t >= PULL.to) {
      // Out of the seat by the door, and thrown onto the road away from the car.
      e.position = { x: d.spot.x + left.x * PULLED_OUT, y: d.floor, z: d.spot.z + left.z * PULLED_OUT };
      strike(ctx.world, e, left);
      [d.phase, d.t] = ["down", 0];
    }
    return false;
  }
  if (d.phase === "down") {
    if (!stepStruck(ctx.world, e, dt)) return false;
    [d.phase, d.t] = ["run", 0];
  }
  // A way clear of walls, picked when he sets off and again only once it is blocked just ahead: picked anew
  // each second, a wall 8 m off came into the look ahead and left it again, and he ran to and fro (G-990).
  if (!d.away || !clearAhead(ctx, e.position, d.away, KEEP_CLEAR)) d.away = wayOut(ctx, e.position, d);
  d.t += dt;
  run(ctx, e, d.away ?? left, dt);
  return d.t >= RUN.seconds;
};

/** True when nothing of body height stands on the line `dist` metres from `from` along `dir`. */
const clearAhead = (ctx: SimContext, from: Vec3, dir: { x: number; z: number }, dist: number): boolean => {
  const near = { x: 0, z: 0 };
  for (let k = 1; k <= dist; k++) {
    const x = from.x + dir.x * k;
    const z = from.z + dir.z * k;
    for (const c of solidIndexOf(ctx.world).collidersNear(x - RADIUS, z - RADIUS, x + RADIUS, z + RADIUS)) {
      if (c.box.max.y <= from.y + 0.45 || c.box.min.y >= from.y + 1.8) continue;
      if (circleTouches(c, x, z, RADIUS, near)) return false;
    }
  }
  return true;
};

/** How far along `dir` from `from` is clear, in whole metres up to `dist`. */
const clearFor = (ctx: SimContext, from: Vec3, dir: { x: number; z: number }, dist: number): number => {
  let k = 0;
  while (k < dist && clearAhead(ctx, from, dir, k + 1)) k++;
  return k;
};

/** Headings tried when none of the first ways is clear: every 22.5 degrees. */
const AROUND = Array.from({ length: 16 }, (_, k) => ({ x: Math.sin((k * Math.PI) / 8), z: Math.cos((k * Math.PI) / 8) }));
/** Metres of clear way one unit of running away from the car is worth, when he picks a way round what blocks him. */
const AWAY_WEIGHT = 4;
/** He turns back on the way he ran (more than about 120 degrees) only when no other way is clear just ahead. */
const BACK_COS = -0.5;

/**
 * The way he runs off: back along the road the car came and away from its side, else straight
 * back, out to the side, ahead and away, or ahead; the first with `LOOK_AHEAD` clear that does not
 * turn him back on the way he ran. Else, as
 * context steering picks a heading (Reynolds' flee scored over sampled directions), the heading
 * of `AROUND` with the most clear way and the most away from the car, not back on the way he ran
 * while another is clear just ahead: with the five ways only, a walled pocket off the pavement
 * sent him to and fro between its ends (G-990).
 */
const wayOut = (ctx: SimContext, from: Vec3, d: EjectedDriver): { x: number; z: number } => {
  const f = { x: Math.sin(d.yaw), z: Math.cos(d.yaw) };
  const l = leftOf(d.yaw);
  const unit = (x: number, z: number) => ({ x: x / Math.hypot(x, z), z: z / Math.hypot(x, z) });
  const ways = [unit(l.x * 0.5 - f.x, l.z * 0.5 - f.z), { x: -f.x, z: -f.z }, l, unit(l.x * 0.5 + f.x, l.z * 0.5 + f.z), f];
  const back = (w: { x: number; z: number }) => d.away !== undefined && w.x * d.away.x + w.z * d.away.z < BACK_COS;
  const first = ways.find((w) => !back(w) && clearAhead(ctx, from, w, LOOK_AHEAD));
  if (first) return first;
  const off = Math.hypot(from.x - d.spot.x, from.z - d.spot.z);
  const away = off > 1e-6 ? { x: (from.x - d.spot.x) / off, z: (from.z - d.spot.z) / off } : l;
  const scored = AROUND.map((w) => {
    const clear = clearFor(ctx, from, w, LOOK_AHEAD);
    return { w, clear, back: back(w), score: clear + AWAY_WEIGHT * (w.x * away.x + w.z * away.z) };
  });
  const open = scored.filter((c) => c.clear >= KEEP_CLEAR && !c.back);
  const pick = (open.length > 0 ? open : scored).reduce((a, b) => (b.score > a.score ? b : a));
  return pick.w;
};

/** Runs away from the car's side, sliding along what stands in the way. */
const run = (ctx: SimContext, e: Entity, away: { x: number; z: number }, dt: number): void => {
  delete e.carPose;
  let x = e.position.x + away.x * RUN.speed * dt;
  let z = e.position.z + away.z * RUN.speed * dt;
  for (const c of solidIndexOf(ctx.world).collidersNear(x - RADIUS, z - RADIUS, x + RADIUS, z + RADIUS)) {
    if (c.box.max.y <= e.position.y + 0.45 || c.box.min.y >= e.position.y + 1.8) continue;
    ({ x, z } = pushCircleOut(c, x, z, RADIUS));
  }
  e.prevPosition = { ...e.position };
  e.velocity = { x: (x - e.position.x) / dt, y: 0, z: (z - e.position.z) / dt };
  e.position = { x, y: e.position.y, z };
  e.yaw = Math.atan2(away.x, away.z);
  e.prevYaw = e.yaw;
};

/** Every ejected driver on by a step; the ones out of the way leave the world. */
export const stepEjectedDrivers = (ctx: SimContext): void => {
  for (const e of [...ctx.world.with("ejected").entities].sort((a, b) => a.id - b.id)) {
    if (stepDriver(ctx, e, ctx.dt)) {
      ctx.world.remove(e);
      ctx.streamer.streamedOut.add(e.id);
    }
  }
};
