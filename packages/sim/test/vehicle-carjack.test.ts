import { EMPTY_INPUT, type InputFrame, hm } from "@seki/core";
import { describe, expect, it } from "vitest";
import { Simulation, ground, type Entity } from "../src";
import { TRAFFIC_ROUTES } from "../src/content/traffic";
import { TAKE_CAR_PROMPT } from "../src/systems/vehicle-system";
import { lanePose } from "../src/world/traffic";
import { teleportPlayer } from "./helpers";

/**
 * Taking a car from the street's traffic (ADR-0097 §3): she stands in a car's way, it stops, the
 * prompt offers it, the key takes it; the throttle drives it along the street, the key gets her
 * out beside it when it is slow, and the car stays where she left it.
 */
type Car = Entity & { vehicle: NonNullable<Entity["vehicle"]> };

const TYSIACLECIA = ground(820, 352);
const press = (over: Partial<InputFrame>): InputFrame => ({ ...EMPTY_INPUT, ...over });

/** Rush hour on Aleja Tysiąclecia with her standing 6 m ahead of a driving car, in its lane. */
const inTheWay = (): { sim: Simulation; car: Car } => {
  const sim = Simulation.create({ seed: 3, crowd: "off", traffic: "high" });
  const now = Math.floor((sim.clock.seconds % 86400) / 60);
  sim.enqueue({ type: "wait", minutes: (hm(8) - now + 1440) % 1440 });
  sim.step();
  teleportPlayer(sim, TYSIACLECIA, 0);
  for (let i = 0; i < 200; i++) {
    sim.step();
    const car = [...sim.world].filter((e): e is Car => e.vehicle !== undefined && e.vehicle.v > 4 && e.view?.kind === "vehicle" && e.view.model !== "trolleybus").sort((a, b) => a.id - b.id)[0];
    if (car) {
      const pose = lanePose(TRAFFIC_ROUTES[car.vehicle.route]!, car.vehicle.s + car.vehicle.half.l + 6);
      teleportPlayer(sim, { x: pose.x, y: car.position.y, z: pose.z }, car.yaw + Math.PI);
      return { sim, car };
    }
  }
  throw new Error("no car on the avenue");
};

const playerOf = (sim: Simulation): Entity => [...sim.world].find((e) => e.player)!;

describe("taking a car from the traffic (ADR-0097)", () => {
  it("stops for her, offers itself, and drives off with her at the wheel; she gets out beside it", () => {
    const { sim, car } = inTheWay();
    let offered = false;
    for (let i = 0; i < 300 && !offered; i++) {
      sim.step();
      offered = sim.session.focusPrompt === TAKE_CAR_PROMPT;
    }
    expect(offered).toBe(true);
    sim.step(press({ interact: true }));
    expect(sim.session.driving).not.toBeNull();
    expect([...sim.world].some((e) => e.id === car.id)).toBe(false);
    const mine = () => [...sim.world].find((e) => e.id === sim.session.driving)!;
    const from = { ...mine().position };
    for (let i = 0; i < 180; i++) sim.step(press({ moveZ: 1 }));
    const driven = Math.hypot(mine().position.x - from.x, mine().position.z - from.z);
    expect(driven).toBeGreaterThan(15);
    // She sits in it, her view follows its heading.
    expect(Math.hypot(playerOf(sim).position.x - mine().position.x, playerOf(sim).position.z - mine().position.z)).toBeLessThan(0.01);
    // Brake to a stop and get out on the left.
    for (let i = 0; i < 240; i++) sim.step(press({ moveZ: -1 }));
    for (let i = 0; i < 30; i++) sim.step();
    const left = mine();
    sim.step(press({ interact: true }));
    expect(sim.session.driving).toBeNull();
    const p = playerOf(sim).position;
    const off = Math.hypot(p.x - left.position.x, p.z - left.position.z);
    expect(off).toBeGreaterThan(1);
    expect(off).toBeLessThan(2.5);
    // The car stays, asleep, where she left it.
    for (let i = 0; i < 120; i++) sim.step();
    expect([...sim.world].some((e) => e.id === left.id && e.car)).toBe(true);
  });
});
