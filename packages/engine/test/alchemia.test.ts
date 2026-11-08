// @ts-expect-error The engine is typed for the browser; the test reads the kit off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { ALCHEMIA_CENTRE, ALCHEMIA_PIECES, ALCHEMIA_T0, ALCHEMIA_T1, ARKADY, ARKADY_CENTRE, ARKADY_PIECES, FOODHALL, P1, SQUARE_GARLANDS, arkadyLocal } from "@seki/sim";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { CityKit } from "../src/renderer/city-kit";
import { GeometrySink, parseCityKit, swatchUv } from "../src/renderer/city-kit-data";
import { BULB_COLOURS, garlandBulbs, garlandsGeometry } from "../src/renderer/alchemia/garlands";
import { alchemiaGeometry } from "../src/renderer/alchemia/alchemia-geometry";
import { ALCHEMIA_DRAW, ALCHEMIA_LAMP_KEY, AlchemiaView, INSIDE_DRAW } from "../src/renderer/alchemia/alchemia-view";
import { builtRoofOver } from "../src/renderer/built-roofs";

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const kitData = parseCityKit(file("city-kit.glb"));

/**
 * Alchemia by the investor's plan (ADR-0074 stage 1) in the engine: the simulation's pieces drawn
 * on the city kit's material, the outside within 150 m, the inside with its lamp only near the
 * hall; the budgets of ADR-0074 §7 (a building and an inside up to some 8 thousand triangles each).
 */
describe("Alchemia's food hall in the engine (ADR-0074 stage 1)", () => {
  it("draws every piece of the simulation, the outside and the inside within their budgets", () => {
    const { outside, inside } = alchemiaGeometry(kitData);
    // A box is 12 triangles; the frame, the signs and the lights come on top.
    const boxes = (s: { indices: readonly number[] }) => s.indices.length / 3 / 12;
    expect(boxes(outside) + boxes(inside)).toBeGreaterThanOrEqual(ALCHEMIA_PIECES.length + ARKADY_PIECES.length);
    expect(outside.indices.length / 3).toBeLessThanOrEqual(8000);
    expect(inside.indices.length / 3).toBeLessThanOrEqual(8000);
    // Nothing of it outside the plot round the hall and its ramps, T2 with its stairs, the Arkady with their pavements, and the pavilion on the corner (stage 3).
    const onPlot = (x: number, z: number) => x > FOODHALL.minX - 7 && x < FOODHALL.maxX + 7 && z > FOODHALL.minZ - 7 && z < 94;
    const onCorner = (x: number, z: number) => x > 420.2 && x < 436.6 && z > -9.1 && z < 6.4;
    const onT2 = (x: number, z: number) => x > 423 && x < 445 && z > 74 && z < 122;
    // P-1's ramp in its trench and its stair core's house on the car park (stage 4, `alchemia-parking.test.ts`).
    const byRamp = (x: number, z: number) => x > 409.2 && x < 422 && z > -6 && z < 25;
    // T0's square where the car park was, its pergolas and beds (stage 7): within the car park's outline's box.
    const onSquare = (x: number, z: number) => x > 379.2 && x < 441.3 && z > -9.3 && z < 38.6;
    const byArkady = (x: number, z: number) => {
      const q = arkadyLocal(x, z);
      return q.a > -3.2 && q.a < ARKADY.length + 0.2 && q.c > -0.3 && q.c < ARKADY.depth + 5.2;
    };
    for (let i = 0; i < outside.positions.length; i += 3) {
      const [x, z] = [outside.positions[i]!, outside.positions[i + 2]!];
      expect(onPlot(x, z) || onT2(x, z) || byArkady(x, z) || onCorner(x, z) || byRamp(x, z) || onSquare(x, z), `${x.toFixed(1)},${z.toFixed(1)}`).toBe(true);
    }
  });

  it("draws T0's pergolas in timber with their paper lanterns lit, and the green roof's lawns on its paving (stage 7)", () => {
    // The first vertex's uv of the pieces of a kind: every box's vertices share its swatch.
    const uvOf = (pieces: typeof ALCHEMIA_PIECES) => {
      const s = alchemiaGeometry(kitData, pieces).outside;
      return [s.uvs[0], s.uvs[1]];
    };
    const kind = (k: string) => ALCHEMIA_PIECES.filter((p) => p.kind === k);
    expect(uvOf(kind("lantern"))).toEqual([...swatchUv(kitData, "win-warm")]);
    expect(uvOf(kind("pergola"))).toEqual([...swatchUv(kitData, "rust")]);
    expect(uvOf(kind("lawn"))).toEqual([...swatchUv(kitData, "plant")]);
    const slab = kind("roof").filter((p) => (p.box.x1 - p.box.x0) * (p.box.z1 - p.box.z0) > 100);
    expect(uvOf(slab)).toEqual([...swatchUv(kitData, "trim-light")]);
  });

  it("hangs coloured garlands between T0's pergolas, their bulbs lit in the kit's glow colours, in the outside's one mesh (stage 7)", () => {
    const sink = new GeometrySink();
    garlandsGeometry(sink, kitData);
    const bulbs = SQUARE_GARLANDS.flatMap((g) => garlandBulbs(g));
    expect(SQUARE_GARLANDS).toHaveLength(4);
    expect(bulbs.length).toBeGreaterThan(50);
    // Every colour in turn, each a glow swatch of the kit (self-lit at night).
    expect(new Set(bulbs.map((b) => b.colour)).size).toBe(BULB_COLOURS.length);
    for (const c of BULB_COLOURS) expect(kitData.swatches.find((s) => s.name === c)?.kind, c).toBe("glow");
    // Their uvs are among the sink's: the bulbs are drawn.
    const uvs = new Set<string>();
    for (let i = 0; i < sink.uvs.length; i += 2) uvs.add(`${sink.uvs[i]},${sink.uvs[i + 1]}`);
    for (const c of BULB_COLOURS) expect(uvs.has(swatchUv(kitData, c).join(","))).toBe(true);
    // In the outside's mesh, within its budget.
    const { outside } = alchemiaGeometry(kitData);
    expect(outside.indices.length / 3).toBeLessThanOrEqual(8000);
  });

  const setup = () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const kit = new CityKit(scene, materials, null, kitData, { labels: false });
    const eye = { x: ALCHEMIA_CENTRE.x, y: 0, z: ALCHEMIA_CENTRE.z };
    const box = { city: true };
    const view = new AlchemiaView({ scene, materials, kit: () => kit, city: () => box.city, eye: () => eye });
    return { scene, view, eye, box, materials };
  };

  it("draws the outside from afar, the inside and its lamp only near the hall, none without the map city", () => {
    const { scene, view, eye, box, materials } = setup();
    view.update();
    expect(view.stats.meshes).toBe(2);
    expect(materials.light(ALCHEMIA_LAMP_KEY)).toBeDefined();
    eye.z = FOODHALL.maxZ + INSIDE_DRAW + 3;
    view.update();
    expect(view.stats.meshes).toBe(2);
    eye.z += 10;
    view.update();
    expect(view.stats.meshes).toBe(1);
    expect(materials.light(ALCHEMIA_LAMP_KEY)).toBeUndefined();
    eye.z = ALCHEMIA_CENTRE.z - ALCHEMIA_DRAW - 15;
    view.update();
    expect(view.stats.meshes).toBe(0);
    eye.z = ALCHEMIA_CENTRE.z;
    box.city = false;
    view.update();
    expect(view.stats.meshes).toBe(0);
    expect(scene.meshes.filter((m) => m.name.startsWith("alchemia"))).toHaveLength(2);
  });

  it("draws the outside near the Arkady (ADR-0074 stage 2) when the hall is beyond its distance", () => {
    const { view, eye } = setup();
    eye.x = ARKADY_CENTRE.x + 20;
    eye.z = ARKADY_CENTRE.z + 110;
    expect(Math.hypot(eye.x - ALCHEMIA_CENTRE.x, eye.z - ALCHEMIA_CENTRE.z)).toBeGreaterThan(ALCHEMIA_DRAW + 10);
    view.update();
    expect(view.stats.meshes).toBe(1);
    eye.z = ARKADY_CENTRE.z + ALCHEMIA_DRAW + 15;
    view.update();
    expect(view.stats.meshes).toBe(0);
  });

  it("stays out of the street scenes of npr-perf, all of them farther than it is drawn", () => {
    // Where the scenes' cameras end up (e2e/npr-perf.spec.ts): the start and the walk along the yaw.
    const scenes = [
      { x: 270, z: -81, yaw: Math.PI / 2, walk: 60 },
      { x: 520, z: -63, yaw: Math.atan2(41, 23), walk: 60 },
      { x: 315, z: -92.9, yaw: 0, walk: 0 },
    ];
    for (const s of scenes) {
      for (const k of [0, 1]) {
        const x = s.x + Math.sin(s.yaw) * s.walk * k;
        const z = s.z + Math.cos(s.yaw) * s.walk * k;
        expect(Math.hypot(x - ALCHEMIA_CENTRE.x, z - ALCHEMIA_CENTRE.z)).toBeGreaterThan(ALCHEMIA_DRAW + 10);
        expect(Math.hypot(x - ARKADY_CENTRE.x, z - ARKADY_CENTRE.z)).toBeGreaterThan(ALCHEMIA_DRAW + 10);
      }
    }
  });

  it("stops the rain in the hall, its stair house and the lift's kiosk, not on its roof or on T1", () => {
    // Under the green roof: by the counters, at the foot of the stairs, under the ceiling.
    for (const [x, z] of [[418, 45], [430, 55], [402, 40], [411, 34]] as const) expect(builtRoofOver(x, ALCHEMIA_T1 + 1.5, z), `${x},${z}`).toBe(true);
    expect(builtRoofOver(418, FOODHALL.ceiling - 0.1, 45)).toBe(true);
    // On the roof, in the stair house and in the lift's kiosk.
    expect(builtRoofOver(404, ALCHEMIA_T0 + 1.5, 33.5)).toBe(true);
    expect(builtRoofOver(413.5, ALCHEMIA_T0 + 1.5, 33.5)).toBe(true);
    // Rain on the roof and on T1 before the front, as on the car park over P-1; P-1 stays dry.
    expect(builtRoofOver(420, ALCHEMIA_T0 + 1, 45)).toBe(false);
    expect(builtRoofOver(420, ALCHEMIA_T1 + 1.5, 65)).toBe(false);
    expect(builtRoofOver(402, ALCHEMIA_T0 + 1, 15)).toBe(false);
    expect(builtRoofOver(402, P1.floor + 1.5, 15)).toBe(true);
  });
});
