import { describe, expect, it } from "vitest";
import { type DomainEvents, hm } from "@seki/core";
import { Simulation, ground, runReplay, stateHash, type Entity } from "../src";
import { TRAFFIC_ROUTES, pointAt, projectOn } from "../src/content/traffic";
import { onRoad } from "../src/content/lublin/roads";
import { PARKED_CARS } from "../src/content/parked-cars";
import { inBuilding } from "../src/content/lublin/places";
import { lanePose, timetable, vehicleCount, vehiclePlan } from "../src/world/traffic";
import { STREET_ID_BASE } from "../src/world/streaming";
import { input, run, teleportPlayer } from "./helpers";

/** Aleja Tysiąclecia below the castle, where both carriageways and the trolleybus line run. */
const TYSIACLECIA = ground(820, 352);

const skipTo = (sim: Simulation, minute: number): void => {
  const now = Math.floor((sim.clock.seconds % 86400) / 60);
  const minutes = (minute - now + 1440) % 1440;
  if (minutes > 0) sim.enqueue({ type: "wait", minutes });
  sim.step();
};

const vehicles = (sim: Simulation): (Entity & { vehicle: NonNullable<Entity["vehicle"]> })[] =>
  [...sim.world].filter((e): e is Entity & { vehicle: NonNullable<Entity["vehicle"]> } => e.vehicle !== undefined).sort((a, b) => a.id - b.id);

const poses = (sim: Simulation) => vehicles(sim).map((v) => `${v.id}:${v.position.x.toFixed(3)},${v.position.z.toFixed(3)}:${v.vehicle.v.toFixed(3)}`);

const busySim = (seed = 3, at = TYSIACLECIA, hour = 8) => {
  const sim = Simulation.create({ seed, crowd: "high" });
  skipTo(sim, hm(hour));
  teleportPlayer(sim, at, Math.PI / 2);
  run(sim, 2);
  return sim;
};

describe("the lanes of the traffic (ADR-0050)", () => {
  it("cars keep to the carriageways; the Old Town and the deptak get deliveries only", () => {
    const cars = TRAFFIC_ROUTES.filter((r) => r.use === "cars");
    expect(cars.length).toBeGreaterThan(60);
    let on = 0;
    let all = 0;
    for (const r of cars) {
      for (let s = 2; s < r.length - 2; s += 5) {
        const p = pointAt(r.points, s);
        all++;
        if (onRoad(p.x, p.z)) on++;
      }
    }
    expect(on / all).toBeGreaterThan(0.8);
    // No car lane runs through the Rynek or down the deptak by the clinic.
    for (const r of cars) {
      expect(projectOn(r.points, 575, -65).d, r.id).toBeGreaterThan(20);
      expect(projectOn(r.points, 321, -80).d, r.id).toBeGreaterThan(20);
    }
    expect(TRAFFIC_ROUTES.some((r) => r.use === "deliveries" && r.street === "Grodzka")).toBe(true);
    expect(TRAFFIC_ROUTES.some((r) => r.use === "trolley" && r.street === "Aleja Tysiąclecia")).toBe(true);
  });

  it("the roads are busy in the rush hour, quiet at night; delivery vans only in the morning", () => {
    const tys = TRAFFIC_ROUTES.findIndex((r) => r.use === "cars" && r.street === "Aleja Tysiąclecia");
    const rush = vehicleCount(3, tys, "high", { seconds: 8 * 3600 });
    expect(rush).toBeGreaterThan(5);
    expect(vehicleCount(3, tys, "high", { seconds: 3 * 3600 })).toBeLessThan(rush / 3);
    expect(vehicleCount(3, tys, "low", { seconds: 8 * 3600 })).toBeLessThan(rush);
    expect(vehicleCount(3, tys, "off", { seconds: 8 * 3600 })).toBe(0);
    const vans = TRAFFIC_ROUTES.map((r, i) => (r.use === "deliveries" ? i : -1)).filter((i) => i >= 0);
    expect(vans.some((i) => vehicleCount(3, i, "high", { seconds: 8 * 3600 }) > 0)).toBe(true);
    expect(vans.every((i) => vehicleCount(3, i, "high", { seconds: 20 * 3600 }) === 0)).toBe(true);
  });

  it("a trolleybus stands at its stops on its timetable", () => {
    const route = TRAFFIC_ROUTES.findIndex((r) => r.use === "trolley" && r.stops.length > 0);
    expect(route).toBeGreaterThanOrEqual(0);
    const plan = vehiclePlan(3, route, 0);
    expect(plan.model).toBe("trolleybus");
    const stop = TRAFFIC_ROUTES[route]!.stops[0]!;
    let dwelt = 0;
    for (let t = 0; t < 600; t += 0.5) {
      const tt = timetable(plan, { seconds: (8 * 3600 + t) * 60 });
      if (tt.v === 0 && Math.abs(tt.s - stop) < 0.01) dwelt++;
    }
    expect(dwelt).toBeGreaterThan(10);
  });

  it("parked cars line the kerbs and fill Plac Zamkowy, clear of buildings and of the lanes", () => {
    expect(PARKED_CARS.length).toBeGreaterThan(60);
    const square = PARKED_CARS.filter((c) => c.x > 712 && c.x < 762 && c.z > 188 && c.z < 300);
    expect(square.length).toBeGreaterThan(15);
    for (const c of PARKED_CARS) {
      expect(inBuilding(c.x, c.z), `${c.x},${c.z}`).toBe(false);
      for (const r of TRAFFIC_ROUTES) if (r.use === "cars") expect(projectOn(r.points, c.x, c.z).d, `${c.x},${c.z} on ${r.id}`).toBeGreaterThan(1.7);
    }
  });
});

describe("the traffic in the simulation (ADR-0050)", () => {
  it("drives round the player on Aleja Tysiąclecia; the same seed and clock give the same street", () => {
    const a = busySim();
    const b = busySim();
    run(a, 240);
    run(b, 240);
    expect(vehicles(a).length).toBeGreaterThan(8);
    expect(vehicles(a).some((v) => v.view?.kind === "vehicle" && v.view.model === "trolleybus")).toBe(true);
    expect(poses(a)).toEqual(poses(b));
    expect(poses(busySim(4))).not.toEqual(poses(busySim(3)));
    // They move.
    const before = poses(a);
    run(a, 30);
    expect(poses(a)).not.toEqual(before);
    // Nothing of it is saved.
    const snap = a.snapshot(null, "test", "");
    expect(snap.entities.some((e) => e.key.startsWith("vehicle"))).toBe(false);
  });

  it("after a load every vehicle drives on its timetable, the same in every load", () => {
    const a = busySim();
    run(a, 120);
    const snap = a.snapshot(null, "test", "");
    const b = Simulation.fromSnapshot(snap, undefined, "high");
    const c = Simulation.fromSnapshot(snap, undefined, "high");
    run(b, 3);
    run(c, 3);
    expect(poses(b)).toEqual(poses(c));
    expect(vehicles(b).length).toBeGreaterThan(5);
    for (const v of vehicles(b)) {
      const tt = timetable(vehiclePlan(b.seed, v.vehicle.route, v.vehicle.index), b.clock);
      // Within a few steps' drive of where the timetable puts it (unless something stopped it).
      if (v.vehicle.v > 1) expect(Math.abs(tt.s - v.vehicle.s) % TRAFFIC_ROUTES[v.vehicle.route]!.length).toBeLessThan(2);
    }
  });

  it("stops before the player standing in its lane, sounds the horn and goes round", () => {
    const sim = busySim();
    run(sim, 20);
    const v = vehicles(sim).find((x) => x.view?.kind === "vehicle" && x.view.model !== "trolleybus" && x.vehicle.v > 5 && x.vehicle.s < TRAFFIC_ROUTES[x.vehicle.route]!.length - 80)!;
    expect(v).toBeDefined();
    const lane = TRAFFIC_ROUTES[v.vehicle.route]!;
    const ahead = lanePose(lane, v.vehicle.s + 35);
    const horns: DomainEvents["VehicleHorned"][] = [];
    sim.bus.on("VehicleHorned", (e) => horns.push(e));
    teleportPlayer(sim, ground(ahead.x, ahead.z), 0);
    const startS = v.vehicle.s;
    run(sim, 8 * 60);
    // Stopped short of the player.
    const p = sim.player()!.position;
    expect(Math.hypot(v.position.x - p.x, v.position.z - p.z)).toBeGreaterThan(v.vehicle.half.l);
    expect(v.vehicle.s).toBeGreaterThan(startS);
    expect(horns.some((h) => h.vehicleId === v.id)).toBe(true);
    // Then round them, off its lane.
    run(sim, 10 * 60);
    expect(Math.abs(v.vehicle.aside) > 1 || v.vehicle.s > startS + 40 || !sim.world.has(v)).toBe(true);
  });

  it("pushes the player out of its body: no going through a car", () => {
    const sim = busySim();
    run(sim, 20);
    const v = vehicles(sim)[0]!;
    teleportPlayer(sim, { ...v.position });
    sim.step();
    const p = sim.player()!.position;
    const tx = Math.sin(v.yaw);
    const tz = Math.cos(v.yaw);
    const fwd = Math.abs((p.x - v.position.x) * tx + (p.z - v.position.z) * tz);
    const lat = Math.abs((p.x - v.position.x) * tz - (p.z - v.position.z) * tx);
    expect(fwd >= v.vehicle.half.l || lat >= v.vehicle.half.w).toBe(true);
  });

  it("a shot nearby makes vehicles stop dead or speed off", () => {
    const sim = busySim();
    run(sim, 60);
    sim.player()!.pitch = 0.3;
    sim.step(input({ fire: true }));
    run(sim, 30);
    const scared = vehicles(sim).filter((v) => v.vehicle.panic !== null);
    expect(scared.length).toBeGreaterThan(0);
    expect(scared.some((v) => v.vehicle.panic!.kind === "stop")).toBe(true);
    expect(scared.some((v) => v.vehicle.panic!.kind === "flee")).toBe(true);
  });

  it("parked cars are solids of their chunk", () => {
    const sim = Simulation.create({ seed: 1 });
    teleportPlayer(sim, ground(740, 240));
    run(sim, 2);
    const solids = [...sim.world].filter((e) => e.id >= STREET_ID_BASE && e.id < STREET_ID_BASE + 1_000_000 && e.solid && e.chunk === "podzamcze-1-0");
    const square = PARKED_CARS.filter((c) => c.chunk === "podzamcze-1-0");
    expect(square.length).toBeGreaterThan(10);
    for (const c of square) expect(solids.some((e) => Math.hypot(e.position.x - c.x, e.position.z - c.z) < 0.01)).toBe(true);
  });

  it("leaves the golden run as it was, with the traffic on", () => {
    const frames = [{ input: input(), commands: [{ type: "set-flag" as const, flag: "met_fixer" }] }, ...Array.from({ length: 300 }, () => ({ input: input({ moveZ: 1 }) }))];
    const off = runReplay(1234, frames);
    const on = runReplay(1234, frames, "high");
    expect(stateHash(on.snapshot(null, "test", ""))).toBe(stateHash(off.snapshot(null, "test", "")));
  });
});
