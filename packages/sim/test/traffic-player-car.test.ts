import { EMPTY_INPUT, type InputFrame, hm, vehicleSpec } from "@seki/core";
import { describe, expect, it } from "vitest";
import { Simulation, ground, type Entity } from "../src";
import { TRAFFIC_ROUTES } from "../src/content/traffic";
import { TAKE_CAR_PROMPT } from "../src/systems/vehicle-system";
import { lanePose } from "../src/world/traffic";
import { newCar } from "../src/world/vehicle/state";
import { teleportPlayer } from "./helpers";

/**
 * The street's traffic against the player's car (ADR-0097, the screenshots of 21.11): a car of the
 * traffic stops behind her car standing in its lane, as behind the vehicle ahead, instead of
 * driving into it and shoving it along.
 */
type Car = Entity & { vehicle: NonNullable<Entity["vehicle"]> };
/**
 * How far along its lane the car she takes is at most (m). The first moving car of the city used to
 * do; with the Podzamcze row north of z 580 (23.11.2026) it was on Lubartowska 307 m along a 432 m
 * lane, and no car came up from the lane's start in the 40 s.
 */
const NEAR_START = 150;
const press = (over: Partial<InputFrame>): InputFrame => ({ ...EMPTY_INPUT, ...over });

describe("the traffic and the player's car", () => {
  it("stops behind her car left standing in its lane, without driving into it", () => {
    const sim = Simulation.create({ seed: 3, crowd: "off", traffic: "high" });
    const now = Math.floor((sim.clock.seconds % 86400) / 60);
    sim.enqueue({ type: "wait", minutes: (hm(8) - now + 1440) % 1440 });
    sim.step();
    teleportPlayer(sim, ground(820, 352), 0);
    let taken = false;
    let route = -1;
    let along = 0;
    for (let i = 0; i < 200 && !taken; i++) {
      sim.step();
      // A car under `NEAR_START` along its lane: the lane's next cars, from its start, come up behind the one left there within the wait below.
      const car = [...sim.world].filter((e): e is Car => e.vehicle !== undefined && e.vehicle.v > 4 && e.vehicle.s < NEAR_START && e.view?.kind === "vehicle" && e.view.model !== "trolleybus").sort((a, b) => a.id - b.id)[0];
      if (!car) continue;
      [route, along] = [car.vehicle.route, car.vehicle.s];
      const pose = lanePose(TRAFFIC_ROUTES[route]!, along + car.vehicle.half.l + 6);
      teleportPlayer(sim, { x: pose.x, y: car.position.y, z: pose.z }, car.yaw + Math.PI);
      for (let k = 0; k < 300 && sim.session.focusPrompt !== TAKE_CAR_PROMPT; k++) sim.step();
      sim.step(press({ interact: true }));
      taken = sim.session.driving !== null;
    }
    expect(taken).toBe(true);
    // Getting in and out may play out over steps (the acts of ADR-0097, once in main).
    const acting = () => (sim.session as { carAct?: unknown }).carAct != null;
    // In and seated, she stops it and gets out; the car is then left on the lane's line, ahead of
    // where she took it (the traffic of that lane comes up behind it), and she far off.
    for (let i = 0; i < 400 && acting(); i++) sim.step();
    const mine = [...sim.world].find((e) => e.id === sim.session.driving)!;
    for (let i = 0; i < 300 && Math.hypot(mine.car!.vel.x, mine.car!.vel.z) > 0.3; i++) sim.step(press({ drive: { throttle: 0, brake: 1, steer: 0, handbrake: true } }));
    for (let i = 0; i < 10 && sim.session.driving !== null && !acting(); i++) sim.step(press({ interact: i % 2 === 0 }));
    for (let i = 0; i < 400 && acting(); i++) sim.step();
    expect(sim.session.driving).toBeNull();
    const lane = TRAFFIC_ROUTES[route]!;
    const at = lanePose(lane, along + 30);
    const floor = ground(at.x, at.z);
    mine.car = newCar(mine.car!.model, at.x, floor.y, at.z, at.yaw);
    teleportPlayer(sim, ground(at.x + 40, at.z + 40), 0);
    const half = vehicleSpec(mine.car.model).half;
    let queued = false;
    let into = -Infinity;
    // Up to 40 s for one of the lane's cars to come up and stop behind it; then 3 s more of it standing there.
    let until = 60 * 40;
    for (let i = 0; i < until; i++) {
      sim.step();
      for (const v of sim.world.with("vehicle")) {
        if (v.vehicle.route !== route) continue;
        const dx = mine.position.x - v.position.x;
        const dz = mine.position.z - v.position.z;
        const [tx, tz] = [Math.sin(v.yaw), Math.cos(v.yaw)];
        const fwd = dx * tx + dz * tz;
        if (fwd <= 0 || Math.abs(dx * tz - dz * tx) > half.x + v.vehicle.half.w) continue;
        // How far its nose went into the car's tail (m): above zero they meet.
        into = Math.max(into, v.vehicle.half.l + half.z - fwd);
        if (fwd < 15 && v.vehicle.v < 0.3 && !queued) {
          queued = true;
          until = Math.min(until, i + 60 * 3);
        }
      }
    }
    expect(queued).toBe(true);
    expect(into).toBeLessThan(0);
  });
});
