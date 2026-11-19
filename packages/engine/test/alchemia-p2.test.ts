// @ts-expect-error The engine is typed for the browser; the test reads the kit off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { FOODHALL, P1, P1_STAIR_DOWN, P2, P2_ANNEX, P2_CORRIDOR, P2_CUT, P2_CUTTING, P2_CUTTING_PIECES, P2_SHELL_PIECES, P2_STORE_PIECES, SHELTER, SHELTER_GATE_STAIR, SHELTER_HATCH } from "@seki/sim";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { pointLightOn } from "../src/npr/toon-point-lights";
import { CityKit } from "../src/renderer/city-kit";
import { GeometrySink, parseCityKit } from "../src/renderer/city-kit-data";
import { MeshSink } from "../src/renderer/mesh-sink";
import { ALCHEMIA_LAMP_KEY, AlchemiaView } from "../src/renderer/alchemia/alchemia-view";
import { p2Inside, p2Outside } from "../src/renderer/alchemia/p2-geometry";
import { bakeP2StandIn, p2In } from "../src/renderer/alchemia/p2-far";
import { P2_LAMP_KEY, P2View, p2RoofOver, p2Visible } from "../src/renderer/alchemia/p2-view";
import { PARKING_LAMP_KEY } from "../src/renderer/alchemia/parking-view";

/** A mesh of Alchemia's, at most (decision of the user of 19.11: 16 000, the complex fills its whole site). */
/** A mesh of Alchemia's at most (decision of the user of 19.11: triangle budgets may grow; the gates are draw calls and active meshes). */
const ALCHEMIA_TRIANGLES = 40000;

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const kitData = parseCityKit(file("city-kit.glb"));

type V = { x: number; y: number; z: number };

/** Does a vertical ray down at (x, z) hit a triangle of the sink? */
const hitDown = (s: MeshSink, x: number, z: number): boolean => {
  const p = (i: number): V => ({ x: s.positions[i * 3]!, y: s.positions[i * 3 + 1]!, z: s.positions[i * 3 + 2]! });
  for (let t = 0; t < s.indices.length; t += 3) {
    const [a, b, c] = [p(s.indices[t]!), p(s.indices[t + 1]!), p(s.indices[t + 2]!)];
    const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    if (Math.abs(d) < 1e-9) continue;
    const l1 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d;
    const l2 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d;
    if (l1 >= -1e-9 && l2 >= -1e-9 && 1 - l1 - l2 >= -1e-9) return true;
  }
  return false;
};

const STORE_EYE = { x: 413.6, y: P2.floor + 1.6, z: 18 };

/**
 * P-2 under Alchemia's P-1 (ADR-0074 stage 5a) in the engine: the store and its corridor in a mesh
 * of their own within an inside's budget (§7: some 8 thousand triangles), on only where they can be
 * seen, with a dim orange lamp only down there, P-1's and the hall's lamps off then; the cutting in
 * Alchemia's outside mesh and, from afar, in the furniture's block.
 */
describe("P-2 under Alchemia's P-1 in the engine (ADR-0074 stage 5a)", () => {
  it("draws every piece of its store and corridor in its own sink, within an inside's budget and its outline", () => {
    const inside = p2Inside(kitData);
    expect(inside.indices.length / 3 / 12).toBeGreaterThanOrEqual(P2_SHELL_PIECES.length + P2_STORE_PIECES.length);
    expect(inside.indices.length / 3).toBeLessThanOrEqual(ALCHEMIA_TRIANGLES);
    for (let i = 0; i < inside.positions.length; i += 3) {
      const [x, z] = [inside.positions[i]!, inside.positions[i + 2]!];
      const inStore = x > P2.minX - 0.01 && x < P2.maxX + 0.01 && z > P2.minZ - 0.01 && z < P2.maxZ + 0.01;
      const inCorridor = x > P2_CORRIDOR.minX - 0.01 && x < P2_CORRIDOR.maxX + 0.01 && z > P2_CORRIDOR.minZ - 0.01 && z < P2_CORRIDOR.maxZ + 0.01;
      const inAnnex = x > P2_ANNEX.minX - 0.01 && x < P2_ANNEX.maxX + 0.01 && z > P2_ANNEX.minZ - 0.01 && z < P2_ANNEX.maxZ + 0.01;
      // The shelter by its north end (stage 5d1): the gate's flight, the passage and the room.
      const inShelter = x > SHELTER.minX - 0.01 && x < SHELTER.maxX + 0.01 && z > SHELTER_GATE_STAIR.minZ - 0.01 && z < SHELTER.maxZ + 0.01;
      expect(inStore || inCorridor || inAnnex || inShelter, `${x.toFixed(1)},${z.toFixed(1)}`).toBe(true);
    }
  });

  it("draws the portal's parapet and the cutting in Alchemia's outside sink, there only", () => {
    const outside = new GeometrySink();
    p2Outside(outside, kitData);
    expect(outside.indices.length / 3 / 12).toBeGreaterThanOrEqual(P2_CUTTING_PIECES.length);
    for (let i = 0; i < outside.positions.length; i += 3) {
      const [x, z] = [outside.positions[i]!, outside.positions[i + 2]!];
      const inCutting = x > P2_CUTTING.minX - 0.01 && x < P2_CUTTING.maxX + 0.01 && z > P2_CORRIDOR.maxZ - P2.wall - 0.01 && z < P2_CUTTING.maxZ + 0.01;
      // The shelter's hatch with its shaft and the leaf standing open by it (stage 5d1).
      const inHatch = x > SHELTER_HATCH.minX - 0.01 && x < SHELTER_HATCH.maxX + 0.01 && z > SHELTER_HATCH.minZ - 0.01 && z < SHELTER_HATCH.maxZ + 0.1;
      expect(inCutting || inHatch, `${x},${z}`).toBe(true);
    }
  });

  it("stands in from afar in the furniture's block, closing the cutting's hole in the terrain", () => {
    const sink = new MeshSink();
    bakeP2StandIn(sink);
    const misses: string[] = [];
    const c = P2_CUT.bounds;
    for (let x = c.minX + 0.05; x < c.maxX; x += 0.5) for (let z = c.minZ + 0.05; z < c.maxZ; z += 0.5) if (!hitDown(sink, x, z)) misses.push(`${x.toFixed(1)},${z.toFixed(1)}`);
    expect(misses).toEqual([]);
    expect(p2In({ minX: 256, maxX: 512, minZ: 0, maxZ: 256 })).toBe(true);
    expect(p2In({ minX: 256, maxX: 512, minZ: -256, maxZ: 0 })).toBe(false);
  });

  it("stops the rain in the store and the corridor, not in the cutting or on T1 over the corridor", () => {
    expect(p2RoofOver(405, P2.floor + 1.5, 15)).toBe(true);
    expect(p2RoofOver(417, P2.floor + 1.5, 60)).toBe(true);
    expect(p2RoofOver(419, P2.floor + 1.5, 26)).toBe(true);
    expect(p2RoofOver(416, P2.floor + 1.5, 85)).toBe(false);
    expect(p2RoofOver(415, -5, 66)).toBe(false);
  });

  it("is seen from inside, from P-1 by the flight's hole and from T2 before the cutting; not from T1, the hall or P-1's far end", () => {
    expect(p2Visible(STORE_EYE)).toBe(true);
    expect(p2Visible({ x: 417, y: P2.floor + 1.6, z: 60 })).toBe(true);
    expect(p2Visible({ x: 412, y: P1.floor + 1.6, z: 26 })).toBe(true);
    expect(p2Visible({ x: 416, y: -7.0, z: P2_CUTTING.maxZ + 8 })).toBe(true);
    expect(p2Visible({ x: 418, y: -4.2, z: 78 })).toBe(false);
    expect(p2Visible({ x: 418, y: FOODHALL.floor + 1.6, z: 45 })).toBe(false);
    expect(p2Visible({ x: 398, y: P1.floor + 1.6, z: 5 })).toBe(false);
    expect(P1_STAIR_DOWN.minX).toBeGreaterThan(P1.minX);
  });

  const setup = (at: V) => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const kit = new CityKit(scene, materials, null, kitData, { labels: false });
    const eye = { ...at };
    const box = { city: true };
    const deps = { scene, materials, kit: () => kit, city: () => box.city, eye: () => eye };
    return { view: new P2View(deps), alchemia: new AlchemiaView(deps), eye, box, materials };
  };

  it("draws the store and its lamp down there only, P-1's and the hall's lamps off then", () => {
    const { view, alchemia, eye, box, materials } = setup(STORE_EYE);
    const frame = () => {
      alchemia.update();
      alchemia.parking.update(1 / 60);
      view.update();
    };
    frame();
    expect(view.stats.meshes).toBe(1);
    expect(view.stats.triangles).toBeGreaterThan(1000);
    expect(materials.light(P2_LAMP_KEY)).toBeDefined();
    expect(materials.light(PARKING_LAMP_KEY)).toBeUndefined();
    // The hall over it is behind its slabs: its inside off (stage 5e: P-2's scene keeps its draw calls).
    expect(alchemia.stats.meshes).toBe(0);
    // In the corridor under the hall: the hall's lamp off too.
    Object.assign(eye, { x: 417, y: P2.floor + 1.6, z: 45 });
    frame();
    expect(view.stats.meshes).toBe(1);
    expect(materials.light(ALCHEMIA_LAMP_KEY)).toBeUndefined();
    // Up on P-1 by the hole: the store seen through it, P-1's lamp on, P-2's off.
    Object.assign(eye, { x: 412, y: P1.floor + 1.6, z: 26 });
    frame();
    expect(view.stats.meshes).toBe(1);
    expect(materials.light(P2_LAMP_KEY)).toBeUndefined();
    expect(materials.light(PARKING_LAMP_KEY)).toBeDefined();
    // In the hall: nothing of P-2, the hall's lamp on.
    Object.assign(eye, { x: 418, y: FOODHALL.floor + 1.6, z: 45 });
    frame();
    expect(view.stats.meshes).toBe(0);
    expect(materials.light(ALCHEMIA_LAMP_KEY)).toBeDefined();
    Object.assign(eye, STORE_EYE);
    frame();
    box.city = false;
    view.update();
    expect(view.stats.meshes).toBe(0);
    expect(materials.light(P2_LAMP_KEY)).toBeUndefined();
  });

  it("lights the store dimly from its ceiling, never the ceiling itself: no glow on it seen from the floor (G-490)", () => {
    const { view, materials } = setup(STORE_EYE);
    view.update();
    const lamp = materials.light(P2_LAMP_KEY)!;
    const down = { x: 0, y: -1, z: 0 };
    let glow = 0;
    for (let ex = P2.minX + 1; ex < P2.maxX; ex += 3)
      for (let ez = P2.minZ + 1; ez < P2.maxZ; ez += 3)
        for (let x = P2.minX; x <= P2.maxX; x += 1)
          for (let z = P2.minZ; z <= P2.maxZ; z += 1) {
            const on = pointLightOn(lamp, { x, y: P2.ceiling, z }, down, { x: ex, y: P2.floor + 1.6, z: ez });
            if (on.diffuse > 0.03 || on.specular > 0.18) glow++;
          }
    expect(glow).toBe(0);
    // Half-dark: the floor under it lit, at under half of what P-1's lamp puts on P-1's floor under it.
    const p1 = setup({ x: 402, y: P1.floor + 1.6, z: 15 });
    p1.alchemia.parking.update(1 / 60);
    const cold = p1.materials.light(PARKING_LAMP_KEY)!;
    const at = (l: typeof lamp, y: number) => l.intensity * pointLightOn(l, { x: l.position.x, y, z: l.position.z }, { x: 0, y: 1, z: 0 }, { x: l.position.x + 3, y: y + 1.6, z: l.position.z }).diffuse;
    expect(at(lamp, P2.floor)).toBeGreaterThan(0.2);
    expect(at(lamp, P2.floor)).toBeLessThan(at(cold, P1.floor) / 2);
  });
});
