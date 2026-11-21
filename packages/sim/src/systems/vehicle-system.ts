import { type EntityId, isDrivable, vehicleSpec } from "@seki/core";
import type { Entity } from "../world/components";
import type { SimContext, System } from "../world/context";
import { type V3, attitude, toWorld, v3 } from "../world/vehicle/frame";
import { type CarState, forwardSpeed, newCar } from "../world/vehicle/state";
import { type CarActState, HELD, JACK_WAIT, seatInWorld, startAct, stepAct } from "../world/vehicle/car-act";
import { DRIVER_ID_BASE, ejectDriver, stepEjectedDrivers } from "../world/vehicle/ejected-driver";
import { stepStruckBodies } from "../world/vehicle/struck";
import { driveCar, wake } from "../world/vehicle/step";
import { takeHit } from "../world/vehicle/damage";
import { collideBodies, collideSolids, collideTraffic, placeEntity, worldGround } from "../world/vehicle/world-car";
import { offend } from "../world/street";
import { BODY } from "../world/factory";
import { BODY_RADIUS } from "../content/walker-size";
import { solidIndexOf } from "../world/solid-index";
import { circleTouches } from "../world/solids";
import { STEP_HEIGHT } from "./step";
import { PLAYER_CAR_ID_BASE, nextCarId } from "../world/vehicle/saved-cars";

export { PLAYER_CAR_ID_BASE };
/** Most cars she leaves standing in the world; an older one goes when she takes another. */
const LEFT_CARS = 3;
/** How near a street car's side she must be to take it (m), and the most it may drive by then (m/s). */
export const ENTER_REACH = 2.4;
export const ENTER_SPEED = 6;
/** The prompt of a street car she can take (a key of the content catalogs, ADR-0056). */
export const TAKE_CAR_PROMPT = "prompt.car.take";
/** Slow enough to get out (m/s). */
const EXIT_SPEED = 3;
/** The prompt at the wheel while she can get out: the HUD names the key, a phone shows its "Use" button (a catalog key, ADR-0056). */
export const EXIT_CAR_PROMPT = "prompt.car.exit";

/** She can get out now: at the wheel of her car, not getting in or out, the car slow enough. */
export const canGetOut = (ctx: SimContext): boolean => {
  if (ctx.session.carAct) return false;
  const car = drivenCar(ctx);
  return car !== null && Math.abs(forwardSpeed(car)) < EXIT_SPEED;
};
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
export const takeCar = (ctx: SimContext, player: Entity, v: Entity & { vehicle: NonNullable<Entity["vehicle"]> }): Car => {
  const view = v.view!.kind === "vehicle" ? v.view! : { kind: "vehicle" as const, model: "sedan" as const, tint: 0 };
  const car = newCar(view.model, v.position.x, v.position.y, v.position.z, v.yaw);
  // It stopped for her: she pulls the door open and gets in (ADR-0097, clip of 21.11), the car still.
  // Its driver pulled out: an assault in the crime's rules (ADR-0029), if anyone sees it.
  offend(ctx, "assault", v.position);
  ctx.world.remove(v);
  ctx.streamer.streamedOut.add(v.id);
  // Past her cars in the world: a loaded game brings them back under theirs (v52).
  const id = nextCarId(ctx.world);
  const e = ctx.world.add({ id, position: { ...v.position }, prevPosition: { ...v.position }, yaw: v.yaw, prevYaw: v.yaw, pitch: 0, velocity: { x: 0, y: 0, z: 0 }, view: { kind: "vehicle", model: view.model, tint: view.tint }, car }) as Car;
  ctx.streamer.streamedOut.delete(id);
  ctx.session.driving = id;
  // Its driver pulled out and thrown onto the road first (ADR-0097, clips of 21.11), then she gets in.
  ejectDriver(ctx, DRIVER_ID_BASE + (id - PLAYER_CAR_ID_BASE), seatInWorld(car), v.yaw, v.position.y);
  ctx.session.carAct = startAct("enter", JACK_WAIT);
  ctx.bus.emit("VehicleEntered", { vehicleId: id, from: "traffic" });
  placeSeat(player, e);
  return e;
};

/** A car of her own she left standing (ADR-0097): within reach of its side, slow enough; the nearest. */
export const ownCarToEnter = (ctx: SimContext, player: Entity): Car | null => {
  let best: { e: Car; d: number } | null = null;
  for (const e of ctx.world.with("car").entities as Car[]) {
    if (e.id === ctx.session.driving || Math.abs(forwardSpeed(e.car)) > ENTER_SPEED) continue;
    const half = vehicleSpec(e.car.model).half;
    const yaw = attitude(e.car.q).yaw;
    const dx = player.position.x - e.position.x;
    const dz = player.position.z - e.position.z;
    const [tx, tz] = [Math.sin(yaw), Math.cos(yaw)];
    const fwd = Math.abs(dx * tx + dz * tz) - half.z;
    const lat = Math.abs(dx * tz - dz * tx) - half.x;
    const d = Math.hypot(Math.max(fwd, 0), Math.max(lat, 0));
    if (d <= ENTER_REACH && Math.abs(player.position.y - e.position.y) < 2 && (!best || d < best.d)) best = { e, d };
  }
  return best?.e ?? null;
};

/** She gets back into a car of her own: the act of getting in from its door, then at the wheel. */
const getIn = (ctx: SimContext, player: Entity, car: Car): void => {
  wake(car.car);
  ctx.session.driving = car.id;
  ctx.session.carAct = startAct("enter");
  ctx.bus.emit("VehicleEntered", { vehicleId: car.id, from: "own" });
  placeSeat(player, car);
};

/**
 * The player in her seat: at the car, still, her body out of the way of the street. Sitting down
 * (`snap`) she is there at once; driving on, her last place stays her step's start
 * (`interpolationSystem`), so she is drawn between the steps as the car is. Set to her new place
 * every step, she jumped from step to step while the car glided, and the camera behind her shook
 * (user's notes of 21.11).
 */
const placeSeat = (player: Entity, car: Car, snap = true): void => {
  player.seated = car.id;
  player.position = { x: car.position.x, y: car.position.y, z: car.position.z };
  if (snap) player.prevPosition = { ...player.position };
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

/** The side she can get out on: the driver's (left) when there is room for her, else the right; null with both shut. */
const exitSide = (ctx: SimContext, car: Car): { readonly left: boolean; readonly at: V3 } | null => {
  const half = vehicleSpec(car.car.model).half;
  for (const s of [-1, 1]) {
    const at = toWorld(car.car.q, v3(s * (half.x + STEP_OUT), 0, STEP_ALONG));
    if (roomFor(ctx, car.position.x + at.x, car.position.y, car.position.z + at.z, car.id)) return { left: s < 0, at };
  }
  return null;
};

/** She stands beside the car at `at` (from its middle), out of it. */
const stepOut = (ctx: SimContext, player: Entity, car: Car, at: V3): void => {
  player.position = { x: car.position.x + at.x, y: car.position.y, z: car.position.z + at.z };
  player.prevPosition = { ...player.position };
  player.velocity = { x: 0, y: 0, z: 0 };
  ctx.session.driving = null;
  ctx.session.carAct = null;
  delete player.seated;
  delete player.carPose;
  ctx.bus.emit("VehicleExited", { vehicleId: car.id });
};

/**
 * Gets out on the driver's side (left) with the clip of getting out, or at once on the right when
 * a wall or a car stands at the left; with both sides shut she stays in.
 */
const getOut = (ctx: SimContext, player: Entity, car: Car): void => {
  const side = exitSide(ctx, car);
  if (!side) return;
  if (side.left) ctx.session.carAct = startAct("exit");
  else stepOut(ctx, player, car, side.at);
};

/** The act's clip played through: seated at the wheel, or out by the door (the right one if the left was shut meanwhile). */
const endAct = (ctx: SimContext, player: Entity, car: Car, act: CarActState): void => {
  if (act.kind === "enter") {
    ctx.session.carAct = null;
    return;
  }
  const side = exitSide(ctx, car);
  if (side) stepOut(ctx, player, car, side.at);
  else ctx.session.carAct = null;
};

/**
 * The cars with physics (ADR-0097 §2): after the movement (the player's body does not move while
 * she drives, `movementSystem` and `playerControlSystem` leave her be), before the traffic, which
 * sees the car where this step left it. Enter and leave with the interact key, when nothing else
 * holds the prompt; four substeps of 240 Hz for each car awake; the body against the city.
 */
export const createVehicleSystem = (): System => {
  let look = 0;
  /** Seconds at the wheel (the driving clip's loop) and since the horn was pressed, and whether it was held. */
  let seatTime = 0;
  let hornTime = 0;
  let hornHeld = false;
  return {
    name: "vehicle",
    run(ctx) {
      stepEjectedDrivers(ctx);
      stepStruckBodies(ctx);
      const player = ctx.world.with("player").first ?? null;
      if (!player || ctx.session.gameOver) return;
      const driving = ctx.session.driving !== null ? ((ctx.world.with("car").entities.find((c) => c.id === ctx.session.driving) as Car | undefined) ?? null) : null;
      if (ctx.session.driving !== null && !driving) {
        ctx.session.driving = null;
        ctx.session.carAct = null;
        delete player.seated;
        delete player.carPose;
      }
      if (ctx.input.interact && !ctx.session.carAct) {
        if (driving && Math.abs(forwardSpeed(driving.car)) < EXIT_SPEED) getOut(ctx, player, driving);
        else if (!driving && ctx.session.focusPrompt === TAKE_CAR_PROMPT) {
          // Her own car before the street's: the one she left is hers to take back.
          const own = ownCarToEnter(ctx, player);
          const v = own ? null : carToTake(ctx, player);
          if (own) {
            getIn(ctx, player, own);
            look = 0;
          } else if (v) {
            retireOldest(ctx);
            takeCar(ctx, player, v);
            look = 0;
          }
        }
      }
      const ground = worldGround(ctx);
      for (const e of [...ctx.world.with("car").entities].sort((a, b) => a.id - b.id) as Car[]) {
        const mine = e.id === ctx.session.driving;
        driveCar(e.car, mine ? (ctx.session.carAct ? HELD : ctx.input) : null, ground, ctx.dt);
        const wall = collideSolids(ctx, e.car);
        const traffic = collideTraffic(ctx, e.car, e.id);
        collideBodies(ctx, e.car, e.id);
        const speed = Math.max(wall, traffic.speed);
        if (speed > HIT_SPEED) {
          wake(e.car);
          const energy = 0.5 * vehicleSpec(e.car.model).mass * speed * speed;
          ctx.bus.emit("VehicleHit", { vehicleId: e.id, other: traffic.speed >= wall ? traffic.other : null, energy, at: { ...e.position } });
          // The body takes the hit (ADR-0097 §5): past a wreck's worth the engine dies.
          if (takeHit(e.car, energy)) ctx.bus.emit("VehicleWrecked", { vehicleId: e.id, at: { ...e.position } });
        }
        placeEntity(e, e.car);
        if (mine) {
          placeSeat(player, e, false);
          // Free look round the car with the mouse, back behind it when let go.
          look = ctx.input.lookYaw !== 0 ? look + ctx.input.lookYaw : look * Math.max(0, 1 - LOOK_BACK * ctx.dt);
          player.yaw = attitude(e.car.q).yaw + look;
          const horn = !ctx.session.carAct && ctx.input.horn === true;
          if (horn && !hornHeld) {
            hornTime = 0;
            ctx.bus.emit("VehicleHorn", { vehicleId: e.id, at: { ...e.position } });
          }
          hornHeld = horn;
          seatTime += ctx.dt;
          hornTime += ctx.dt;
          const playing = ctx.session.carAct;
          if (playing && stepAct(playing, ctx.dt)) endAct(ctx, player, e, playing);
          const act = ctx.session.carAct;
          if (player.seated !== undefined) player.carPose = { act: act ? act.kind : horn ? "horn" : "drive", t: act ? act.t : horn ? hornTime : seatTime, yaw: attitude(e.car.q).yaw, seat: seatInWorld(e.car), floor: e.position.y };
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
