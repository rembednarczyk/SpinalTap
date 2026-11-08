// @ts-expect-error The engine is typed for the browser; the test reads the kit off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { P1, P1_CABINS, P1_PIECES, P1_RAMP, P1_RAMP_CUT, P1_STAIR_CUT, p1RampY } from "@seki/sim";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { CityKit } from "../src/renderer/city-kit";
import { parseCityKit } from "../src/renderer/city-kit-data";
import { MeshSink } from "../src/renderer/mesh-sink";
import { parkingInside, parkingOutside } from "../src/renderer/alchemia/parking-geometry";
import { bakeParkingStandIn, parkingIn } from "../src/renderer/alchemia/parking-far";
import { SHUTTERS, rampPitch, shutterLifts } from "../src/renderer/alchemia/parking-traffic";
import { PARKING_DRAW, PARKING_LAMP_KEY, ParkingView, parkingRoofOver } from "../src/renderer/alchemia/parking-view";
import { GeometrySink } from "../src/renderer/city-kit-data";

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const kitData = parseCityKit(file("city-kit.glb"));

type V = { x: number; y: number; z: number };

/** Does a vertical ray down at (x, z) hit a triangle of the sink? */
const hitDown = (s: MeshSink, x: number, z: number): number | null => {
  let best: number | null = null;
  const p = (i: number): V => ({ x: s.positions[i * 3]!, y: s.positions[i * 3 + 1]!, z: s.positions[i * 3 + 2]! });
  for (let t = 0; t < s.indices.length; t += 3) {
    const [a, b, c] = [p(s.indices[t]!), p(s.indices[t + 1]!), p(s.indices[t + 2]!)];
    const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    if (Math.abs(d) < 1e-9) continue;
    const l1 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d;
    const l2 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d;
    if (l1 < -1e-9 || l2 < -1e-9 || 1 - l1 - l2 < -1e-9) continue;
    const y = l1 * a.y + l2 * b.y + (1 - l1 - l2) * c.y;
    if (best === null || y > best) best = y;
  }
  return best;
};

/**
 * P-1 under Alchemia's car park (ADR-0074 stage 4) in the engine: the room in a mesh of its own on
 * near it only, with its cold lamp; the trench and the stair house in Alchemia's outside mesh and,
 * from afar, in the furniture's block; the cars on the ramp along their ways, the cabins' shutters
 * up as they pass. The budgets of ADR-0074 §7: an inside up to some 8 thousand triangles.
 */
describe("P-1 under Alchemia's car park in the engine (ADR-0074 stage 4)", () => {
  it("draws every piece of the simulation in its sink, the room within an inside's budget", () => {
    const inside = parkingInside(kitData);
    const outside = new GeometrySink();
    parkingOutside(outside, kitData);
    const boxes = (s: { indices: readonly number[] }) => s.indices.length / 3 / 12;
    expect(boxes(inside)).toBeGreaterThanOrEqual(P1_PIECES.filter((p) => p.inside && p.kind !== "shutter").length);
    expect(boxes(outside)).toBeGreaterThanOrEqual(P1_PIECES.filter((p) => !p.inside).length);
    expect(inside.indices.length / 3).toBeLessThanOrEqual(8000);
    // The room under the car park, the trench and the stair house by it: nothing elsewhere.
    for (const s of [inside, outside])
      for (let i = 0; i < s.positions.length; i += 3) {
        const [x, z] = [s.positions[i]!, s.positions[i + 2]!];
        expect(x > P1.minX - 0.5 && x < P1.maxX + 0.5 && z > P1_RAMP_CUT.bounds.minZ - 0.5 && z < P1.maxZ + 0.5, `${x.toFixed(1)},${z.toFixed(1)}`).toBe(true);
      }
  });

  it("lays the ramp's surface on the simulation's ramp", () => {
    const outside = new GeometrySink();
    parkingOutside(outside, kitData);
    // The top face of the surface: the highest vertices over the ramp's middle.
    for (const z of [P1_RAMP.top + 2, 4, P1_RAMP.covered + 3, P1_RAMP.foot - 2]) {
      let best = -Infinity;
      for (let i = 0; i < outside.positions.length; i += 3) {
        const [x, y, vz] = [outside.positions[i]!, outside.positions[i + 1]!, outside.positions[i + 2]!];
        if (Math.abs(x - P1_RAMP.minX) < 0.01 && Math.abs(vz - z) < 16 && y < p1RampY(vz) + 0.1) best = Math.max(best, y - p1RampY(vz));
      }
      expect(best, `${z}`).toBeGreaterThan(-0.05);
      expect(best, `${z}`).toBeLessThan(0.05);
    }
  });

  it("stands in from afar in the furniture's block, closing the holes of the trench and the stair core", () => {
    const sink = new MeshSink();
    bakeParkingStandIn(sink);
    expect(sink.empty).toBe(false);
    const misses: string[] = [];
    for (const cut of [P1_RAMP_CUT, P1_STAIR_CUT])
      for (let x = cut.bounds.minX + 0.05; x < cut.bounds.maxX; x += 0.5)
        for (let z = cut.bounds.minZ + 0.05; z < cut.bounds.maxZ; z += 0.5) if (hitDown(sink, x, z) === null) misses.push(`${x.toFixed(1)},${z.toFixed(1)}`);
    expect(misses).toEqual([]);
    const c = P1_RAMP_CUT.bounds;
    expect(parkingIn({ minX: 256, maxX: 512, minZ: 0, maxZ: 256 })).toBe(true);
    expect(parkingIn({ minX: 256, maxX: 512, minZ: -256, maxZ: 0 })).toBe(false);
    for (let i = 0; i < sink.positions.length; i += 3) {
      const [x, z] = [sink.positions[i]!, sink.positions[i + 2]!];
      expect(x > c.minX - 4 && x < c.maxX + 4 && z > c.minZ - 1 && z < P1.maxZ, `${x},${z}`).toBe(true);
    }
  });

  it("puts each cabin's shutter up before a car heading in and while one leaves, down once none is by its doorway, shut in the reference views", () => {
    // The simulation's cars (G-491): one down the ramp's east lane and west across the apron into the south cabin.
    const [south, north] = P1_CABINS;
    const run = (cars: (t: number) => { x: number; z: number; yaw: number }[], from: number, to: number) => {
      let lifts: number[] = [0, 0];
      const out: { t: number; lifts: number[] }[] = [];
      for (let t = from; t <= to; t += 1 / 60) {
        lifts = shutterLifts(lifts, cars(t), 1 / 60);
        out.push({ t, lifts });
      }
      return out;
    };
    const z = (south!.minZ + south!.maxZ) / 2;
    // In at 4 m/s from the ramp's foot (x 412) to the cabin's middle (x 400.8): its nose 2.2 m ahead of its middle.
    const goingIn = run((t) => [{ x: Math.max(400.8, 412 - 4 * t), z, yaw: -Math.PI / 2 }], 0, 8);
    for (const { t, lifts } of goingIn) {
      const nose = Math.max(400.8, 412 - 4 * t) - 2.2;
      if (nose < SHUTTERS[0]!.x1 + 0.3) expect(lifts[0], `${t}`).toBeGreaterThan(0.95);
      expect(lifts[1], `${t}`).toBe(0);
    }
    // Gone into the garage (taken off the street out of sight): the shutter comes down.
    let lifts = goingIn[goingIn.length - 1]!.lifts;
    for (let i = 0; i < 120; i++) lifts = shutterLifts(lifts, [], 1 / 60);
    expect(lifts).toEqual([0, 0]);
    // Out of the north cabin: up at once, and until its tail is out.
    const zn = (north!.minZ + north!.maxZ) / 2;
    const out = run((t) => [{ x: 400.8 + 4 * t, z: zn, yaw: Math.PI / 2 }], 0, 3);
    for (const { t, lifts } of out) if (400.8 + 4 * t - 2.2 < SHUTTERS[1]!.x1 + 0.3) expect(lifts[1], `${t}`).toBe(1);
    // A car going up the west lane past the south cabin's doorway, away from it, leaves its shutter down.
    expect(run((t) => [{ x: 411.65, z: 27 - 4 * t, yaw: Math.PI }], 0, 1).every((r) => r.lifts[0] === 0)).toBe(true);
  });

  it("tips a car on the ramp to its grade, nose down going down and up going up, level on P-1 and on the street", () => {
    const grade = Math.atan2(p1RampY(P1_RAMP.top + 10) - p1RampY(P1_RAMP.top + 12), 2);
    expect(rampPitch(414.85, P1_RAMP.top + 11, 0)).toBeCloseTo(-grade, 6);
    expect(rampPitch(411.65, P1_RAMP.top + 11, Math.PI)).toBeCloseTo(grade, 6);
    expect(rampPitch(402, 26.6, -Math.PI / 2)).toBe(0);
    expect(rampPitch(414.85, -14.8, Math.PI / 2)).toBe(0);
    expect(rampPitch(430, 10, 0)).toBe(0);
  });

  it("stops the rain in the room and the stair house, not over the car park or in the ramp's open trench", () => {
    expect(parkingRoofOver(402, P1.floor + 1.5, 15)).toBe(true);
    expect(parkingRoofOver(414, p1RampY(20) + 1.5, 20)).toBe(true);
    expect(parkingRoofOver(420, P1.floor + 3, 18)).toBe(true);
    expect(parkingRoofOver(402, 1, 15)).toBe(false);
    expect(parkingRoofOver(414, p1RampY(4) + 1.5, 4)).toBe(false);
    expect(parkingRoofOver(380, P1.floor + 1.5, 15)).toBe(false);
  });

  const setup = () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const kit = new CityKit(scene, materials, null, kitData, { labels: false });
    const eye = { x: 405, y: P1.floor + 1.6, z: 15 };
    const box = { city: true };
    const view = new ParkingView({ scene, materials, kit: () => kit, city: () => box.city, eye: () => eye });
    return { view, eye, box, materials };
  };

  it("draws the room, its shutters and its lamp only near it, none without the map city", () => {
    const { view, eye, box, materials } = setup();
    view.update(1 / 60);
    expect(view.stats.meshes).toBe(2);
    expect(view.stats.triangles).toBeGreaterThan(500);
    expect(materials.light(PARKING_LAMP_KEY)).toBeDefined();
    // On T1 before the food hall's front: the room off, its shutters too.
    Object.assign(eye, { x: 416, y: -4.8, z: P1.maxZ + PARKING_DRAW + 10 });
    view.update(1 / 60);
    expect(view.stats.meshes).toBe(0);
    expect(materials.light(PARKING_LAMP_KEY)).toBeUndefined();
    // On Bajkowskiego away from the ramp's top: nothing of P-1 (its cars are the traffic's, G-491).
    Object.assign(eye, { x: 414, y: 0.6, z: P1_RAMP.top - 3 - PARKING_DRAW - 6 });
    view.update(1 / 60);
    expect(view.stats.meshes).toBe(0);
    Object.assign(eye, { x: 405, y: P1.floor + 1.6, z: 15 });
    view.update(1 / 60);
    expect(view.stats.meshes).toBe(2);
    box.city = false;
    view.update(1 / 60);
    expect(view.stats.meshes).toBe(0);
  });
});
