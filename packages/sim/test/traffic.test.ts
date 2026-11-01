import { describe, expect, it } from "vitest";
import { type DomainEvents, VEHICLE_SIZE, hm } from "@seki/core";
import { Simulation, ground, runReplay, stateHash, type Entity } from "../src";
import { TRAFFIC_LANES, TRAFFIC_ROUTES, TURN_SPEED, type TrafficRoute, pointAt, projectOn } from "../src/content/traffic";
import { ROAD_CHAINS, onRoad, polylineLength } from "../src/content/lublin/roads";
import { PARKED_CARS } from "../src/content/parked-cars";
import { furnitureClearance } from "../src/content/furniture-index";
import { furnitureRadius } from "../src/content/lublin/furniture";
import { inBuilding } from "../src/content/lublin/places";
import { MAP_CHUNKS } from "../src/content/lublin/sites";
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

/** Does a route drive along `street`: one of its lanes, joined at the junctions into it (ADR-0055), is that street's? */
const drives = (r: { readonly id: string }, street: string): boolean => r.id.split(">").some((lane) => lane.startsWith(`${street}#`));

/** A route's turn round before the market on Aleja Tysiąclecia, found by place: a route joined at the junctions has other turns too. */
const marketTurn = (r: TrafficRoute): readonly [number, number] | undefined =>
  r.turns?.find(([a, b]) => {
    const p = pointAt(r.points, (a + b) / 2);
    return p.x > 745 && p.x < 830 && p.z > 320 && p.z < 370;
  });

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
      TRAFFIC_ROUTES.filter((r) => r.use === "cars" && drives(r, "3 Maja") && projectOn(r.points, x, z).d < 3).map((r) => Math.sign(pointAt(r.points, projectOn(r.points, x, z).s).tz));
    expect(ways(-102.6, 90).length).toBeGreaterThan(0);
    expect(new Set(ways(-102.6, 90))).toEqual(new Set([1]));
    expect(new Set(ways(-111, 90))).toEqual(new Set([-1]));
  });

  it("a two-way street's lane leaves its car on the asphalt of each stretch wide enough for it (G-090)", () => {
    // Plac Wolności narrows by a bend, Radziwiłłowska and Staszica by a pinch: a lane kept the whole street's offset over them.
    const lanes = TRAFFIC_LANES.filter((r) => r.use === "cars" && /:[fb](\/\d+)?(\+|$)/.test(r.id));
    expect(lanes.length).toBeGreaterThan(40);
    // Half a car's width, and the room a lane takes beside the axis at the least: the lane 1.2 m out and its car's half.
    const [half, room] = [0.9, 2.1];
    const over: string[] = [];
    for (const r of lanes) {
      const axes = [...r.id.matchAll(/#(\d+):/g)].map((m) => ROAD_CHAINS[Number(m[1])]!.points);
      for (let s = 10; s < r.length - 10; s += 2) {
        // A turn round at a dead end sweeps across the street to its other lane.
        if (r.turns?.some(([a, b]) => s > a - 10 && s < b + 10)) continue;
        const p = pointAt(r.points, s);
        if (!onRoad(p.x, p.z)) continue;
        // Asphalt to the lane's right, in tenths of a metre up to the car's half.
        let tenths = 0;
        while (tenths < half * 10 && onRoad(p.x + (p.tz * (tenths + 1)) / 10, p.z - (p.tx * (tenths + 1)) / 10)) tenths++;
        const reach = tenths / 10;
        // A street too narrow for two lanes at all is not this check's (its cars overhang the pavement).
        const out = Math.min(...axes.map((a) => projectOn(a, p.x, p.z).d));
        if (reach < half && out + reach >= room) over.push(`${r.id} at ${s}: ${reach.toFixed(1)} m to the kerb`);
      }
    }
    expect(over).toEqual([]);
  });

  it("the west carriageway of Aleja Tysiąclecia is one street with a lane all the way and a trolleybus (G-020)", () => {
    const west = ROAD_CHAINS.filter((c) => c.name === "Aleja Tysiąclecia" && projectOn(c.points, 912, 333).d < 3);
    expect(west).toHaveLength(1);
    expect(polylineLength(west[0]!.points)).toBeCloseTo(472, -1);
    const near = (use: string, x: number, z: number) => TRAFFIC_ROUTES.some((r) => r.use === use && drives(r, "Aleja Tysiąclecia") && projectOn(r.points, x, z).d < 2);
    expect(near("cars", 912, 333)).toBe(true);
    expect(near("trolley", 912, 333)).toBe(true);
    expect(near("trolley", 1000, 331)).toBe(true);
  });

  it("the roads are busy in the rush hour, quiet at night; delivery vans only in the morning", () => {
    const tys = TRAFFIC_ROUTES.reduce((best, r, i) => (r.use === "cars" && drives(r, "Aleja Tysiąclecia") && r.vehicles > (TRAFFIC_ROUTES[best]?.vehicles ?? 0) ? i : best), -1);
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

  it("parked cars fill the car parks the map draws along a kerb, along their street, aslant or across it as the strip says (G-177, G-187)", () => {
    const inside = (x: number, z: number, o: readonly number[]) => {
      let on = false;
      for (let i = 0, j = o.length - 2; i < o.length; j = i, i += 2)
        if (o[i + 1]! > z !== o[j + 1]! > z && x < ((o[j]! - o[i]!) * (z - o[i + 1]!)) / (o[j + 1]! - o[i + 1]!) + o[i]!) on = !on;
      return on;
    };
    const kerbParks = MAP_CHUNKS.flatMap((c) => c.carParks ?? []).filter((p) => p.kind === "street_side" || p.kind === "lane");
    // Peowiaków's strip, Radziwiłłowska's, Kalinowszczyzna's by the river and Ruska's parking lane.
    for (const id of ["w471191535", "w883991779", "w1000912202", "w1024029951"]) {
      const park = kerbParks.find((p) => p.id === id)!;
      expect(PARKED_CARS.some((c) => inside(c.x, c.z, park.outline)), id).toBe(true);
    }
    const inBays = PARKED_CARS.flatMap((c) => kerbParks.filter((p) => inside(c.x, c.z, p.outline)).map((park) => ({ c, park })));
    expect(inBays.length).toBeGreaterThan(20);
    let turned = 0;
    for (const { c, park } of inBays) {
      const street = ROAD_CHAINS.filter((r) => r.use === "cars").map((r) => ({ r, q: projectOn(r.points, c.x, c.z) })).sort((a, b) => a.q.d - b.q.d)[0]!;
      const t = pointAt(street.r.points, street.q.s);
      const along = Math.abs(t.tx * Math.sin(c.yaw) + t.tz * Math.cos(c.yaw));
      // Along the kerb, aslant at 60° (cos 0.5) or across it, never askew otherwise; aslant or across
      // only where the strip is mapped so or has no `orientation` (G-187: aslant first, across where it does not fit).
      const aslant = Math.abs(along - 0.5) < 0.05;
      if (park.orientation === "perpendicular") expect(along, `${c.x},${c.z} in ${park.id}`).toBeLessThan(0.1);
      else if (park.orientation === "diagonal") expect(aslant, `${c.x},${c.z} in ${park.id}: ${along.toFixed(2)}`).toBe(true);
      else if (park.orientation === "parallel") expect(along, `${c.x},${c.z} in ${park.id}`).toBeGreaterThan(0.9);
      else expect(along > 0.9 || along < 0.1 || aslant, `${c.x},${c.z} in ${park.id}: ${along.toFixed(2)}`).toBe(true);
      if (along < 0.9) turned++;
    }
    expect(turned).toBeGreaterThan(10);
  });

  it("parked cars of a kerb car park stand with their whole body in it, by its kerb (G-177)", () => {
    const ring = (o: readonly number[]) => Array.from({ length: o.length / 2 }, (_, i): readonly [number, number] => [o[2 * i]!, o[2 * i + 1]!]);
    const inRing = (x: number, z: number, r: readonly (readonly [number, number])[]) => {
      let on = false;
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) if (r[i]![1] > z !== r[j]![1] > z && x < ((r[j]![0] - r[i]![0]) * (z - r[i]![1])) / (r[j]![1] - r[i]![1]) + r[i]![0]) on = !on;
      return on;
    };
    const parks = MAP_CHUNKS.flatMap((c) => c.carParks ?? []).filter((p) => p.kind === "street_side" || p.kind === "lane").map((p) => ({ id: p.id, ring: ring(p.outline) }));
    let checked = 0;
    for (const c of PARKED_CARS) {
      const park = parks.find((p) => inRing(c.x, c.z, p.ring));
      if (!park) continue;
      checked++;
      const { width, length } = VEHICLE_SIZE[c.model];
      const [fx, fz] = [Math.sin(c.yaw), Math.cos(c.yaw)];
      for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]] as const) {
        // A corner pulled 0.15 m in: the bay is the strip's to its edge, with a hand's breadth of slack.
        const [px, pz] = [c.x + fz * (width * a - 0.15 * Math.sign(a)) + fx * (length * b - 0.15 * Math.sign(b)), c.z - fx * (width * a - 0.15 * Math.sign(a)) + fz * (length * b - 0.15 * Math.sign(b))];
        expect(inRing(px, pz, park.ring), `${c.model} ${c.x},${c.z} in ${park.id}`).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(20);
    // Kalinowszczyzna's strip by the river is mapped `orientation=perpendicular`: its cars stand across the kerb.
    const kalinowszczyzna = parks.find((p) => p.id === "w1000912163")!;
    const there = PARKED_CARS.filter((c) => inRing(c.x, c.z, kalinowszczyzna.ring));
    expect(there.length).toBeGreaterThan(0);
  });

  it("parked cars leave the mouths of driveways and service lanes free: half their width and 0.5 m off the axis (G-140)", () => {
    const ways = MAP_CHUNKS.flatMap((c) => c.serviceWays ?? []);
    // Cerkiewna's driveway and the yard lane by it, where three cars stood across the mouths.
    const near = (x: number, z: number) => ways.some((w) => w.line.some((v, i) => i % 2 === 0 && Math.hypot(v - x, w.line[i + 1]! - z) < 15));
    expect(near(908.8, 440.5) && near(912.2, 416.4)).toBe(true);
    const gap = (x: number, z: number, line: readonly number[]) => {
      let d = Infinity;
      for (let i = 2; i < line.length; i += 2) {
        const [ax, az, bx, bz] = [line[i - 2]!, line[i - 1]!, line[i]!, line[i + 1]!];
        const k = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2 || 1)));
        d = Math.min(d, Math.hypot(ax + (bx - ax) * k - x, az + (bz - az) * k - z));
      }
      return d;
    };
    for (const c of PARKED_CARS) {
      const { width, length } = VEHICLE_SIZE[c.model];
      const fx = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      for (let a = -0.5; a <= 0.5; a += 0.125)
        for (let b = -0.5; b <= 0.5; b += 0.125) {
          const x = c.x + fz * width * a + fx * length * b;
          const z = c.z - fx * width * a + fz * length * b;
          for (const w of ways) expect(gap(x, z, w.line), `${c.model} at ${c.x},${c.z}`).toBeGreaterThanOrEqual(w.width / 2 + 0.5 - 0.05);
        }
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
    for (const r of TRAFFIC_ROUTES.filter((x) => drives(x, "Aleja Tysiąclecia"))) {
      for (let s = 0; s < r.length; s += 1) {
        const p = pointAt(r.points, s);
        expect(p.x > market.minX + 2 && p.x < market.maxX - 2 && p.z > market.minZ && p.z < market.maxZ, `${r.id} at ${s}`).toBe(false);
      }
    }
    // Its four car lanes that turn round there, now each on a route joined at the junctions.
    const turning = TRAFFIC_ROUTES.filter((r) => r.use === "cars" && r.id.split(">").some((lane) => lane.startsWith("Aleja Tysiąclecia#") && lane.includes("+")));
    expect(turning.length).toBe(4);
    const sim = busySim(3, ground(745, 350));
    const through = new Set<number>();
    let fastest = 0;
    // Only the ones seen driving up to the turn: one can appear in it, out of sight, at its timetable's speed.
    const coming = new Set<number>();
    // Each route's turn worked out once, not for every car on every step.
    const turns = new Map<number, readonly [number, number] | undefined>();
    const turnOf = (route: number) => (turns.has(route) ? turns.get(route) : turns.set(route, marketTurn(TRAFFIC_ROUTES[route]!)).get(route));
    // 25 s of traffic: ten cars drive the turn (23 in 50 s), so the speed is checked on as many
    // as before at half the cost; the 50 s went over the 20 s limit on a loaded CI runner.
    for (let t = 0; t < 25 * 60; t++) {
      sim.step();
      for (const v of sim.world) {
        if (!v.vehicle) continue;
        const turn = turnOf(v.vehicle.route);
        if (!turn) continue;
        if (v.vehicle.s < turn[0] - 15) coming.add(v.id);
        if (!coming.has(v.id) || v.vehicle.s < turn[0] + 2 || v.vehicle.s > turn[1]) continue;
        fastest = Math.max(fastest, v.vehicle.v);
        if (v.vehicle.s > turn[1] - 1) through.add(v.id);
      }
    }
    expect(through.size).toBeGreaterThanOrEqual(5);
    expect(fastest).toBeLessThanOrEqual(TURN_SPEED + 0.01);
  });

  it("put back on its timetable out of sight inside a turn round, a vehicle drives it slowly (G-028)", () => {
    // The player by the market looking west, away from the turns round before it.
    const sim = busySim(3, ground(745, 350));
    teleportPlayer(sim, ground(745, 350), -Math.PI / 2);
    let moved: (Entity & { vehicle: NonNullable<Entity["vehicle"]> }) | undefined;
    for (let t = 0; t < 60 * 60 && !moved; t++) {
      sim.step();
      moved = vehicles(sim).find((v) => {
        const turn = marketTurn(TRAFFIC_ROUTES[v.vehicle.route]!);
        const tt = timetable(vehiclePlan(sim.seed, v.vehicle.route, v.vehicle.index), sim.clock);
        return turn !== undefined && tt.v > TURN_SPEED && tt.s > turn[0] + 5 && tt.s < turn[1] - 5;
      });
    }
    expect(moved).toBeDefined();
    const v = moved!;
    // Far behind its timetable at a main road's speed, as after a long hold-up behind a trolleybus.
    const tt = timetable(vehiclePlan(sim.seed, v.vehicle.route, v.vehicle.index), sim.clock);
    v.vehicle.s = tt.s - 60;
    v.vehicle.v = 13.5;
    sim.step();
    const turn = marketTurn(TRAFFIC_ROUTES[v.vehicle.route]!)!;
    expect(v.vehicle.s).toBeGreaterThan(turn[0]);
    expect(v.vehicle.v).toBeLessThanOrEqual(TURN_SPEED + 0.01);
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
