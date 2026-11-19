// @ts-expect-error The engine is typed for the browser; the test reads the kit off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { ALCHEMIA_T2, P2, SHELTER, SHELTER_HATCH, SHELTER_HATCH_PIECES, SHELTER_PIECES, shelterGateStairY, shelterHatchStairY } from "@seki/sim";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { CityKit } from "../src/renderer/city-kit";
import { GeometrySink, parseCityKit } from "../src/renderer/city-kit-data";
import { ALCHEMIA_LAMP_KEY, AlchemiaView } from "../src/renderer/alchemia/alchemia-view";
import { p2Inside, p2Outside } from "../src/renderer/alchemia/p2-geometry";
import { P2_LAMP_KEY, P2View, SHELTER_LAMP_KEY, eyeInP2, eyeInShelter, p2RoofOver, p2Visible } from "../src/renderer/alchemia/p2-view";
import { PARKING_LAMP_KEY } from "../src/renderer/alchemia/parking-view";

/**
 * The shelter under T2 (ADR-0074 stage 5d1) in the engine: its room, passage and the gate's flight
 * in P-2's mesh, the hatch's shaft in Alchemia's outside mesh; seen from inside, from P-2 and from
 * T2 by the hatch; its own weak lamp with the eye in it, P-2's, P-1's and the hall's off then.
 */

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const kitData = parseCityKit(file("city-kit.glb"));
const ROOM_EYE = { x: 428, y: SHELTER.floor + 1.6, z: 94.5 };
const HATCH_Z = (SHELTER_HATCH.minZ + SHELTER_HATCH.maxZ) / 2;

describe("the shelter under T2 in the engine (ADR-0074 stage 5d1)", () => {
  it("draws its pieces with P-2's inside, the hatch's in Alchemia's outside sink", () => {
    const inside = p2Inside(kitData, SHELTER_PIECES);
    expect(inside.indices.length / 3 / 12).toBeGreaterThanOrEqual(SHELTER_PIECES.length);
    const outside = new GeometrySink();
    p2Outside(outside, kitData, SHELTER_HATCH_PIECES);
    expect(outside.indices.length / 3 / 12).toBeGreaterThanOrEqual(SHELTER_HATCH_PIECES.length);
  });

  it("has the eye in it in its room, passage and on both flights, not in P-2's corridor, on T2 or on the hatch's landing", () => {
    for (const e of [ROOM_EYE, { x: 421.7, y: SHELTER.floor + 1.6, z: 80 }, { x: 421.7, y: shelterGateStairY(72) + 1.6, z: 72 }, { x: 436.5, y: shelterHatchStairY(436.5) + 1.6, z: HATCH_Z }]) {
      expect(eyeInShelter(e), `${e.x},${e.z}`).toBe(true);
      expect(eyeInP2(e), `${e.x},${e.z}`).toBe(true);
    }
    for (const e of [{ x: 417, y: P2.floor + 1.6, z: 69.8 }, { x: 430, y: ALCHEMIA_T2 + 1.6, z: 94 }, { x: 421.7, y: -6.4 + 1.6, z: 72 }, { x: 440.8, y: ALCHEMIA_T2 + 1.6, z: HATCH_Z }]) {
      expect(eyeInShelter(e), `${e.x},${e.z}`).toBe(false);
    }
    expect(eyeInP2({ x: 417, y: P2.floor + 1.6, z: 69.8 })).toBe(true);
  });

  it("is seen from inside it and from T2 by the hatch; rain stops under its slab, not in the hatch's shaft", () => {
    expect(p2Visible(ROOM_EYE)).toBe(true);
    expect(p2Visible({ x: SHELTER_HATCH.maxX + 6, y: ALCHEMIA_T2 + 1.6, z: HATCH_Z + 2 })).toBe(true);
    expect(p2RoofOver(428, SHELTER.floor + 1.5, 90)).toBe(true);
    expect(p2RoofOver(439, ALCHEMIA_T2 + 0.5, HATCH_Z)).toBe(false);
    expect(p2RoofOver(428, ALCHEMIA_T2 + 1, 90)).toBe(false);
  });

  it("lights the shelter with its own lamp, the others off; P-2's lamp back in P-2's corridor", () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const kit = new CityKit(scene, materials, null, kitData, { labels: false });
    const eye = { ...ROOM_EYE };
    const deps = { scene, materials, kit: () => kit, city: () => true, eye: () => eye };
    const view = new P2View(deps);
    const alchemia = new AlchemiaView(deps);
    const frame = () => {
      alchemia.update();
      alchemia.parking.update(1 / 60);
      view.update();
    };
    frame();
    expect(view.stats.meshes).toBe(1);
    expect(materials.light(SHELTER_LAMP_KEY)).toBeDefined();
    for (const k of [P2_LAMP_KEY, PARKING_LAMP_KEY, ALCHEMIA_LAMP_KEY]) expect(materials.light(k), k).toBeUndefined();
    Object.assign(eye, { x: 417, y: P2.floor + 1.6, z: 60 });
    frame();
    expect(materials.light(SHELTER_LAMP_KEY)).toBeUndefined();
    expect(materials.light(P2_LAMP_KEY)).toBeDefined();
  });
});
