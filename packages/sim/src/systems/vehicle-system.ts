import { type EntityId, isDrivable, vehicleSpec } from "@seki/core";
import type { Entity } from "../world/components";
import type { SimContext, System } from "../world/context";
import { attitude, toWorld, v3 } from "../world/vehicle/frame";
import { type CarState, forwardSpeed, newCar } from "../world/vehicle/state";
import { driveCar, wake } from "../world/vehicle/step";
import { collideBodies, collideSolids, collideTraffic, placeEntity, worldGround } from "../world/vehicle/world-car";
import { offend } from "../world/street";
import { BODY } from "../world/factory";
import { BODY_RADIUS } from "../content/walker-size";
import { solidIndexOf } from "../world/solid-index";
import { circleTouches } from "../world/solids";
import { STEP_HEIGHT } from "./step";

/** Ids of the player's cars: past every route's block of the traffic's ids (`VEHICLE_ID_BASE`). */
export const PLAYER_CAR_ID_BASE = 3_990_000;
/** Most cars she leaves standing in the world; an older one goes when she takes another. */
const LEFT_CARS = 3;
/** How near a street car's side she must be to take it (m), and the most it may drive by then (m/s). */
export const ENTER_REACH = 2.4;
export const ENTER_SPEED = 6;
/** The prompt of a street car she can take (a key of the content catalogs, ADR-0056). */
export const TAKE_CAR_PROMPT = "prompt.car.take";
/** Slow enough to get out (m/s). */
const EXIT_SPEED = 3;
/** Crash speed into a wall or a car that counts as a hit (m/s). */
const HIT_SPEED = 2.5;
/** How fast the free look's turn round the car comes back behind it (1/s). */
const LOOK_BACK = 1.5;

type Car = Entity & { car: CarState };

/** The street car she can take: drivable, within reach of its side, slow enough; the nearest. */
export const carToTake = (ctx: SimContext, player: Entity): (Entity & { vehicle: NonNullable<Entity["vehicle"]> }) | null => {
  let best: { e: Entity & { vehicle: NonNullable<Entity["vehicle"]> }; d: number } | null = null;
  for (const v of ctx.world.with("vehicle")) {
    if (v.view?.kind !== "vehicle" || !isDrivable(v.view.model) || v.vehicle.v > ENTER_SPEED) continue;
    const dx = player.position.x - v.position.x;
    const dz = player.position.z - v.position.z;
    const [tx, tz] = [Math.sin(v.yaw), Math.cos(v.yaw)];
    const fwd = Math.abs(dx * tx + dz * tz) - v.vehicle.half.l;
    const lat = Math.abs(dx * tz - dz * tx) - v.vehicle.half.w;
    const d = Math.hypot(Math.max(fwd, 0), Math.max(lat, 0));
    if (d <= ENTER_REACH && Math.abs(player.position.y - v.position.y) < 2 && (!best || d < best.d)) best = { e: v, d };
  }
  return best?.e ?? null;
};

/**
 * Takes a street car (ADR-0097 §3, a carjacking): the street's vehicle leaves the traffic (its
 * slot comes back later out of sight, as any vehicle of the lane), a car with physics takes its
 * place, its speed and heading, and the player sits in it. Its driver runs off (the crime's
 * witnesses and the wanted level follow the event, ADR-0091).
 */
export const takeCar = (ctx: SimContext, player: Entity, v: Entity & { vehicle: NonNullable<Entity["vehicle"]> }, next: number): Car => {
  const view = v.view!.kind === "vehicle" ? v.view! : { kind: "vehicle" as const, model: "sedan" as const, tint: 0 };
  const car = newCar(view.model, v.position.x, v.position.y, v.position.z, v.yaw);
  const f = toWorld(car.q, v3(0, 0, 1));
  car.vel = v3(f.x * v.vehicle.v, 0, f.z * v.vehicle.v);
  // Its driver pulled out: an assault in the crime's rules (ADR-0029), if anyone sees it.
  offend(ctx, "assault", v.position);
  ctx.world.remove(v);
  ctx.streamer.streamedOut.add(v.id);
  const id = PLAYER_CAR_ID_BASE + next;
  const e = ctx.world.add({ id, position: { ...v.position }, prevPosition: { ...v.position }, yaw: v.yaw, prevYaw: v.yaw, pitch: 0, velocity: { x: 0, y: 0, z: 0 }, view: { kind: "vehicle", model: view.model, tint: view.tint }, car }) as Car;
  ctx.streamer.streamedOut.delete(id);
  ctx.session.driving = id;
  ctx.bus.emit("VehicleEntered", { vehicleId: id, from: "traffic" });
  placeSeat(player, e);
  return e;
};

/** The player in her seat: at the car, still, her body out of the way of the street. */
const placeSeat = (player: Entity, car: Car): void => {
  player.seated = car.id;
  player.position = { x: car.position.x, y: car.position.y, z: car.position.z };
  player.prevPosition = { ...player.position };
  player.velocity = { x: 0, y: 0, z: 0 };
  player.fall = undefined;
};

/** How far out of the car's side she steps (m) and where along it, ahead of the middle. */
const STEP_OUT = 0.7;
const STEP_ALONG = 0.4;

/** True when her body fits at (x, z) on the car's floor: no solid of her height there, no street vehicle. */
const roomFor = (ctx: SimContext, x: number, y: number, z: number, self: EntityId): boolean => {
  const r = BODY_RADIUS;
  const near = { x: 0, z: 0 };
  for (const c of solidIndexOf(ctx.world).collidersNear(x - r, z - r, x + r, z + r)) {
    if (c.box.max.y <= y + STEP_HEIGHT || c.box.min.y >= y + BODY.height) continue;
    if (circleTouches(c, x, z, r, near)) return false;
  }
  for (const v of ctx.world.with("vehicle")) {
    if (v.id === self || Math.abs(v.position.y - y) > 2) continue;
    const [tx, tz] = [Math.sin(v.yaw), Math.cos(v.yaw)];
    const dx = x - v.position.x;
    const dz = z - v.position.z;
    if (Math.abs(dx * tx + dz * tz) < v.vehicle.half.l + r && Math.abs(dx * tz - dz * tx) < v.vehicle.half.w + r) return false;
  }
  return true;
};

/**
 * Gets out on the driver's side (left), or the right when a wall or a car stands at the left;
 * with both sides shut she stays in. Returns whether she got out.
 */
const getOut = (ctx: SimContext, player: Entity, car: Car): boolean => {
  const half = vehicleSpec(car.car.model).half;
  const y = car.position.y;
  const side = [-1, 1]
    .map((s) => toWorld(car.car.q, v3(s * (half.x + STEP_OUT), 0, STEP_ALONG)))
    .find((o) => roomFor(ctx, car.position.x + o.x, y, car.position.z + o.z, car.id));
  if (!side) return false;
  player.position = { x: car.position.x + side.x, y, z: car.position.z + side.z };
  player.prevPosition = { ...player.position };
  player.velocity = { x: 0, y: 0, z: 0 };
  ctx.session.driving = null;
  delete player.seated;
  ctx.bus.emit("VehicleExited", { vehicleId: car.id });
  return true;
};

/**
 * The cars with physics (ADR-0097 §2): after the movement (the player's body does not move while
 * she drives, `movementSystem` and `playerControlSystem` leave her be), before the traffic, which
 * sees the car where this step left it. Enter and leave with the interact key, when nothing else
 * holds the prompt; four substeps of 240 Hz for each car awake; the body against the city.
 */
export const createVehicleSystem = (): System => {
  let next = 0;
  let look = 0;
  return {
    name: "vehicle",
    run(ctx) {
      const player = ctx.world.with("player").first ?? null;
      if (!player || ctx.session.gameOver) return;
      const driving = ctx.session.driving !== null ? ((ctx.world.with("car").entities.find((c) => c.id === ctx.session.driving) as Car | undefined) ?? null) : null;
      if (ctx.session.driving !== null && !driving) {
        ctx.session.driving = null;
        delete player.seated;
      }
      if (ctx.input.interact) {
        if (driving && Math.abs(forwardSpeed(driving.car)) < EXIT_SPEED) getOut(ctx, player, driving);
        else if (!driving && ctx.session.focusPrompt === TAKE_CAR_PROMPT) {
          const v = carToTake(ctx, player);
          if (v) {
            retireOldest(ctx);
            takeCar(ctx, player, v, next++);
            look = 0;
          }
        }
      }
      const ground = worldGround(ctx);
      for (const e of [...ctx.world.with("car").entities].sort((a, b) => a.id - b.id) as Car[]) {
        const mine = e.id === ctx.session.driving;
        driveCar(e.car, mine ? ctx.input : null, ground, ctx.dt);
        const wall = collideSolids(ctx, e.car);
        const traffic = collideTraffic(ctx, e.car, e.id);
        collideBodies(ctx, e.car, e.id);
        const speed = Math.max(wall, traffic.speed);
        if (speed > HIT_SPEED) {
          wake(e.car);
          ctx.bus.emit("VehicleHit", { vehicleId: e.id, other: traffic.speed >= wall ? traffic.other : null, energy: 0.5 * vehicleSpec(e.car.model).mass * speed * speed, at: { ...e.position } });
        }
        placeEntity(e, e.car);
        if (mine) {
          placeSeat(player, e);
          // Free look round the car with the mouse, back behind it when let go.
          look = ctx.input.lookYaw !== 0 ? look + ctx.input.lookYaw : look * Math.max(0, 1 - LOOK_BACK * ctx.dt);
          player.yaw = attitude(e.car.q).yaw + look;
          player.prevYaw = player.yaw;
        }
      }
    },
  };
};

/** Keeps at most `LEFT_CARS` of her cars in the world: the one she left longest ago goes. */
const retireOldest = (ctx: SimContext): void => {
  const mine = ctx.world.with("car").entities.filter((c) => c.id !== ctx.session.driving).sort((a, b) => a.id - b.id);
  for (const c of mine.slice(0, Math.max(0, mine.length - LEFT_CARS + 1))) {
    ctx.world.remove(c);
    ctx.streamer.streamedOut.add(c.id);
  }
};

/** For the HUD: the car she drives, or null. */
export const drivenCar = (ctx: { session: { driving: EntityId | null }; world: SimContext["world"] }): CarState | null =>
  ctx.session.driving === null ? null : ((ctx.world.with("car").entities.find((c) => c.id === ctx.session.driving)?.car as CarState | undefined) ?? null);
