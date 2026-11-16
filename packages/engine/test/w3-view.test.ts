// @ts-expect-error The engine is typed for the browser; the test reads the kit off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { W3_CRANE_BRIDGE, W3_INSIDE_BLOCKS, W3_LAYOUT, w3 } from "@seki/sim";
import { Scene, VertexBuffer } from "../src/babylon";
import { INDOOR_RIG, NIGHT_RIG, mixRig } from "../src/npr/lighting";
import { ToonMaterials } from "../src/npr/toon-material";
import { CityKit } from "../src/renderer/city-kit";
import { parseCityKit, swatchUv } from "../src/renderer/city-kit-data";
import { closeOff } from "../src/renderer/mapcity/interior-mode";
import { inW3Hall } from "../src/renderer/tessen-w3/w3-interior-cull";
import { w3InsideGeometry } from "../src/renderer/tessen-w3/w3-inside-geometry";
import { W3_LAMP_PREFIX, w3LampsFor } from "../src/renderer/tessen-w3/w3-lights";
import { linePose } from "../src/renderer/tessen-w3/w3-line-anim";
import { LINE_BOXES, lineGeometry } from "../src/renderer/tessen-w3/w3-line-geometry";
import { W3View, eyeInW3 } from "../src/renderer/tessen-w3/w3-view";

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const kitData = parseCityKit(file("city-kit.glb"));
const tris = (s: { indices: readonly number[] }) => s.indices.length / 3;

/**
 * W-3's hall from the inside in the engine (ADR-0082 stage 2b): its rooms baked from the
 * simulation's blocks within the budgets of ADR-0082 §4, the line's motion deterministic, two
 * lamps at a time and only theirs inside, the interior mode with the eye in its rooms.
 */
describe("W-3's hall baked in the engine (ADR-0082 stage 2b)", () => {
  it("bakes every block of the inside, near only, its outer pieces apart, within the triangles of ADR-0082 §4", () => {
    const { inside, outer } = w3InsideGeometry(kitData);
    const near = W3_INSIDE_BLOCKS.filter((b) => inW3Hall(b.center)).length;
    expect(near).toBeGreaterThan(200);
    expect(tris(inside) / 12).toBeGreaterThan(near);
    expect(tris(outer)).toBe((W3_INSIDE_BLOCKS.length - near) * 12);
    // The static inside: 60 thousand on High, 35 on low (the same mesh on both).
    expect(tris(inside)).toBeLessThanOrEqual(35_000);
    for (let i = 0; i < inside.positions.length; i += 3) {
      const [x, y, z] = [inside.positions[i]!, inside.positions[i + 1]!, inside.positions[i + 2]!];
      expect(x > 2471.9 && x < 2572 && z > 395.4 && z < 440 && y > w3(0, -5, 0).y && y < w3(0, 16.01, 0).y, `${x},${y},${z}`).toBe(true);
    }
  });

  it("lights the strips under the ceilings and the server racks' faces in the kit's glow swatches", () => {
    const { inside } = w3InsideGeometry(kitData);
    const count = (swatch: string) => {
      const [u, v] = swatchUv(kitData, swatch);
      let n = 0;
      for (let i = 0; i < inside.uvs.length; i += 2) if (inside.uvs[i] === u && inside.uvs[i + 1] === v) n++;
      return n / 24;
    };
    // The hall's strips, the rooms' and the basement's.
    expect(count("win-white")).toBeGreaterThan(40);
    // Server rooms N and S: their racks' status lights.
    expect(count("win-teal") + count("neon-green")).toBeGreaterThan(200);
    expect(count("neon-red")).toBe(2);
  });

  it("moves the line the same way for the same time and seed, the arms still on low quality", () => {
    const a = linePose(12.5);
    expect(linePose(12.5)).toEqual(a);
    expect(linePose(13.5)).not.toEqual(a);
    expect(linePose(12.5, 7)).not.toEqual(a);
    expect(linePose(0, undefined, true)).toEqual(linePose(99, undefined, true));
    const boxes = LINE_BOXES.arm * 8 + LINE_BOXES.body * 6 + LINE_BOXES.bridge + LINE_BOXES.screens;
    // The core's screen (the last two boxes) stands in server room N, the rest in the assembly hall.
    const core = 2 * 24;
    for (const t of [0, 3.3, 47, 600]) {
      const p = linePose(t);
      const s = lineGeometry(kitData, p);
      // The same boxes in every pose: a frame only moves the vertices.
      expect(s.vertexCount).toBe(boxes * 24);
      expect(p.bridgeX).toBeGreaterThanOrEqual(W3_CRANE_BRIDGE.minX - 1e-9);
      expect(p.bridgeX).toBeLessThanOrEqual(W3_CRANE_BRIDGE.maxX + 1e-9);
      for (const b of p.bodies) expect(b.x > W3_LAYOUT.BELT_X.minX && b.x < W3_LAYOUT.BELT_X.maxX).toBe(true);
      // Nothing of it through the floor or out of the assembly hall.
      for (let i = 0; i < s.positions.length; i += 3) {
        const [x, y, z] = [s.positions[i]!, s.positions[i + 1]!, s.positions[i + 2]!];
        const inServerRoom = x > 2560 && x < 2572 && z > 432 && z < 440 && y > w3(0, 1, 0).y && y < w3(0, 2, 0).y;
        const inHall = x > 2510 && x < 2548 && z > 406 && z < 430 && y > w3(0, 0, 0).y - 1e-6 && y < w3(0, 16, 0).y;
        expect(i / 3 >= s.vertexCount - core ? inServerRoom : inHall, `${t}: ${x},${y},${z}`).toBe(true);
      }
    }
    // Under 25 thousand triangles on High (ADR-0082 §4).
    expect(tris(lineGeometry(kitData, a))).toBeLessThanOrEqual(25_000);
  });

  it("shows the job on the line (ADR-0082 stage 3): red beacons in the alarm, steady on low, and the screens by the upload", () => {
    const swatches = (p: ReturnType<typeof linePose>) => {
      const s = lineGeometry(kitData, p);
      const count = (name: string) => {
        const [u, v] = swatchUv(kitData, name);
        let n = 0;
        for (let i = 0; i < s.uvs.length; i += 2) if (s.uvs[i] === u && s.uvs[i + 1] === v) n++;
        return n / 24;
      };
      return { red: count("neon-red") - 6, amber: count("neon-amber"), teal: count("win-teal"), violet: count("neon-violet") };
    };
    // The bodies' tail lights are red in every pose (6 of them): what is over them is the beacons'.
    expect(swatches(linePose(3)).red).toBe(0);
    const alarm = { alarm: true, screens: "idle" } as const;
    expect(swatches(linePose(0, undefined, true, alarm)).red).toBe(8);
    expect(swatches(linePose(0, undefined, true)).red).toBe(0);
    const lit = [0, 0.13, 0.27, 0.41].map((t) => swatches(linePose(t, undefined, false, alarm)).red);
    expect(Math.max(...lit)).toBeGreaterThan(0);
    expect(lit.every((n) => n <= 8)).toBe(true);
    // Five screens: teal idle, amber during the upload (blinking with teal), violet over red with the virus.
    expect(swatches(linePose(0, undefined, true)).teal).toBe(5);
    expect(swatches(linePose(0, undefined, true, { alarm: false, screens: "upload" })).amber).toBe(5);
    expect(swatches(linePose(0, undefined, true, { alarm: false, screens: "infected" })).violet).toBe(5);
  });

  it("puts on the two lamps nearest the eye's room: the hall's, the server room's glow, the basement's", () => {
    const keys = (x: number, y: number, z: number) => w3LampsFor(w3(x, y, z)).map((l) => l.key.slice(W3_LAMP_PREFIX.length));
    expect(keys(2520, 1.6, 418)).toEqual(["hall-w", "hall-e"]);
    expect(keys(2566, 1.6, 436)[0]).toBe("server-n");
    expect(keys(2530, -3, 402)[0]).toBe("basement");
    expect(keys(2560, 1.6, 418)[0]).toBe("chamber");
  });

  const setup = () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const kit = new CityKit(scene, materials, null, kitData, { labels: false });
    const eye = { ...w3(2462, 3.5, 421) };
    const view = (still: boolean) => new W3View({ scene, materials, kit: () => kit, city: () => true, eye: () => eye, still });
    return { scene, materials, eye, view };
  };

  it("draws its inside and lamps only near it, and in its rooms only its own lamps light it", () => {
    const { materials, eye, view } = setup();
    const v = view(false);
    // A street lamp by the yard: it would shine through the hall's walls.
    materials.addLight("e123", { position: w3(2512, 5, 412), color: "#ffffff", range: 20, intensity: 1 });
    v.update(1 / 60, false);
    expect(v.stats.meshes).toBe(1);
    expect(v.lampsOn).toHaveLength(0);
    expect(v.interior).toBe(false);
    Object.assign(eye, w3(2520, 1.6, 418));
    v.update(1 / 60, false);
    v.update(1 / 60, false);
    // The renderer moves the light slots with the eye, scoped to the hall's lamps in its rooms.
    materials.setLightFocus(eye.x, eye.z, v.lightScope);
    expect(v.stats.meshes).toBe(3);
    expect(v.interior).toBe(true);
    expect(v.lampsOn.map((l) => l.key)).toEqual([`${W3_LAMP_PREFIX}hall-w`, `${W3_LAMP_PREFIX}hall-e`]);
    expect(materials.lightCount).toBe(2);
    // Out through the wagon gate onto the yard: the street's lamp is back, the hall's fade with the distance.
    Object.assign(eye, w3(2490, 1.6, 418));
    v.update(1 / 60, false);
    materials.setLightFocus(eye.x, eye.z, v.lightScope);
    expect(v.interior).toBe(false);
    expect(materials.lightCount).toBe(3);
  });

  it("moves the line's vertices on High, holds them on low and in a frozen frame", () => {
    const { eye, view } = setup();
    Object.assign(eye, w3(2520, 1.6, 418));
    for (const still of [false, true]) {
      const v = view(still);
      v.update(0, false);
      const line = () => {
        const m = (v as unknown as { line: { getVerticesData(k: string): ArrayLike<number> } }).line;
        return Array.from(m.getVerticesData(VertexBuffer.PositionKind));
      };
      const before = line();
      v.update(0.5, true);
      expect(line()).toEqual(before);
      v.update(0.5, false);
      expect(line().some((p, i) => p !== before[i])).toBe(!still);
    }
  });

  it("re-poses the line for the job's effects on low quality too, once each", () => {
    const { eye, view } = setup();
    Object.assign(eye, w3(2520, 1.6, 418));
    const v = view(true);
    v.update(0, false);
    // As float32, as the buffer keeps them however they were handed over.
    const uvs = () => Array.from((v as unknown as { line: { getVerticesData(k: string): ArrayLike<number> } }).line.getVerticesData(VertexBuffer.UVKind), Math.fround);
    const before = uvs();
    v.update(0.5, false);
    expect(uvs()).toEqual(before);
    v.setMission({ kind: "alarm-light", active: true });
    v.update(0.5, false);
    const red = uvs();
    expect(red).not.toEqual(before);
    v.setMission({ kind: "line-screens", state: "infected" });
    v.update(0.5, false);
    expect(uvs()).not.toEqual(red);
    v.setMission({ kind: "alarm-light", active: false });
    v.setMission({ kind: "line-screens", state: "idle" });
    v.update(0.5, false);
    expect(uvs()).toEqual(before);
  });

  it("knows the eye in the hall's and the basement's rooms, not on the roof nor in the yard", () => {

    expect(eyeInW3(w3(2520, 1.6, 418))).toBe(true);
    expect(eyeInW3(w3(2530, -3, 402))).toBe(true);
    expect(eyeInW3(w3(2530, 6.6, 433))).toBe(true);
    expect(eyeInW3(w3(2530, 11.5, 435))).toBe(false);
    expect(eyeInW3(w3(2490, 1.6, 418))).toBe(false);
  });

  it("turns the moon and sun off the materials inside, and the city's pieces clear of the hall", () => {
    const rig = mixRig(NIGHT_RIG, INDOOR_RIG, 1);
    expect(rig.sunColor).toBe("#000000");
    expect(rig.sunDir).toBe(NIGHT_RIG.sunDir);
    expect(mixRig(NIGHT_RIG, INDOOR_RIG, 0)).toBe(NIGHT_RIG);
    const on = new Map<string, boolean>();
    const mesh = (name: string) => ({ setEnabled: (v: boolean) => on.set(name, v) }) as never;
    const off = closeOff(
      [
        { bounds: { minX: 2432, maxX: 2560, minZ: 384, maxZ: 512 }, meshes: [mesh("hall-cell"), null] },
        { bounds: { minX: 2432, maxX: 2560, minZ: 256, maxZ: 384 }, meshes: [mesh("south-cell")] },
      ],
      { minX: 2478, maxX: 2590, minZ: 388, maxZ: 456 },
    );
    expect(off).toBe(1);
    expect([...on]).toEqual([["south-cell", false]]);
  });
});
