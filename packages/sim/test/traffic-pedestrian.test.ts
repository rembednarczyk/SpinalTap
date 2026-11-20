import { describe, expect, it } from "vitest";
import { hm } from "@seki/core";
import { Simulation, ground, type Entity } from "../src";
import { TRAFFIC_ROUTES } from "../src/content/traffic";
import { lanePose } from "../src/world/traffic";
import { teleportPlayer } from "./helpers";

/**
 * A vehicle that cannot stop short of a passer-by on its lane does not drive through them (G-953):
 * it pushes them out of its footprint as it does the player. It braked for them before, but one
 * stepping out within its stopping distance stood in its body until it drove off.
 */

type Car = Entity & { vehicle: NonNullable<Entity["vehicle"]> };

const BODY = 0.38;
/** Aleja Tysiąclecia by the market, both carriageways and the trolleybus line. */
const TYSIACLECIA = ground(820, 352);

/** Rush hour on Aleja Tysiąclecia, stepped until a car drives at `speed` at least: the lowest id of those. */
const carAtSpeed = (speed: number): { sim: Simulation; car: Car } => {
  const sim = Simulation.create({ seed: 3, crowd: "high", traffic: "high" });
  const now = Math.floor((sim.clock.seconds % 86400) / 60);
  sim.enqueue({ type: "wait", minutes: (hm(8) - now + 1440) % 1440 });
  sim.step();
  teleportPlayer(sim, TYSIACLECIA, 0);
  for (let i = 0; i < 120; i++) {
    sim.step();
    const car = [...sim.world].filter((e): e is Car => e.vehicle !== undefined && e.vehicle.v >= speed).sort((a, b) => a.id - b.id)[0];
    if (car) return { sim, car };
  }
  throw new Error(`no car at ${speed} m/s`);
};

/** A passer-by's body `ahead` metres past the car's front along its lane, `aside` to its left, walking at `walk` (m/s). */
const passerBy = (sim: Simulation, car: Car, ahead: number, aside = 0, walk = { x: 0, z: 0 }): Entity => {
  const pose = lanePose(TRAFFIC_ROUTES[car.vehicle.route]!, car.vehicle.s + car.vehicle.half.l + BODY + ahead);
  const at = { x: pose.x - pose.tz * aside, y: car.position.y, z: pose.z + pose.tx * aside };
  return sim.world.add({ id: 9_900_002, position: at, prevPosition: at, yaw: 0, prevYaw: 0, pitch: 0, body: { radius: BODY, height: 1.8 }, velocity: { x: walk.x, y: 0, z: walk.z } });
};

/** How deep a body of radius `r` at `p` lies in a car's footprint (m), 0 when outside. */
const depth = (c: Car, p: { x: number; z: number }, r = BODY): number => {
  const [tx, tz] = [Math.sin(c.yaw), Math.cos(c.yaw)];
  const [dx, dz] = [p.x - c.position.x, p.z - c.position.z];
  return Math.max(0, Math.min(c.vehicle.half.l + r - Math.abs(dx * tx + dz * tz), c.vehicle.half.w + r - Math.abs(dx * tz - dz * tx)));
};

/** Steps `n` times and lists the steps that end with `who` in the car's footprint. */
const through = (sim: Simulation, car: Car, who: Entity, n: number): string[] => {
  const hits: string[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    const d = depth(car, who.position);
    if (d > 1e-6) hits.push(`${i}: ${d.toFixed(2)} m in at ${car.vehicle.v.toFixed(2)} m/s`);
  }
  return hits;
};

describe("a vehicle and a passer-by on its lane (G-953)", () => {
  it("stops short of one standing beyond its stopping distance, without touching them", () => {
    const { sim, car } = carAtSpeed(5);
    const who = passerBy(sim, car, 15);
    const at = { ...who.position };
    expect(through(sim, car, who, 240)).toEqual([]);
    expect(car.vehicle.v).toBe(0);
    expect(Math.hypot(who.position.x - at.x, who.position.z - at.z), "pushed").toBeLessThan(1e-9);
  });

  it("pushes one who stepped out within its stopping distance out of its footprint, and stops", () => {
    const { sim, car } = carAtSpeed(5);
    const who = passerBy(sim, car, 0.5);
    const at = { ...who.position };
    // And one standing a floor above them (on a deck over the street), left where they stand.
    const up = { ...at, y: at.y + 4 };
    const above = sim.world.add({ id: 9_900_003, position: up, prevPosition: up, yaw: 0, prevYaw: 0, pitch: 0, body: { radius: BODY, height: 1.8 } });
    expect(through(sim, car, who, 240)).toEqual([]);
    expect(car.vehicle.v).toBe(0);
    // Pushed ahead as it braked: no further than it drove on.
    expect(Math.hypot(who.position.x - at.x, who.position.z - at.z)).toBeLessThan(4);
    expect(above.position, "the one above").toEqual(up);
  });

  it("pushes one walking across into its way out of its footprint", () => {
    const { sim, car } = carAtSpeed(5);
    // From 2.5 m to its left, across its lane at a walk, stepping in just ahead of its front.
    const pose = lanePose(TRAFFIC_ROUTES[car.vehicle.route]!, car.vehicle.s);
    const who = passerBy(sim, car, 1.5, 2.5, { x: pose.tz * 1.3, z: -pose.tx * 1.3 });
    expect(through(sim, car, who, 240)).toEqual([]);
  });
});
