// @ts-expect-error The engine is typed for the browser; the test reads the props off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { ALCHEMIA_CENTRE, ALCHEMIA_MODULES, ALCHEMIA_ROOF, alchemiaParts, alchemiaPoint, type PlacedAlchemiaModule } from "@seki/sim";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { CityKit } from "../src/renderer/city-kit";
import { parseCityKit } from "../src/renderer/city-kit-data";
import { mergeCityProps, parseCityProps, triangleCount } from "../src/renderer/city-props";
import { alchemiaGeometry } from "../src/renderer/alchemia/alchemia-geometry";
import { ALCHEMIA_DRAW, AlchemiaView } from "../src/renderer/alchemia/alchemia-view";

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const kitData = parseCityKit(file("city-kit.glb"));
const bytes = file("alchemia-props.glb");
const alchemia = parseCityProps(bytes);
const props = mergeCityProps(parseCityProps(file("city-props.glb")), alchemia);

type Pt = { readonly x: number; readonly z: number };

/** A point in the module's own frame (glTF x and z) from a world point: the inverse of `alchemiaPoint`. */
const local = (m: PlacedAlchemiaModule, p: Pt): Pt => {
  const fx = Math.sin(m.yaw);
  const fz = Math.cos(m.yaw);
  const dx = p.x - m.x;
  const dz = p.z - m.z;
  return { x: -dx * fz + dz * fx, z: dx * fx + dz * fz };
};

/** The world vertices of the module's model in the geometry (they follow its plinth's 24). */
const modelVertices = (positions: readonly number[], start: number, count: number): { x: number; y: number; z: number }[] =>
  Array.from({ length: count }, (_, i) => ({ x: positions[3 * (start + i)]!, y: positions[3 * (start + i) + 1]!, z: positions[3 * (start + i) + 2]! }));

describe("alchemia-props.glb (ADR-0063 stage 4)", () => {
  it("holds the hall and five stalls, CC-BY with their credits, within a building's budget each and small", () => {
    expect([...alchemia.models.keys()]).toEqual(ALCHEMIA_MODULES.map((m) => m.key));
    let total = 0;
    for (const m of alchemia.models.values()) {
      expect(triangleCount(m)).toBeLessThanOrEqual(8000);
      total += triangleCount(m);
    }
    expect(total).toBeLessThan(12_000);
    expect(bytes.byteLength).toBeLessThan(640 * 1024);
    expect(alchemia.swatches).toEqual(props.swatches);
    const json = new TextDecoder().decode(new Uint8Array(bytes, 20, new DataView(bytes, 12, 4).getUint32(0, true)));
    expect(json.match(/"credit":"sketchfab-cyberpunk-building"/g)).toHaveLength(1);
    expect(json.match(/"credit":"sketchfab-hw4-cyberpunk-building"/g)).toHaveLength(5);
  });

  it("has the sizes the simulation's solids are made of", () => {
    for (const m of ALCHEMIA_MODULES) {
      const s = alchemia.models.get(m.key)!.size;
      expect(s.x, m.key).toBeCloseTo(m.width, 1);
      expect(s.z, m.key).toBeCloseTo(m.depth, 1);
      expect(s.y, m.key).toBeLessThanOrEqual(m.height + 0.01);
    }
    // The height is the tallest model's of its kind: the hall's, the tallest stall's.
    for (const key of ["alchemia-hall", "alchemia-stall"]) {
      const kind = ALCHEMIA_MODULES.filter((m) => m.key.startsWith(key));
      expect(Math.max(...kind.map((m) => alchemia.models.get(m.key)!.size.y))).toBeGreaterThan(kind[0]!.height - 0.05);
    }
  });
});

describe("Alchemia's geometry (ADR-0063 stage 4)", () => {
  it("stands each model on its floor inside its footprint, under its solid's parts, on a plinth; boxes without the file", () => {
    const withFile = alchemiaGeometry(kitData, props);
    const without = alchemiaGeometry(kitData, null);
    expect(withFile.models).toBe(ALCHEMIA_MODULES.length);
    expect(without.models).toBe(0);
    for (const g of [withFile, without]) for (const i of g.sink.indices) expect(i).toBeLessThan(g.sink.vertexCount);
    let at = 0;
    for (const m of ALCHEMIA_MODULES) {
      at += 24; // the plinth
      const n = alchemia.models.get(m.key)!.positions.length / 3;
      const vs = modelVertices(withFile.sink.positions, at, n);
      at += n;
      const parts = alchemiaParts(m);
      let lowest = Infinity;
      for (const v of vs) {
        const q = local(m, v);
        lowest = Math.min(lowest, v.y);
        expect(Math.abs(q.x), m.key).toBeLessThanOrEqual(m.width / 2 + 1e-3);
        expect(Math.abs(q.z), m.key).toBeLessThanOrEqual(m.depth / 2 + 1e-3);
        // Above a part's top only over a taller part, by the parapets and the name (1.5 m) at most:
        // the hall's upper storey stands over its body, not over its stair.
        const under = parts.filter((p) => q.x >= p.x0 - 0.3 && q.x <= p.x1 + 0.3 && q.z >= p.z0 - 0.3 && q.z <= p.z1 + 0.3);
        expect(v.y - m.floor, `${m.key} at (${q.x.toFixed(2)}, ${q.z.toFixed(2)})`).toBeLessThanOrEqual(Math.max(...under.map((p) => p.top)) + 1.5);
      }
      expect(lowest).toBeCloseTo(m.floor, 2);
    }
    // The roof the next stages use is the hall's body top.
    const hall = ALCHEMIA_MODULES[0]!;
    expect(ALCHEMIA_ROOF.corners.map((c) => local(hall, c)).every((q) => q.x <= alchemiaParts(hall)[0]!.x1 + 1e-6)).toBe(true);
    // The model's +X lies left of its front, as `alchemiaPoint` puts it.
    const p = alchemiaPoint(hall, 1, 0);
    expect(local(hall, p).x).toBeCloseTo(1, 6);
  });
});

describe("Alchemia's view (ADR-0063 stage 4)", () => {
  const setup = () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const kit = new CityKit(scene, materials, null, kitData, { labels: false });
    const eye = { x: ALCHEMIA_CENTRE.x, y: 2, z: ALCHEMIA_CENTRE.z - 60 };
    const box = { city: true, props: props as typeof props | null };
    const view = new AlchemiaView({ scene, kit: () => kit, props: () => box.props, city: () => box.city, eye: () => eye });
    return { scene, view, eye, box };
  };

  it("draws one mesh near the square, none far from it or without the map city", () => {
    const { scene, view, eye, box } = setup();
    view.update();
    expect(view.stats).toMatchObject({ meshes: 1, models: ALCHEMIA_MODULES.length });
    eye.z = ALCHEMIA_CENTRE.z - ALCHEMIA_DRAW - 5;
    view.update();
    expect(view.stats.meshes).toBe(1);
    eye.z -= 10;
    view.update();
    expect(view.stats.meshes).toBe(0);
    eye.z = ALCHEMIA_CENTRE.z;
    view.update();
    expect(view.stats.meshes).toBe(1);
    box.city = false;
    view.update();
    expect(view.stats.meshes).toBe(0);
    expect(scene.meshes.filter((m) => m.name === "alchemia")).toHaveLength(1);
  });

  it("builds boxes before the props file and the models once it loads", () => {
    const { view, box } = setup();
    box.props = null;
    view.update();
    expect(view.stats.models).toBe(0);
    box.props = props;
    view.update();
    expect(view.stats.models).toBe(ALCHEMIA_MODULES.length);
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
      }
    }
  });
});
