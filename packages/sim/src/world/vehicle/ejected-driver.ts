import type { CarPose, EntityId, Vec3 } from "@seki/core";
import type { EjectedDriver } from "./thrown-types";

export type { EjectedDriver } from "./thrown-types";
import { castViewOf } from "../../content/cast";
import type { Entity } from "../components";
import type { SimContext } from "../context";
import { solidIndexOf } from "../solid-index";
import { circleTouches, pushCircleOut } from "../solids";

/*
 * The driver of a street car she takes (ADR-0097, the user's clips of 21.11): pulled out of the
 * seat (“Removing Driver”), thrown onto the road (“Hit By Car” from the blow on), down a moment,
 * back on the feet (“hard landing” from its crouch) and off at a run, away from the car, until out
 * of the way. A transient figure: unkeyed, never saved, nobody's target.
 */

/** Ids of the ejected drivers: past the player's cars (`PLAYER_CAR_ID_BASE`). */
export const DRIVER_ID_BASE = 3_995_000;

/** The spans of the clips played (seconds of clip) and their pace; `down` and `run` in seconds. */
const PULL = { from: 0, to: 3.6, rate: 1.6 } as const;
const THROW = { from: 2.6, to: 4.8, rate: 1 } as const;
const GETUP = { from: 0.9, to: 2, rate: 1 } as const;
const DOWN = 0.8;
const RUN = { speed: 5.5, seconds: 8 } as const;
/**
 * Where the clips carry the hips (from the clip table, `body-clips.generated.ts`, leg lengths of
 * 0.86 m): pulled out to the car's left by 0.9 leg; thrown on by 1.9 legs and back along the car by 0.28.
 */
const PULLED_OUT = 0.77;
const THROWN_OUT = 1.63;
const THROWN_BACK = 0.24;
const RADIUS = 0.38;

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

/** The pose the renderer lays for the driver now (`Transform.car`), null running. */
const poseOf = (d: EjectedDriver): CarPose | null => {
  const ground = { x: d.spot.x, y: d.floor, z: d.spot.z };
  switch (d.phase) {
    case "pulled":
      return { act: "pulled", t: d.t, yaw: d.yaw, seat: d.spot, floor: d.floor };
    case "thrown":
    case "down":
      // Thrown away from the car: the clip throws to the figure's right, so it faces the car's back.
      return { act: "thrown", t: d.phase === "down" ? THROW.to : d.t, yaw: d.yaw + Math.PI, seat: ground, floor: d.floor };
    case "getup":
      return { act: "getup", t: d.t, yaw: d.yaw + Math.PI, seat: ground, floor: d.floor };
    case "run":
      return null;
  }
};

/** Plays the driver on by `dt`; true once it is out of the way (to be removed). */
const stepDriver = (ctx: SimContext, e: Entity & { ejected: EjectedDriver }, dt: number): boolean => {
  const d = e.ejected;
  const left = leftOf(d.yaw);
  if (d.phase === "pulled") {
    d.t += dt * PULL.rate;
    if (d.t >= PULL.to) {
      d.phase = "thrown";
      d.t = THROW.from;
      d.spot = { x: d.spot.x + left.x * PULLED_OUT, y: d.floor, z: d.spot.z + left.z * PULLED_OUT };
    }
  } else if (d.phase === "thrown") {
    d.t += dt * THROW.rate;
    if (d.t >= THROW.to) [d.phase, d.t] = ["down", 0];
  } else if (d.phase === "down") {
    d.t += dt;
    if (d.t >= DOWN) {
      // The figure lies where the throw left it: up from there.
      const back = { x: -Math.sin(d.yaw), z: -Math.cos(d.yaw) };
      d.spot = { x: d.spot.x + left.x * THROWN_OUT + back.x * THROWN_BACK, y: d.floor, z: d.spot.z + left.z * THROWN_OUT + back.z * THROWN_BACK };
      [d.phase, d.t] = ["getup", GETUP.from];
    }
  } else if (d.phase === "getup") {
    d.t += dt * GETUP.rate;
    if (d.t >= GETUP.to) [d.phase, d.t] = ["run", 0];
  } else {
    // A way clear of walls, picked when he sets off and once a second after.
    if (d.t === 0 || Math.floor(d.t) !== Math.floor(d.t + dt)) d.away = wayOut(ctx, e.position, d.yaw);
    d.t += dt;
    run(ctx, e, d.away ?? left, dt);
    return d.t >= RUN.seconds;
  }
  const pose = poseOf(d);
  e.position = { x: d.spot.x, y: d.floor, z: d.spot.z };
  e.prevPosition = { ...e.position };
  e.velocity = { x: 0, y: 0, z: 0 };
  if (pose) e.carPose = pose;
  return false;
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

/**
 * The way he runs off: back along the road the car came and away from its side, else straight
 * back, out to the side, ahead and away, or ahead; the first with 8 m clear.
 */
const wayOut = (ctx: SimContext, from: Vec3, yaw: number): { x: number; z: number } => {
  const f = { x: Math.sin(yaw), z: Math.cos(yaw) };
  const l = leftOf(yaw);
  const unit = (x: number, z: number) => ({ x: x / Math.hypot(x, z), z: z / Math.hypot(x, z) });
  const ways = [unit(l.x * 0.5 - f.x, l.z * 0.5 - f.z), { x: -f.x, z: -f.z }, l, unit(l.x * 0.5 + f.x, l.z * 0.5 + f.z), f];
  return ways.find((w) => clearAhead(ctx, from, w, 8)) ?? ways[0]!;
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
