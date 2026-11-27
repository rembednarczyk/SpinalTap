import { describe, expect, it } from "vitest";
import { CITY_ROUTES, JUNCTION_ROUTES, TRAFFIC_LANES, TRAFFIC_ROUTES, pointAt, projectOn } from "../src/content/traffic";
import { DEPTAK_MOUTH, deptakMouthRoutes } from "../src/content/traffic-deptak";
import { laneDrops } from "../src/content/traffic-drops";
import { onRoad } from "../src/content/lublin/roads";
import { hm } from "@seki/core";
import { Simulation, ground } from "../src";
import { teleportPlayer } from "./helpers";

/** The cars at the deptak's south mouth (ADR-0074, T-324): Bajkowskiego turns south, Lubartowska north turns round. */

/** The deptak's axis, Lubartowska w216497220 from Bajkowskiego to Olejna. */
const DEPTAK = [
  [442.9, -9.9],
  [447.2, 16.4],
  [454.9, 42.8],
] as const;
const bajkowskiego = (r: (typeof CITY_ROUTES)[number]) => r.id.split(">")[0]!.includes("Bajkowskiego#") && r.use === "cars";
const end = (r: (typeof CITY_ROUTES)[number]) => pointAt(r.points, r.length);

describe("the cars at the deptak's south mouth (T-324)", () => {
  it("drive no car route along the deptak's old carriageway", () => {
    for (const r of TRAFFIC_ROUTES.filter((x) => x.use === "cars"))
      for (let s = 0; s <= r.length; s += 1) {
        const p = pointAt(r.points, s);
        const q = projectOn(DEPTAK, p.x, p.z);
        expect(q.s > 0.5 && q.s < 54 && q.d < 4.5, `${r.id} ${p.x.toFixed(1)},${p.z.toFixed(1)}`).toBe(false);
      }
  });

  it("turn Bajkowskiego's both lanes south, the left one onto the right one first, and end where the ring south of them starts", () => {
    const ring = CITY_ROUTES.filter((r) => r.ring);
    expect(ring).toHaveLength(1);
    const start = pointAt(ring[0]!.points, 0);
    expect(Math.hypot(end(ring[0]!).x - start.x, end(ring[0]!).z - start.z)).toBeLessThan(1e-6);
    const [right, left] = CITY_ROUTES.filter(bajkowskiego).sort((a, b) => pointAt(a.points, 0).z - pointAt(b.points, 0).z);
    for (const r of [right!, left!]) {
      expect(Math.hypot(end(r).x - start.x, end(r).z - start.z), r.id).toBeLessThan(1e-6);
      // South down Lubartowska w40050981 past z -40, never north of the junction.
      const by = projectOn(r.points, 440.5, -40);
      expect(by.d).toBeLessThan(2);
      expect(pointAt(r.points, by.s).tz).toBeLessThan(-0.9);
      expect(r.points.every(([x, z]) => x < DEPTAK_MOUTH.x - 8 || z < DEPTAK_MOUTH.z + 1), r.id).toBe(true);
      // Every arc and turn on the carriageway.
      for (const [a, b] of [...(r.arcs ?? []), ...(r.turns ?? [])])
        for (let s = a; s <= b; s += 0.25) expect(onRoad(pointAt(r.points, s).x, pointAt(r.points, s).z), `${r.id} ${s}`).toBe(true);
    }
    // The left lane's route on the right lane's line before the right lane's turn, on its own line 25 m before (the ramp's cars join it there).
    const lane = (id: string) => TRAFFIC_LANES.find((l) => l.id === id)!;
    const [rightLane, leftLane] = [lane(right!.id.split(">")[0]!), lane(left!.id.split("~")[0]!)];
    const turnX = pointAt(right!.points, right!.arcs!.find(([a]) => pointAt(right!.points, a).x > DEPTAK_MOUTH.x - 12)![0]).x;
    const at = (dx: number) => pointAt(left!.points, projectOn(left!.points, turnX - dx, DEPTAK_MOUTH.z).s);
    expect(projectOn(rightLane.points, at(2).x, at(2).z).d).toBeLessThan(0.05);
    expect(projectOn(leftLane.points, at(20).x, at(20).z).d).toBeLessThan(0.05);
  });

  it("turn Lubartowska's lane northwards round by Bajkowskiego onto its lane southwards, on the road", () => {
    const ring = CITY_ROUTES.find((r) => r.ring)!;
    const near = ring.turns!.filter(([a, b]) => Math.hypot(pointAt(ring.points, (a + b) / 2).x - DEPTAK_MOUTH.x, pointAt(ring.points, (a + b) / 2).z - DEPTAK_MOUTH.z) < 15);
    expect(near).toHaveLength(1);
    const [a, b] = near[0]!;
    expect(pointAt(ring.points, a).tz).toBeGreaterThan(0.9);
    expect(pointAt(ring.points, b).tz).toBeLessThan(-0.9);
    for (let s = a; s <= b; s += 0.25) expect(onRoad(pointAt(ring.points, s).x, pointAt(ring.points, s).z)).toBe(true);
  });

  it("keep the city's other routes in their places, the ring last, the same every time", () => {
    // The city's routes are these with the lane drops (G-989) in place.
    const mouth = deptakMouthRoutes(JUNCTION_ROUTES, TRAFFIC_LANES);
    expect(laneDrops(mouth)).toEqual(CITY_ROUTES);
    expect(mouth).toHaveLength(JUNCTION_ROUTES.length + 1);
    expect(mouth[mouth.length - 1]!.ring).toBe(true);
    const changed = JUNCTION_ROUTES.flatMap((r, i) => (mouth[i] === r ? [] : [r.id]));
    expect(changed).toHaveLength(2);
    expect(changed.every((id) => id.split(">")[0]!.includes("Bajkowskiego#"))).toBe(true);
  });

  it("drives a ring vehicle on from its end to its start in view, not held there", () => {
    const route = TRAFFIC_ROUTES.findIndex((r) => r.ring);
    const ring = TRAFFIC_ROUTES[route]!;
    const sim = Simulation.create({ seed: 3, crowd: "high" });
    const now = Math.floor((sim.clock.seconds % 86400) / 60);
    sim.enqueue({ type: "wait", minutes: (hm(8) - now + 1440) % 1440 });
    sim.step();
    // Seki 8 m off the seam, looking at it: a vehicle held at a lane's end in view stands there.
    const seam = pointAt(ring.points, 0);
    // Off the carriageway to the seam's left, 8 m on at least: a player standing on it is a body in
    // the ring's way, and the ring's vehicles slow for it (8 m flat fell on the asphalt, 3.4 m off
    // the ring's lane once BDOT10k set the carriageway, ADR-0104).
    let off = 8;
    while (onRoad(seam.x - seam.tz * off, seam.z + seam.tx * off)) off += 0.5;
    const eye = { x: seam.x - seam.tz * off, z: seam.z + seam.tx * off };
    teleportPlayer(sim, ground(eye.x, eye.z), Math.atan2(seam.x - eye.x, seam.z - eye.z));
    const last = new Map<number, { s: number; x: number; z: number }>();
    const rounds: string[] = [];
    for (let t = 0; t < 60 * 45 && rounds.length === 0; t++) {
      sim.step();
      for (const v of sim.world) {
        if (v.vehicle?.route !== route) continue;
        const before = last.get(v.id);
        // Over the seam from one step to the next, a step's drive on, not a jump.
        if (before && before.s > ring.length - 15 && v.vehicle.s < 15) rounds.push(`${Math.hypot(v.position.x - before.x, v.position.z - before.z).toFixed(2)}`);
        last.set(v.id, { s: v.vehicle.s, x: v.position.x, z: v.position.z });
      }
      for (const id of [...last.keys()]) if (![...sim.world].some((v) => v.id === id)) last.delete(id);
    }
    expect(rounds).toHaveLength(1);
    expect(Number(rounds[0])).toBeLessThan(0.5);
  });

  it("drives a vehicle of Bajkowskiego on round the ring from its lane's end in view, not standing in the ring's way (G-966)", () => {
    const ringRoute = TRAFFIC_ROUTES.findIndex((r) => r.ring);
    const ring = TRAFFIC_ROUTES[ringRoute]!;
    const feeders = TRAFFIC_ROUTES.flatMap((r, i) => (r.then?.route === ringRoute ? [i] : []));
    // Bajkowskiego's two lanes and the way out of Alchemia's P-1.
    expect(feeders.map((i) => TRAFFIC_ROUTES[i]!.id).filter((id) => id.includes("Bajkowskiego") || id === "alchemia-p1:out")).toHaveLength(3);
    for (const i of feeders) expect(TRAFFIC_ROUTES[i]!.then!.s).toBe(0);
    // Seed 4 at eight: a vehicle of Bajkowskiego's left lane reaches its end at the seam within the first second.
    const sim = Simulation.create({ seed: 4, crowd: "high" });
    const now = Math.floor((sim.clock.seconds % 86400) / 60);
    sim.enqueue({ type: "wait", minutes: (hm(8) - now + 1440) % 1440 });
    sim.step();
    const seam = pointAt(ring.points, 0);
    // Off the carriageway to the seam's left, 8 m on at least: a player standing on it is a body in
    // the ring's way, and the ring's vehicles slow for it (8 m flat fell on the asphalt, 3.4 m off
    // the ring's lane once BDOT10k set the carriageway, ADR-0104).
    let off = 8;
    while (onRoad(seam.x - seam.tz * off, seam.z + seam.tx * off)) off += 0.5;
    const eye = { x: seam.x - seam.tz * off, z: seam.z + seam.tx * off };
    teleportPlayer(sim, ground(eye.x, eye.z), Math.atan2(seam.x - eye.x, seam.z - eye.z));
    let arrived: number | null = null;
    let at = 0;
    for (let t = 0; t < 60 * 10 && arrived === null; t++) {
      sim.step();
      for (const v of sim.world) {
        if (v.vehicle && feeders.includes(v.vehicle.route) && v.vehicle.s > TRAFFIC_ROUTES[v.vehicle.route]!.length - 0.5) [arrived, at] = [v.id, t];
      }
    }
    expect(arrived).not.toBeNull();
    for (let t = 0; t < 60 * 4; t++) sim.step();
    const v = [...sim.world].find((e) => e.id === arrived)!;
    // On round the ring as a guest, well past its start: not held on its lane's end.
    expect(v.vehicle!.route, `arrived at step ${at}`).toBe(ringRoute);
    expect(v.vehicle!.guest).toBe(true);
    expect(v.vehicle!.s).toBeGreaterThan(8);
  });
});
