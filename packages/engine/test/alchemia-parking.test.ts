// @ts-expect-error The engine is typed for the browser; the test reads the kit off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { MAP_CHUNKS, P1, P1_CABINS, P1_PIECES, P1_RAMP, P1_RAMP_CUT, P1_STAIR_CUT, groundY, p1RampY } from "@seki/sim";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { CityKit } from "../src/renderer/city-kit";
import { parseCityKit } from "../src/renderer/city-kit-data";
import { MeshSink } from "../src/renderer/mesh-sink";
import { parkingInside, parkingOutside } from "../src/renderer/alchemia/parking-geometry";
import { bakeParkingStandIn, parkingIn } from "../src/renderer/alchemia/parking-far";
import { CYCLE, SHUTTERS, carPoses, shutterLifts } from "../src/renderer/alchemia/parking-traffic";
import { PARKING_DRAW, PARKING_LAMP_KEY, ParkingView, TRAFFIC_DRAW, parkingRoofOver } from "../src/renderer/alchemia/parking-view";
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

  /** The map's surface drawn on top at (x, z) in Alchemia's chunk (the last piece holding it). */
  const surfaceAt = (x: number, z: number): string | null => {
    const c = MAP_CHUNKS.find((k) => k.id === "krakowskie-2-1")!;
    const inside = (o: readonly number[]) => {
      let hit = false;
      for (let i = 0, j = o.length - 2; i < o.length; j = i, i += 2) {
        if (o[i + 1]! > z !== o[j + 1]! > z && x < ((o[j]! - o[i]!) * (z - o[i + 1]!)) / (o[j + 1]! - o[i + 1]!) + o[i]!) hit = !hit;
      }
      return hit;
    };
    return c.ground.reduce<string | null>((s, g) => (inside(g.outline) ? g.surface : s), null);
  };

  it("brings one car from Bajkowskiego down the ramp into the south cabin and one out of the north cabin up the ramp onto the street, on its surfaces", () => {
    let inSeen = 0;
    let outSeen = 0;
    for (let t = 0; t < CYCLE; t += 0.25) {
      const [a, b] = carPoses(t);
      for (const p of [a, b]) {
        if (!p) continue;
        // On the street before the ramp's top (stage 7, G-491): on its ground, on a carriageway or the driveway.
        if (p.z <= P1_RAMP.top || p.x > P1.maxX + 10) {
          expect(p.y).toBeCloseTo(groundY(p.x, p.z), 6);
          expect(surfaceAt(p.x, p.z), `${t}: ${p.x},${p.z}`).toMatch(/^(road|footway|crossing)$/);
          continue;
        }
        const onRamp = p.x > P1_RAMP.minX && p.x < P1_RAMP.maxX && p.z < P1_RAMP.foot;
        expect(p.y).toBeCloseTo(onRamp ? p1RampY(p.z) : P1.floor, 6);
        // Within the ramp's walls, on the apron or in a cabin: never through a wall.
        const inCabin = P1_CABINS.some((c) => p.x >= c.minX && p.x <= c.maxX + 3 && p.z >= c.minZ && p.z <= c.maxZ);
        expect(onRamp || inCabin || (p.z >= P1_RAMP.foot - 1 && p.z <= P1.maxZ && p.x >= P1_CABINS[0]!.maxX), `${t}: ${p.x},${p.z}`).toBe(true);
      }
      if (a) inSeen++;
      if (b) outSeen++;
      // A car crossing a cabin's doorway has its shutter up.
      const lifts = shutterLifts(t);
      SHUTTERS.forEach((s, i) => {
        for (const p of [a, b]) if (p && Math.abs(p.x - s.x1) < 2.3 && p.z > s.z0 && p.z < s.z1) expect(lifts[i], `${t}`).toBeGreaterThan(0.95);
      });
    }
    expect(inSeen).toBeGreaterThan(40);
    expect(outSeen).toBeGreaterThan(40);
    // They come from the street and go back to it (G-491): from Bajkowskiego by Świętoduska, onto Lubartowska past the stop.
    const first = carPoses(0)[0]!;
    expect(first.x).toBeLessThan(380);
    const seen = (t: number) => carPoses(t)[1];
    let last = seen(45)!;
    for (let t = 45; t < CYCLE; t += 0.25) last = seen(t) ?? last;
    expect(last.z).toBeGreaterThan(20);
    expect(last.x).toBeGreaterThan(445);
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

  it("draws the room and its lamp only near it, the cars near the ramp, none without the map city", () => {
    const { view, eye, box, materials } = setup();
    view.update(1 / 60);
    expect(view.stats.meshes).toBe(2);
    expect(view.stats.triangles).toBeGreaterThan(500);
    expect(materials.light(PARKING_LAMP_KEY)).toBeDefined();
    // On T1 before the food hall's front: the room off, the cars too.
    Object.assign(eye, { x: 416, y: -4.8, z: P1.maxZ + PARKING_DRAW + 10 + TRAFFIC_DRAW });
    view.update(1 / 60);
    expect(view.stats.meshes).toBe(0);
    expect(materials.light(PARKING_LAMP_KEY)).toBeUndefined();
    // By the ramp's top on Bajkowskiego: the cars, not the room.
    Object.assign(eye, { x: 414, y: 0.6, z: P1_RAMP.top - 3 - PARKING_DRAW - 6 });
    view.update(1 / 60);
    expect(view.stats.meshes).toBe(1);
    box.city = false;
    view.update(1 / 60);
    expect(view.stats.meshes).toBe(0);
  });
});
