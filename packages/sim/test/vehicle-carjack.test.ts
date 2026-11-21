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

/** Steps until her getting in or out is through (the clip's span at its pace, under 3 s); the steps it took. */
const untilActDone = (sim: Simulation): number => {
  let n = 0;
  while (sim.session.carAct && n < 240) {
    sim.step();
    n++;
  }
  return n;
};

/** She takes the car in her way, drives it a little and brakes it to a stop; the car she sits in. */
const takenAndStopped = (): { sim: Simulation; mine: () => Entity } => {
  const { sim } = inTheWay();
  for (let i = 0; i < 300 && sim.session.focusPrompt !== TAKE_CAR_PROMPT; i++) sim.step();
  sim.step(press({ interact: true }));
  untilActDone(sim);
  const mine = () => [...sim.world].find((e) => e.id === sim.session.driving)!;
  for (let i = 0; i < 60; i++) sim.step(press({ moveZ: 1 }));
  // Brake to a stop and let go (held on, the brake would put it in reverse).
  const speed = () => Math.hypot(mine().velocity?.x ?? 0, mine().velocity?.z ?? 0);
  for (let i = 0; i < 240 && speed() > 0.5; i++) sim.step(press({ moveZ: -1 }));
  for (let i = 0; i < 30; i++) sim.step();
  return { sim, mine };
};

/**
 * A post where she would step out of the car's `side` (-1 left, 1 right): 0.5 m square, 3 m tall,
 * 1.6 m from the car's middle and 0.4 m ahead of it, clear of the body whatever the car's heading.
 */
const postBeside = (sim: Simulation, car: Entity, side: number, id: number): void => {
  const [tx, tz] = [Math.sin(car.yaw), Math.cos(car.yaw)];
  // The car's right in the world (left-handed, y up): its heading (sin, cos) turned to (cos, -sin).
  const c = { x: car.position.x + tz * side * 1.6 + tx * 0.4, y: car.position.y, z: car.position.z - tx * side * 1.6 + tz * 0.4 };
  sim.world.add({
    id,
    position: { ...c, y: c.y + 1.5 },
    prevPosition: { ...c, y: c.y + 1.5 },
    yaw: 0,
    prevYaw: 0,
    pitch: 0,
    view: { kind: "block", size: { x: 0.5, y: 3, z: 0.5 }, material: "metal" },
    solid: { min: { x: c.x - 0.25, y: c.y, z: c.z - 0.25 }, max: { x: c.x + 0.25, y: c.y + 3, z: c.z + 0.25 } },
  });
};

/** Which side of the car she stands on: positive right, negative left. */
const sideOf = (car: Entity, p: Entity["position"]): number => {
  const [tx, tz] = [Math.sin(car.yaw), Math.cos(car.yaw)];
  return (p.x - car.position.x) * tz - (p.z - car.position.z) * tx;
};

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
    // She gets in with the clip (ADR-0097, 21.11): the car stands meanwhile and the throttle waits.
    expect(sim.session.carAct?.kind).toBe("enter");
    sim.step(press({ moveZ: 1 }));
    expect(playerOf(sim).carPose?.act).toBe("enter");
    const steps = untilActDone(sim);
    expect(steps).toBeGreaterThan(120);
    expect(steps).toBeLessThan(200);
    expect(playerOf(sim).carPose?.act).toBe("drive");
    const mine = () => [...sim.world].find((e) => e.id === sim.session.driving)!;
    const from = { ...mine().position };
    for (let i = 0; i < 180; i++) sim.step(press({ moveZ: 1 }));
    const driven = Math.hypot(mine().position.x - from.x, mine().position.z - from.z);
    expect(driven).toBeGreaterThan(15);
    // She sits in it, her view follows its heading.
    expect(Math.hypot(playerOf(sim).position.x - mine().position.x, playerOf(sim).position.z - mine().position.z)).toBeLessThan(0.01);
    // Brake to a stop and get out on the left.
    const moving = () => Math.hypot(mine().velocity?.x ?? 0, mine().velocity?.z ?? 0);
    for (let i = 0; i < 240 && moving() > 0.5; i++) sim.step(press({ moveZ: -1 }));
    for (let i = 0; i < 30; i++) sim.step();
    const left = mine();
    sim.step(press({ interact: true }));
    // Out with the clip: seated through it, then by the door.
    expect(sim.session.carAct?.kind).toBe("exit");
    expect(untilActDone(sim)).toBeGreaterThan(100);
    expect(sim.session.driving).toBeNull();
    expect(playerOf(sim).carPose).toBeUndefined();
    const p = playerOf(sim).position;
    const off = Math.hypot(p.x - left.position.x, p.z - left.position.z);
    expect(off).toBeGreaterThan(1);
    expect(off).toBeLessThan(2.5);
    expect(sideOf(left, p)).toBeLessThan(-1);
    // The car stays, asleep, where she left it.
    for (let i = 0; i < 120; i++) sim.step();
    expect([...sim.world].some((e) => e.id === left.id && e.car)).toBe(true);
  });

  it("gets out on the right when a post stands at the driver's side, and stays in with both sides shut", () => {
    const { sim, mine } = takenAndStopped();
    const car = mine();
    // A post where the driver's door opens: she gets out on the other side.
    postBeside(sim, car, -1, 4_990_001);
    sim.step(press({ interact: true }));
    expect(sim.session.driving).toBeNull();
    expect(sideOf(car, playerOf(sim).position)).toBeGreaterThan(1);

    const second = takenAndStopped();
    const car2 = second.mine();
    postBeside(second.sim, car2, -1, 4_990_001);
    postBeside(second.sim, car2, 1, 4_990_002);
    second.sim.step(press({ interact: true }));
    expect(second.sim.session.driving).toBe(car2.id);
  });

  it("honks once a press, with the clip of the hand on the horn while it is held", () => {
    const { sim, mine } = takenAndStopped();
    const honks: unknown[] = [];
    sim.bus.on("VehicleHorn", (e) => honks.push(e));
    for (let i = 0; i < 20; i++) sim.step(press({ horn: true }));
    expect(playerOf(sim).carPose?.act).toBe("horn");
    sim.step();
    expect(playerOf(sim).carPose?.act).toBe("drive");
    sim.step(press({ horn: true }));
    expect(honks).toHaveLength(2);
    expect(mine().id).toBe(sim.session.driving);
  });
});
