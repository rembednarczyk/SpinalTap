import { describe, expect, it } from "vitest";
import { type DomainEvents, VEHICLE_SIZE, hm } from "@seki/core";
import { Simulation, ground, runReplay, stateHash, type Entity } from "../src";
import { TRAFFIC_ROUTES, TURN_SPEED, pointAt, projectOn } from "../src/content/traffic";
import { onRoad } from "../src/content/lublin/roads";
import { PARKED_CARS } from "../src/content/parked-cars";
import { furnitureClearance } from "../src/content/furniture-index";
import { furnitureRadius } from "../src/content/lublin/furniture";
import { inBuilding } from "../src/content/lublin/places";
import { lanePose, timetable, vehicleCount, vehiclePlan } from "../src/world/traffic";
import { STREET_ID_BASE } from "../src/world/streaming";
import { input, run, teleportPlayer } from "./helpers";

/** Aleja Tysiąclecia by the market, where both carriageways and the trolleybus line run. */
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

  it("one-way streets are driven one way: the two carriageways of 3 Maja, north and south", () => {
    const ways = (x: number, z: number) =>
      TRAFFIC_ROUTES.filter((r) => r.use === "cars" && r.street === "3 Maja" && projectOn(r.points, x, z).d < 3).map((r) => Math.sign(pointAt(r.points, projectOn(r.points, x, z).s).tz));
    expect(ways(-102.6, 90).length).toBeGreaterThan(0);
    expect(new Set(ways(-102.6, 90))).toEqual(new Set([1]));
    expect(new Set(ways(-111, 90))).toEqual(new Set([-1]));
  });

  it("the roads are busy in the rush hour, quiet at night; delivery vans only in the morning", () => {
    const tys = TRAFFIC_ROUTES.reduce((best, r, i) => (r.use === "cars" && r.street === "Aleja Tysiąclecia" && r.vehicles > (TRAFFIC_ROUTES[best]?.vehicles ?? 0) ? i : best), -1);
    const rush = vehicleCount(3, tys, "high", { seconds: 8 * 3600 });
    expect(rush).toBeGreaterThan(5);
    expect(vehicleCount(3, tys, "high", { seconds: 3 * 3600 })).toBeLessThan(rush / 3);
    expect(vehicleCount(3, tys, "low", { seconds: 8 * 3600 })).toBeLessThan(rush);
    expect(vehicleCount(3, tys, "off", { seconds: 8 * 3600 })).toBe(0);
    const vans = TRAFFIC_ROUTES.map((r, i) => (r.use === "deliveries" ? i : -1)).filter((i) => i >= 0);
    expect(vans.some((i) => vehicleCount(3, i, "high", { seconds: 8 * 3600 }) > 0)).toBe(true);
    expect(vans.every((i) => vehicleCount(3, i, "high", { seconds: 20 * 3600 }) === 0)).toBe(true);
  });

  it("a phone's thin share still drives some cars, about the share of the full count", () => {
    const cars = TRAFFIC_ROUTES.map((r, i) => (r.use === "cars" ? i : -1)).filter((i) => i >= 0);
    const at = (density: "low" | "high") => cars.reduce((n, i) => n + vehicleCount(3, i, density, { seconds: 8 * 3600 }), 0);
    const low = at("low");
    expect(low).toBeGreaterThan(0);
    expect(low).toBeLessThan(at("high"));
    // The same seed and hour always give the same count.
    expect(at("low")).toBe(low);
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

  it("parked cars line the kerbs and fill Plac Zamkowy, clear of buildings, of the lanes and of the flea market's stalls", () => {
    expect(PARKED_CARS.length).toBeGreaterThan(60);
    // The flea market's stalls are solid: a car keeps clear of them as of a lamp.
    expect(furnitureRadius({ prop: "market-stall", x: 0, y: 0, z: 0, yaw: 0, variant: 0 })).toBeGreaterThan(1);
    const square = PARKED_CARS.filter((c) => c.x > 712 && c.x < 762 && c.z > 188 && c.z < 300);
    expect(square.length).toBeGreaterThan(15);
    for (const c of PARKED_CARS) {
      expect(inBuilding(c.x, c.z), `${c.x},${c.z}`).toBe(false);
      for (const r of TRAFFIC_ROUTES) if (r.use === "cars") expect(projectOn(r.points, c.x, c.z).d, `${c.x},${c.z} on ${r.id}`).toBeGreaterThan(1.7);
      // No stall, cabinet or lamp inside its body.
      const { width, length } = VEHICLE_SIZE[c.model];
      for (const t of [-0.5, 0, 0.5]) expect(furnitureClearance(c.x + Math.sin(c.yaw) * length * t, c.z + Math.cos(c.yaw) * length * t), `${c.x},${c.z}`).toBeGreaterThan(width / 2);
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

  /** Does another lane cross lane `route` between arc lengths `from` and `to` (within 4 m, at over 45 degrees)? */
  const crossingAhead = (route: number, from: number, to: number): boolean => {
    const lane = TRAFFIC_ROUTES[route]!;
    for (let s = from; s <= to; s += 2) {
      const p = lanePose(lane, s);
      for (const [i, other] of TRAFFIC_ROUTES.entries()) {
        if (i === route) continue;
        for (let k = 0; k < other.length; k += 2) {
          const q = lanePose(other, k);
          if (Math.hypot(q.x - p.x, q.z - p.z) < 4 && Math.abs(q.tx * p.tx + q.tz * p.tz) < 0.7) return true;
        }
      }
    }
    return false;
  };

  it("stops before the player standing in its lane, sounds the horn and goes round", () => {
    const sim = busySim();
    run(sim, 20);
    // One with no crossing between it and the player (there it would wait its turn instead) and
    // no vehicle ahead of it in its lane (that one would stop for the player first).
    const clearAhead = (x: Entity & { vehicle: NonNullable<Entity["vehicle"]> }) =>
      !vehicles(sim).some((o) => o !== x && o.vehicle.route === x.vehicle.route && o.vehicle.s > x.vehicle.s && o.vehicle.s < x.vehicle.s + 60);
    const v = vehicles(sim).find((x) => x.view?.kind === "vehicle" && x.view.model !== "trolleybus" && x.vehicle.v > 5 && x.vehicle.s < TRAFFIC_ROUTES[x.vehicle.route]!.length - 80 && !crossingAhead(x.vehicle.route, x.vehicle.s, x.vehicle.s + 45) && clearAhead(x))!;
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

  it.each([
    ["by the market", TYSIACLECIA],
    ["east of the market, by Rondo Dmowskiego", ground(860, 334)],
  ])("takes turns at crossings %s: two vehicles crossing each other's way never drive into each other", (_, at) => {
    const sim = busySim(3, at);
    let crossings = 0;
    for (let t = 0; t < 20 * 60; t++) {
      sim.step();
      if (t % 6 !== 0) continue;
      const vs = vehicles(sim);
      for (let i = 0; i < vs.length; i++) {
        for (let j = i + 1; j < vs.length; j++) {
          const a = vs[i]!;
          const b = vs[j]!;
          if (Math.abs(Math.sin(a.yaw) * Math.sin(b.yaw) + Math.cos(a.yaw) * Math.cos(b.yaw)) > 0.7) continue;
          const d = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
          if (d < 12) crossings += 1;
          expect(d, `${a.id} and ${b.id} at step ${t}`).toBeGreaterThan(a.vehicle.half.w + b.vehicle.half.w);
        }
      }
    }
    // The run does meet crossing traffic.
    expect(crossings).toBeGreaterThan(0);
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
    // East of the market, on the open avenue.
    const sim = busySim(3, ground(860, 334));
    run(sim, 60);
    sim.player()!.pitch = 0.3;
    sim.step(input({ fire: true }));
    run(sim, 30);
    const scared = vehicles(sim).filter((v) => v.vehicle.panic !== null);
    expect(scared.length).toBeGreaterThan(0);
    expect(scared.some((v) => v.vehicle.panic!.kind === "stop")).toBe(true);
    expect(scared.some((v) => v.vehicle.panic!.kind === "flee")).toBe(true);
  });

  it("turns round before the market on Aleja Tysiąclecia, slowly, and never drives into its halls", () => {
    const market = { minX: 758, maxX: 815, minZ: 325, maxZ: 366 };
    for (const r of TRAFFIC_ROUTES.filter((x) => x.street === "Aleja Tysiąclecia")) {
      for (let s = 0; s < r.length; s += 1) {
        const p = pointAt(r.points, s);
        expect(p.x > market.minX + 2 && p.x < market.maxX - 2 && p.z > market.minZ && p.z < market.maxZ, `${r.id} at ${s}`).toBe(false);
      }
    }
    const turning = TRAFFIC_ROUTES.filter((r) => r.use === "cars" && r.turns?.length);
    expect(turning.length).toBe(4);
    const sim = busySim(3, ground(745, 350));
    let through = 0;
    let fastest = 0;
    // Only the ones seen driving up to the turn: one can appear in it, out of sight, at its timetable's speed.
    const coming = new Set<number>();
    for (let t = 0; t < 50 * 60; t++) {
      sim.step();
      for (const v of vehicles(sim)) {
        const turn = TRAFFIC_ROUTES[v.vehicle.route]!.turns?.[0];
        if (!turn) continue;
        if (v.vehicle.s < turn[0] - 15) coming.add(v.id);
        if (!coming.has(v.id) || v.vehicle.s < turn[0] + 2 || v.vehicle.s > turn[1]) continue;
        fastest = Math.max(fastest, v.vehicle.v);
        if (v.vehicle.s > turn[1] - 1) through++;
      }
    }
    expect(through).toBeGreaterThan(0);
    expect(fastest).toBeLessThanOrEqual(TURN_SPEED + 0.01);
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
