import { describe, expect, it } from "vitest";
import { hm } from "@seki/core";
import { Simulation, type Entity } from "../src";
import { P1_RAMP, p1RampY } from "../src/content/alchemia/parking";
import { TRAFFIC_ROUTES, projectOn } from "../src/content/traffic";
import { lanePose, timetable, vehicleCount, vehicleId, vehiclePlan } from "../src/world/traffic";
import { teleportPlayer } from "./helpers";

/**
 * A vehicle comes onto the street, or jumps back onto its timetable, only where its footprint and
 * the way it brakes in are clear of bodies (G-951): one of Alchemia's ramp came up out of Seki's
 * sight 0.55 m from her, in her body, and pushed her 0.69 m aside; a passer-by it drove through.
 */

/**
 * The ramp's way out of P-1 (G-951's lane) and Seki on it 0.6 m off its axis, looking north, as
 * measured (x 411.05), 6 m further down the ramp than z 8: there a car of Bajkowskiego crossing
 * within 25 m (`crowded`) held this seed's car back on its first pass (at z 8 the glitch came on its second, 45 s on).
 */
const OUT = TRAFFIC_ROUTES.length - 1;
const LANE = TRAFFIC_ROUTES[OUT]!;
const G951 = { x: 411.05, y: p1RampY(14), z: 14 };
const S_HER = projectOn(LANE.points, G951.x, G951.z).s;
/** On T0 west of the ramp's trench, looking north, away from it. */
const ON_T0 = { x: P1_RAMP.minX - 6, y: 0, z: 14 };
const BODY = 0.38;

type Car = Entity & { vehicle: NonNullable<Entity["vehicle"]> };

const rush = () => {
  const sim = Simulation.create({ seed: 77, traffic: "high" });
  const now = Math.floor((sim.clock.seconds % 86400) / 60);
  sim.enqueue({ type: "wait", minutes: (hm(8) - now + 1440) % 1440 });
  sim.step();
  return sim;
};

const due = (sim: Simulation, k: number) => timetable(vehiclePlan(sim.seed, OUT, k), sim.clock).s;
/** Metres the lane's car `k` is due to drive before it is at `s`. */
const short = (sim: Simulation, k: number, s: number) => (((s - due(sim, k)) % LANE.length) + LANE.length) % LANE.length;
/** Of the lane's cars on the street now, the one due at `s` soonest. */
const soonest = (sim: Simulation, s: number): number => {
  const count = vehicleCount(sim.seed, OUT, "high", sim.clock);
  expect(count).toBeGreaterThan(0);
  return Array.from({ length: count }, (_, k) => k).reduce((a, b) => (short(sim, b, s) < short(sim, a, s) ? b : a));
};
const cars = (sim: Simulation): Car[] => [...sim.world].filter((e): e is Car => e.vehicle?.route === OUT);
/**
 * Keeps the lane's cars off the street (as if crowded out until then), all but `keep`, and the
 * others within `CLEAR` of the ramp: one crossing the lane near where it appears holds it back.
 */
const CLEAR = 40;
const holdOut = (sim: Simulation, keep = -1) => {
  for (const c of [...sim.world].filter((e): e is Car => e.vehicle !== undefined))
    if (c.id !== keep && (c.vehicle.route === OUT || Math.hypot(c.position.x - G951.x, c.position.z - G951.z) < CLEAR)) sim.world.remove(c);
};

/** Steps until the lane's car `k` is due `before` metres short of `s`, holding the lane's other cars out meanwhile (and `k` unless `keep`). */
const untilDue = (sim: Simulation, k: number, s: number, before: number, keep = false) => {
  for (let i = 0; i < 60 * 45 && short(sim, k, s) > before; i++) {
    holdOut(sim, keep ? vehicleId(OUT, k) : -1);
    sim.step();
  }
  holdOut(sim, keep ? vehicleId(OUT, k) : -1);
  expect(short(sim, k, s)).toBeLessThanOrEqual(before);
};

/** Does a body of radius `r` at `p` lie in a car's footprint? */
const inFootprint = (c: Car, p: { x: number; z: number }, r = BODY): boolean => {
  const [tx, tz] = [Math.sin(c.yaw), Math.cos(c.yaw)];
  const [dx, dz] = [p.x - c.position.x, p.z - c.position.z];
  return Math.abs(dx * tx + dz * tz) < c.vehicle.half.l + r && Math.abs(dx * tz - dz * tx) < c.vehicle.half.w + r;
};

/** Steps `n` times, holding out all but the lane's car `k`, and lists the cars of the lane found round `p` (its position read each step). */
const hitsRound = (sim: Simulation, k: number, p: () => { x: number; z: number }, n: number): string[] => {
  const hits: string[] = [];
  for (let i = 0; i < n; i++) {
    holdOut(sim, vehicleId(OUT, k));
    sim.step();
    for (const c of cars(sim)) if (inFootprint(c, p())) hits.push(`${i}: ${c.id} s ${c.vehicle.s.toFixed(2)}`);
  }
  return hits;
};

describe("a vehicle appearing where a body stands (G-951)", () => {
  it("does not come up out of the player's sight in her body: it waits until she is clear", () => {
    const sim = rush();
    teleportPlayer(sim, G951, 0);
    const k = soonest(sim, S_HER);
    untilDue(sim, k, S_HER, 1);
    // Three looks of the traffic: the car due round her would appear on the first.
    expect(hitsRound(sim, k, () => G951, 30)).toEqual([]);
    const me = sim.player()!.position;
    expect(Math.hypot(me.x - G951.x, me.z - G951.z), "pushed aside").toBeLessThan(0.01);
    // Once she steps off the ramp it comes where its timetable is, out of her sight.
    teleportPlayer(sim, ON_T0, 0);
    let came = false;
    for (let i = 0; i < 30 && !came; i++) {
      holdOut(sim, vehicleId(OUT, k));
      sim.step();
      came = cars(sim).some((c) => c.id === vehicleId(OUT, k));
    }
    expect(came, "the car came once she was clear").toBe(true);
  });

  it("does not jump back onto its timetable into her body", () => {
    const sim = rush();
    teleportPlayer(sim, ON_T0, 0);
    const k = soonest(sim, S_HER);
    untilDue(sim, k, S_HER, 1, true);
    const car = cars(sim).find((c) => c.id === vehicleId(OUT, k));
    expect(car, "the car on the street").toBeDefined();
    // She stands on its timetable's place; it is 50 m off its timetable (its lag reads round the
    // lane's length, as a route's cars go round it again), out of her sight: it jumps back onto it.
    teleportPlayer(sim, G951, lanePose(LANE, S_HER).yaw);
    const back = (due(sim, k) - 50 + LANE.length) % LANE.length;
    const pose = lanePose(LANE, back);
    Object.assign(car!.vehicle, { s: back, v: 0 });
    car!.position = { ...car!.position, x: pose.x, z: pose.z };
    car!.yaw = pose.yaw;
    const at = { ...sim.player()!.position };
    expect(hitsRound(sim, k, () => at, 5)).toEqual([]);
    const me = sim.player()!.position;
    expect(Math.hypot(me.x - at.x, me.z - at.z), "pushed aside").toBeLessThan(0.01);
  });

  it("does not appear round a passer-by on its lane", () => {
    const sim = rush();
    teleportPlayer(sim, ON_T0, 0);
    const k = soonest(sim, S_HER);
    untilDue(sim, k, S_HER, 1);
    const on = lanePose(LANE, S_HER);
    const at = { x: on.x, y: p1RampY(on.z), z: on.z };
    const passer = sim.world.add({ id: 9_900_001, position: at, prevPosition: at, yaw: 0, prevYaw: 0, pitch: 0, body: { radius: BODY, height: 1.8 } });
    expect(hitsRound(sim, k, () => passer.position, 30)).toEqual([]);
  });
});
