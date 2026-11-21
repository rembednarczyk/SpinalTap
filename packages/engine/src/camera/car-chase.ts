import type { Vec3 } from "@seki/core";
import { ChaseTrail } from "./chase-trail";

/*
 * The camera behind the car she drives (ADR-0097), after the chase view of the owner's PodRcr
 * (`src/render/CockpitCamera.ts`, `updateChase`): it stands on the road the car has just driven
 * (`ChaseTrail`), so in a turn it stays off the walls and the car swings to the side of the frame;
 * its place against the car follows with a lag (`FOLLOW`), so the distance does not grow with the
 * speed; it looks ahead of the car, and stays some way above it. Faster, the view widens and the
 * camera comes in by as much, so the car stays the same size on screen and only the street runs
 * by faster. Turned with the mouse, it swings round the car instead and comes back behind it as
 * the simulation brings the look back.
 */

/** Behind and over the car's ground (m) at rest, and how far ahead of it the camera looks, at what height. */
const DISTANCE = 6.2;
const HEIGHT = 2.3;
const LOOK_AHEAD = 7;
const LOOK_UP = 1.1;
/** How fast its place against the car follows (1/s). */
const FOLLOW = 6;
/** At least this much over the car's ground (m). */
const MIN_ABOVE = 1.6;
/** The widest the view opens with the speed, as a share of the field of view, and from what speed (m/s). */
const WIDEN = 0.22;
const WIDEN_AT = 40;
/** A look turned further than this (rad) swings the camera round the car instead of the trail. */
const LOOKING = 0.05;

export interface ChaseShot {
  readonly eye: Vec3;
  readonly target: Vec3;
  /** How much wider than the base the view should be (0..WIDEN). */
  readonly widen: number;
}

export class CarChase {
  private readonly trail = new ChaseTrail();
  private offset: Vec3 | null = null;
  private last: Vec3 | null = null;
  private speed = 0;

  /** Drops the trail and the lag: the next car starts with the camera behind it. */
  reset(): void {
    this.trail.clear();
    this.offset = null;
    this.last = null;
    this.speed = 0;
  }

  /** The camera's place and aim this frame, for the car on the ground at `car` heading `yaw`, looked round by `look` (rad). */
  update(car: Vec3, yaw: number, look: number, dt: number): ChaseShot {
    if (this.last && dt > 0) this.speed += (Math.hypot(car.x - this.last.x, car.z - this.last.z) / dt - this.speed) * Math.min(1, dt * 4);
    this.last = { ...car };
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const widen = WIDEN * Math.min(1, this.speed / WIDEN_AT);
    // The car's size on screen goes as 1/(distance · tan(fov/2)): wider by `widen`, nearer by as much.
    const reach = 1 / (1 + widen);
    const distance = DISTANCE * reach;
    this.trail.record(car.x, car.z, DISTANCE + 10);
    const behind =
      Math.abs(look) > LOOKING
        ? { x: car.x - Math.sin(yaw + look) * distance, z: car.z - Math.cos(yaw + look) * distance }
        : this.trail.pointBehind(car.x, car.z, distance, -fx, -fz);
    const goal = { x: behind.x - car.x, y: HEIGHT * reach, z: behind.z - car.z };
    const k = this.offset ? 1 - Math.exp(-FOLLOW * dt) : 1;
    const o = this.offset ?? goal;
    this.offset = { x: o.x + (goal.x - o.x) * k, y: o.y + (goal.y - o.y) * k, z: o.z + (goal.z - o.z) * k };
    const eye = { x: car.x + this.offset.x, y: car.y + Math.max(MIN_ABOVE, this.offset.y), z: car.z + this.offset.z };
    const target = { x: car.x + Math.sin(yaw + look) * LOOK_AHEAD * reach, y: car.y + LOOK_UP, z: car.z + Math.cos(yaw + look) * LOOK_AHEAD * reach };
    return { eye, target, widen };
  }
}
