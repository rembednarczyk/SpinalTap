// @ts-expect-error The engine is typed for the browser; the test reads the kit off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { W3_GATE, W3_INSIDE_BLOCKS, WORLD_CHUNKS, w3 } from "@seki/sim";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { neonText } from "../src/renderer/alchemia/neon-letters";
import { CityKit } from "../src/renderer/city-kit";
import { GeometrySink, parseCityKit, swatchUv } from "../src/renderer/city-kit-data";
import { W3_CABIN, W3_NEON, w3Dress } from "../src/renderer/tessen-w3/w3-dress";
import { W3_CHAMBER_DRONES, W3_DRONE, W3_DRONE_BOXES, W3_ROOF_PADS, W3_TEST_DRONE } from "../src/renderer/tessen-w3/w3-drones";
import { W3_FLOOD_PREFIX, W3Fx, w3FxPlan, w3SparkPoints } from "../src/renderer/tessen-w3/w3-fx";
import { w3InsideGeometry } from "../src/renderer/tessen-w3/w3-inside-geometry";
import { W3_WORDS, letteringRects, letteringWidth, paintable } from "../src/renderer/tessen-w3/w3-lettering";
import { W3View } from "../src/renderer/tessen-w3/w3-view";

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const kitData = parseCityKit(file("city-kit.glb"));
const tris = (s: GeometrySink) => s.indices.length / 3;

/** The dress alone, on empty sinks. */
const dressed = () => {
  const inside = new GeometrySink();
  const outer = new GeometrySink();
  w3Dress(kitData, { inside, outer });
  return { inside, outer };
};

/** Vertices of a sink on a swatch, and where they are. */
const onSwatch = (s: GeometrySink, swatch: string): { x: number; y: number; z: number }[] => {
  const [u, v] = swatchUv(kitData, swatch);
  const out: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < s.vertexCount; i++) if (s.uvs[i * 2] === u && s.uvs[i * 2 + 1] === v) out.push({ x: s.positions[i * 3]!, y: s.positions[i * 3 + 1]!, z: s.positions[i * 3 + 2]! });
  return out;
};

/**
 * Tessen's 2077 layer on W-3 (ADR-0082 stage 4): baked into the hall's two meshes within the
 * triangles of ADR-0082 §4, the neon TESSEN over the gate, the cabin lit red round the
 * simulation's glass, the drones clear of the solids, the steam and the sparks on High only.
 */
describe("W-3's 2077 layer (ADR-0082 stage 4)", () => {
  it("adds no mesh: the dress goes into the inside and outer sinks within the triangles of ADR-0082 §4", () => {
    const bare = w3InsideGeometry(kitData);
    const [inside0, outer0] = [tris(bare.inside), tris(bare.outer)];
    w3Dress(kitData, bare);
    const added = { outer: tris(bare.outer) - outer0, inside: tris(bare.inside) - inside0 };
    // Glass, lights and neon: at most 6 thousand (§4); the phone in the hall has 11 thousand to spare.
    expect(added.outer).toBeGreaterThan(1000);
    expect(added.outer).toBeLessThanOrEqual(6000);
    expect(added.inside).toBeLessThanOrEqual(2500);
    expect(added.outer + added.inside).toBeLessThanOrEqual(8000);
  });

  it("lights TESSEN over the wagon gate in neon, TESS red and EN blue, on its board facing the river", () => {
    const strokes = neonText("TESSEN", W3_NEON.height);
    expect(new Set(strokes.map((s) => s.letter))).toEqual(new Set([0, 1, 2, 3, 4, 5]));
    const { outer } = dressed();
    // The red over the gate's foot (its posts' markers below, the drones' eyes on the roofs east of it).
    const red = onSwatch(outer, "neon-red").filter((p) => p.y > w3(0, W3_NEON.foot - 0.01, 0).y && p.x < W3_GATE.x + 1);
    const blue = onSwatch(outer, "neon-blue");
    expect(red.length).toBe(strokes.filter((s) => s.letter < 4).length * 24);
    expect(blue.length).toBe(strokes.filter((s) => s.letter >= 4).length * 24);
    for (const p of [...red, ...blue]) {
      expect(p.x).toBeLessThan(W3_GATE.x);
      expect(p.x).toBeGreaterThan(W3_GATE.x - 0.4);
      expect(p.z).toBeGreaterThan(W3_GATE.minZ - 1);
      expect(p.z).toBeLessThan(W3_GATE.maxZ + 1);
    }
    // TESS on the reader's left, the north, from the river: red north of blue.
    const mean = (ps: { z: number }[]) => ps.reduce((s, p) => s + p.z, 0) / ps.length;
    expect(mean(red)).toBeGreaterThan(mean(blue));
  });

  it("goes round the tower's cabin of glass in the simulation, its panes lit red", () => {
    const glass = WORLD_CHUNKS.flatMap((c) => c.props).filter(
      (p) => p.view.kind === "block" && p.view.material === "glass" && Math.abs(p.center.x - 2491) < 6 && Math.abs(p.center.z - 441) < 6 && p.center.y > w3(0, 20, 0).y,
    );
    expect(glass.length).toBeGreaterThan(0);
    const box = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, bottom: Infinity, top: -Infinity };
    for (const p of glass) {
      if (p.view.kind !== "block") continue;
      const h = { x: p.view.size.x / 2, y: p.view.size.y / 2, z: p.view.size.z / 2 };
      box.minX = Math.min(box.minX, p.center.x - h.x);
      box.maxX = Math.max(box.maxX, p.center.x + h.x);
      box.minZ = Math.min(box.minZ, p.center.z - h.z);
      box.maxZ = Math.max(box.maxZ, p.center.z + h.z);
      box.bottom = Math.min(box.bottom, p.center.y - h.y - w3(0, 0, 0).y);
      box.top = Math.max(box.top, p.center.y + h.y - w3(0, 0, 0).y);
    }
    for (const k of ["minX", "maxX", "minZ", "maxZ", "bottom", "top"] as const) expect(box[k], k).toBeCloseTo(W3_CABIN[k], 2);
    const panes = onSwatch(dressed().outer, "taillight");
    expect(panes.length).toBe(16 * 24);
    for (const p of panes) {
      const outside = p.x < W3_CABIN.minX || p.x > W3_CABIN.maxX || p.z < W3_CABIN.minZ || p.z > W3_CABIN.maxZ;
      expect(outside, `${p.x},${p.z}`).toBe(true);
    }
  });

  it("stands the drones clear of the hall's solids: three on roof frames, three in the test chamber", () => {
    const { inside, outer } = dressed();
    const olive = (s: GeometrySink) => onSwatch(s, "paint").length;
    expect(olive(outer)).toBeGreaterThan(0);
    // Each drone's 19 boxes; the frames' and the chamber's other pieces besides.
    expect(tris(inside)).toBeGreaterThanOrEqual(3 * W3_DRONE_BOXES * 12);
    expect(W3_ROOF_PADS).toHaveLength(3);
    const half = W3_DRONE.span / 2;
    for (const d of [...W3_CHAMBER_DRONES, W3_TEST_DRONE]) {
      for (const b of W3_INSIDE_BLOCKS) {
        const apart =
          Math.abs(b.center.x - d.at.x) >= b.size.x / 2 + half ||
          Math.abs(b.center.z - d.at.z) >= b.size.z / 2 + half ||
          b.center.y - b.size.y / 2 >= d.at.y + W3_DRONE.height ||
          b.center.y + b.size.y / 2 <= d.at.y + 1e-3;
        expect(apart, `${d.at.x},${d.at.z} in ${b.center.x},${b.center.y},${b.center.z}`).toBe(true);
      }
      // Clear of the chamber's gates' way across (z 414..422).
      if (d !== W3_TEST_DRONE) expect(Math.abs(d.at.z - 418)).toBeGreaterThan(4 + half);
    }
  });

  it("stencils the plant's words in the face it has, the accent of Ś over the capitals", () => {
    for (const w of Object.values(W3_WORDS)) expect(paintable(w), w).toBe(true);
    expect(paintable("Q")).toBe(false);
    const caps = Math.max(...letteringRects("SEKTOR W-3", 0.7).map((r) => r.y1));
    expect(caps).toBeCloseTo(0.7, 6);
    expect(Math.max(...letteringRects(W3_WORDS.secret, 0.7).map((r) => r.y1))).toBeCloseTo(0.8, 6);
    const rects = letteringRects(W3_WORDS.plant, 0.36);
    expect(Math.min(...rects.map((r) => r.x0))).toBeCloseTo(-letteringWidth(W3_WORDS.plant, 0.36) / 2, 6);
    // On the airlocks' wall between the gate's frame and row N (z 423.1..430).
    expect(letteringWidth(W3_WORDS.plant, 0.36)).toBeLessThan(430 - 423.1);
  });

  it("makes steam and sparks on High only: sparks by the line's moving arms, none by a blown station", () => {
    const low = { particles: false, inRange: true, near: true, interior: true, moving: true };
    expect(w3FxPlan(low)).toEqual({ steam: null, sparks: false, lights: false });
    expect(w3FxPlan({ ...low, particles: true })).toEqual({ steam: "inside", sparks: true, lights: false });
    expect(w3FxPlan({ ...low, particles: true, interior: false, near: false })).toEqual({ steam: "outside", sparks: false, lights: true });
    expect(w3FxPlan({ ...low, particles: true, inRange: false, near: false, interior: false })).toEqual({ steam: null, sparks: false, lights: false });
    expect(w3SparkPoints()).toHaveLength(8);
    expect(w3SparkPoints(["S2"]).every((p) => !(p.z < 418 && Math.abs(p.x - 2537) < 5.5))).toBe(true);
    expect(w3SparkPoints(["S2"]).length).toBeLessThan(8);
  });

  it("starts its particle systems on High near the hall, none on low, and the floodlights only outside", () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const kit = new CityKit(scene, materials, null, kitData, { labels: false });
    const eye = { ...w3(2462, 3.5, 421) };
    const view = (particles: boolean) => new W3View({ scene, materials, kit: () => kit, city: () => true, eye: () => eye, still: !particles, particles });
    const flood = () => materials.light(`${W3_FLOOD_PREFIX}neon`) !== undefined;
    const lowView = view(false);
    lowView.update(1 / 60, false);
    // The view bakes the dress into its inside mesh (and its outer one) when it builds them.
    const baked = w3InsideGeometry(kitData);
    w3Dress(kitData, baked);
    expect(lowView.stats.insideTriangles).toBe(tris(baked.inside));
    expect(lowView.fx.systems).toHaveLength(0);
    expect(flood()).toBe(true);
    Object.assign(eye, w3(2520, 1.6, 418));
    for (let i = 0; i < 3; i++) lowView.update(1 / 60, false);
    expect(lowView.fx.systems).toHaveLength(0);
    expect(lowView.interior).toBe(true);
    expect(flood()).toBe(false);
    const high = new W3Fx(scene, materials, true);
    high.update(1 / 60, { inRange: true, near: true, interior: true, moving: true, wrecks: [] });
    expect(high.systems.map((s) => s.name).sort()).toEqual(["w3-sparks", "w3-steam"]);
    expect(high.emitting).toEqual(["w3-sparks", "w3-steam"]);
    // Out of the hall onto the yard: the steam goes on outside, the sparks stop; far off, nothing.
    high.update(1 / 60, { inRange: true, near: false, interior: false, moving: true, wrecks: [] });
    expect(high.emitting).toEqual(["w3-steam"]);
    expect(high.plan.steam).toBe("outside");
    high.update(1 / 60, { inRange: false, near: false, interior: false, moving: true, wrecks: [] });
    expect(high.emitting).toEqual([]);
    high.dispose();
  });
});
