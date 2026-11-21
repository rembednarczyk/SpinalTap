import type { CarSnapshot, EntityId } from "@seki/core";
import type { World } from "miniplex";
import type { Entity } from "../components";
import type { SessionState } from "../context";
import { startAct } from "./car-act";
import { type CarState, newCar } from "./state";
import { placeEntity } from "./world-car";

/*
 * The player's cars in a save (ADR-0097, v52): the one she drives and those she left standing.
 * Unkeyed, they are saved by themselves (as the bodies of a won mugging are, `stray-bodies.ts`),
 * each with its body's whole state, so a loaded game drives on as the saved one would; what the
 * step measures afresh (the contacts, the loads, the tyres' forces) is left out.
 */

/** Ids of the player's cars: past every route's block of the traffic's ids (`VEHICLE_ID_BASE`). */
export const PLAYER_CAR_ID_BASE = 3_990_000;

type Car = Entity & { car: CarState };

const cars = (world: World<Entity>): Car[] => [...(world.with("car").entities as Car[])].sort((a, b) => a.id - b.id);

/** The id for her next car: past the highest of those in the world (a load brings them back under theirs). */
export const nextCarId = (world: World<Entity>): EntityId => cars(world).reduce((id, c) => Math.max(id, c.id + 1), PLAYER_CAR_ID_BASE);

const v = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y, z: p.z });

/** Her cars, oldest first. */
export const carsSnapshot = (world: World<Entity>, session: Pick<SessionState, "driving" | "carAct">): CarSnapshot[] =>
  cars(world).map((e) => {
    const c = e.car;
    const look = e.view?.kind === "vehicle" ? e.view : { model: c.model, tint: 0 };
    const mine = e.id === session.driving;
    return {
      model: c.model,
      tint: look.tint,
      pos: v(c.pos),
      q: { w: c.q.w, x: c.q.x, y: c.q.y, z: c.q.z },
      vel: v(c.vel),
      ang: v(c.ang),
      wheels: c.wheels.map((w) => ({ omega: w.omega, compression: w.compression, alpha: w.alpha })),
      rpm: c.rpm,
      gear: c.gear,
      shift: c.shift,
      controls: { ...c.controls },
      asleep: c.asleep,
      still: c.still,
      ...(c.hold ? { hold: v(c.hold) } : {}),
      ...(mine ? { driving: true as const } : {}),
      ...(mine && session.carAct ? { act: { kind: session.carAct.kind, t: session.carAct.t } } : {}),
    };
  });

/** A car's body as saved. */
const carOf = (s: CarSnapshot): CarState => {
  const c = newCar(s.model, s.pos.x, 0, s.pos.z, 0);
  c.pos = v(s.pos);
  c.q = { ...s.q };
  c.vel = v(s.vel);
  c.ang = v(s.ang);
  s.wheels.forEach((w, i) => {
    const wheel = c.wheels[i];
    if (!wheel) return;
    wheel.omega = w.omega;
    wheel.compression = w.compression;
    wheel.alpha = w.alpha;
  });
  c.rpm = s.rpm;
  c.gear = s.gear;
  c.shift = s.shift;
  c.controls = { ...s.controls };
  c.asleep = s.asleep;
  c.still = s.still;
  c.hold = s.hold ? v(s.hold) : null;
  return c;
};

/**
 * Her cars back in the world under ids of their own, in their order; the one she drove with her at
 * its wheel (or getting in or out of it, the clip where it was).
 */
export const restoreCars = (world: World<Entity>, session: Pick<SessionState, "driving" | "carAct">, player: Entity | null, saved: readonly CarSnapshot[] | undefined): void => {
  (saved ?? []).forEach((s, i) => {
    const id = PLAYER_CAR_ID_BASE + i;
    const car = carOf(s);
    const e = world.add({ id, position: v(s.pos), prevPosition: v(s.pos), yaw: 0, prevYaw: 0, pitch: 0, velocity: v(s.vel), view: { kind: "vehicle", model: s.model, tint: s.tint }, car }) as Car;
    placeEntity(e, car);
    e.prevPosition = { ...e.position };
    e.prevYaw = e.yaw;
    if (!s.driving || !player) return;
    session.driving = id;
    session.carAct = s.act ? { ...startAct(s.act.kind), t: s.act.t } : null;
    player.seated = id;
    player.position = { ...e.position };
    player.prevPosition = { ...e.position };
    player.velocity = { x: 0, y: 0, z: 0 };
    player.yaw = e.yaw;
    player.prevYaw = e.yaw;
  });
};
