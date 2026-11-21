import type { CarPose, Vec3 } from "@seki/core";
import type { World } from "miniplex";
import type { Struck } from "./thrown-types";

export type { Struck } from "./thrown-types";
import type { Entity } from "../components";
import type { SimContext } from "../context";

/*
 * Someone thrown onto the road (ADR-0097, the user's clip “Hit By Car” of 21.11): a taken car's
 * driver after being pulled out, or a pedestrian a car runs into. Thrown from the blow on, down a
 * moment, back on the feet (the hard landing's crouch to standing), then left to whatever moves
 * them (their own AI, or the driver's run). Held in place meanwhile: whatever else moved them in
 * the step is undone.
 */

const THROW = { from: 2.6, to: 4.8, rate: 1 } as const;
const GETUP = { from: 0.9, to: 2, rate: 1 } as const;
const DOWN = 0.8;
/** Where the throw carries the hips (the clip table, leg lengths of 0.86 m): to the figure's right, and ahead. */
const THROWN_SIDE = 1.63;
const THROWN_AHEAD = 0.24;

/** Throws `e` from where it stands along `away` (a unit vector on the ground). */
export const strike = (world: World<Entity>, e: Entity, away: { x: number; z: number }): void => {
  // The clip throws to the figure's right: it faces a quarter turn left of the way it flies.
  const yaw = Math.atan2(away.x, away.z) - Math.PI / 2;
  world.addComponent(e, "struck", { phase: "thrown", t: THROW.from, yaw, spot: { ...e.position } });
  e.velocity = { x: 0, y: 0, z: 0 };
};

/** The pose the renderer lays now (`Transform.car`). */
const poseOf = (s: Struck): CarPose => ({
  act: s.phase === "getup" ? "getup" : "thrown",
  t: s.phase === "down" ? THROW.to : s.t,
  yaw: s.yaw,
  seat: s.spot,
  floor: s.spot.y,
});

/** Plays the blow on by `dt`; true once the figure stands again (the component is gone then). */
export const stepStruck = (world: World<Entity>, e: Entity, dt: number): boolean => {
  if (!e.struck) return true;
  const s = e.struck;
  if (s.phase === "thrown") {
    s.t += dt * THROW.rate;
    if (s.t >= THROW.to) [s.phase, s.t] = ["down", 0];
  } else if (s.phase === "down") {
    s.t += dt;
    if (s.t >= DOWN) {
      // Up from where the throw left the figure.
      const right = { x: Math.cos(s.yaw), z: -Math.sin(s.yaw) };
      const ahead = { x: Math.sin(s.yaw), z: Math.cos(s.yaw) };
      s.spot = { x: s.spot.x + right.x * THROWN_SIDE + ahead.x * THROWN_AHEAD, y: s.spot.y, z: s.spot.z + right.z * THROWN_SIDE + ahead.z * THROWN_AHEAD };
      [s.phase, s.t] = ["getup", GETUP.from];
    }
  } else {
    s.t += dt * GETUP.rate;
    if (s.t >= GETUP.to) {
      e.position = { ...s.spot };
      e.prevPosition = { ...s.spot };
      e.yaw = s.yaw;
      e.prevYaw = s.yaw;
      world.removeComponent(e, "struck");
      delete e.carPose;
      return true;
    }
  }
  e.position = { ...s.spot };
  e.prevPosition = { ...s.spot };
  e.velocity = { x: 0, y: 0, z: 0 };
  e.carPose = poseOf(s);
  return false;
};

/** Everyone thrown down on by a step (the ejected drivers go their own way, `ejected-driver.ts`). */
export const stepStruckBodies = (ctx: SimContext): void => {
  for (const e of [...ctx.world.with("struck").entities].sort((a, b) => a.id - b.id)) if (!e.ejected) stepStruck(ctx.world, e, ctx.dt);
};
