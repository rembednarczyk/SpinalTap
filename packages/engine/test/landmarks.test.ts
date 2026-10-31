import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { type SceneryItem, WORLD_SCENERY, groundY } from "@seki/sim";
import { LUBLIN_CHUNKS, type LublinBuildingData } from "@seki/sim/lublin";
import { describe, expect, it } from "vitest";
import { RawTexture, Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { DRESS_FLAG, MeshSink } from "../src/renderer/mesh-sink";
import { type FacadeFrame, facadeFrame } from "../src/renderer/mapcity/facade-frame";
import { planNearBuilding } from "../src/renderer/mapcity/facade-plan";
import { ROOF_STYLE } from "../src/renderer/mapcity/facade-style";
import { type LandmarkFrame, landmarkAt, planFarLandmark, planLandmarkSigns, planNearLandmark, withLandmark } from "../src/renderer/mapcity/landmarks";
import { mapBuilding } from "../src/renderer/mapcity/map-building";
import { MapCity, type MapView } from "../src/renderer/mapcity/map-city";
import { type P2, cleanRing, pointInRing } from "../src/renderer/mapcity/polygon";
import { MAP_SIGN_KIND } from "../src/renderer/mapcity/sign-plan";

/**
 * Brama Krakowska from the landmark kit (ADR-0062, stage 1): the recipe's detail stays in the
 * solid the map data gives (up to a cornice), replaces the tenements' windows, roofs and towers,
 * leaves the gate's passage open under its vault and has a smaller far version.
 */

const data = (id: string): LublinBuildingData => LUBLIN_CHUNKS.flatMap((c) => c.buildings).find((b) => b.id === id)!;
const GATE = ["r7224409", "w617597407", "w617878341"] as const;

/** The views the simulation hands the renderer: the scenery of the map buildings, passages included. */
const scenery = (b: LublinBuildingData): SceneryItem & { view: MapView } => {
  const s = WORLD_SCENERY.find((i) => i.view.kind === "building" && Math.abs(i.at.x - b.x) < 1e-6 && Math.abs(i.at.z - b.z) < 1e-6 && i.view.outline.length === b.outline.length / 2);
  return s as SceneryItem & { view: MapView };
};

const ringOf = (s: SceneryItem): P2[] => (s.view.kind === "building" ? cleanRing(s.view.outline.map((p) => ({ x: p.x + s.at.x, z: p.z + s.at.z }))) : []);

/** Every building of the data within 40 m of the gate, for the walls' neighbours. */
const near = LUBLIN_CHUNKS.flatMap((c) => c.buildings).filter((b) => Math.hypot(b.x - 472.6, b.z + 91.2) < 40);
const items = near.map((b, i) => ({ id: i + 1, b, s: scenery(b) })).filter((e) => e.s);
const neighbour = (x: number, z: number, self: number): number | null => {
  let top: number | null = null;
  for (const e of items) if (e.id !== self && pointInRing({ x, z }, ringOf(e.s))) top = Math.max(top ?? -Infinity, e.s.at.y + (e.s.view.kind === "building" ? e.s.view.height : 0));
  return top;
};

/** The facade frame of a building of the gate, plain or as the landmark's. */
const frameOf = (id: string, recipe = true): FacadeFrame => {
  const e = items.find((i) => i.b.id === id)!;
  const view = e.s.view as Extract<MapView, { kind: "building" }>;
  const f = facadeFrame(mapBuilding(e.id, { ring: ringOf(e.s), view, at: e.s.at }, groundY), neighbour);
  return recipe ? withLandmark(f, landmarkAt(e.s.at.x, e.s.at.z, view.outline.length)) : f;
};

const near3 = (f: FacadeFrame): MeshSink => {
  const sink = new MeshSink();
  planNearLandmark(sink, f as LandmarkFrame);
  return sink;
};

const points = (sink: MeshSink) => Array.from({ length: sink.vertexCount }, (_, i) => ({ x: sink.positions[i * 3]!, y: sink.positions[i * 3 + 1]!, z: sink.positions[i * 3 + 2]!, u2: sink.uvs2[i * 2]!, v2: sink.uvs2[i * 2 + 1]!, a: sink.colors[i * 4 + 3]! }));

/** Distance from a point outside the ring to its nearest edge (0 inside). */
const outside = (r: readonly P2[], p: P2): number => {
  if (pointInRing(p, r)) return 0;
  let best = Infinity;
  for (let i = 0; i < r.length; i++) {
    const a = r[i]!;
    const b = r[(i + 1) % r.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t));
  }
  return best;
};

/** Whether the segment p..q crosses any triangle of the sink (Möller–Trumbore). */
const crosses = (sink: MeshSink, p: { x: number; y: number; z: number }, q: { x: number; y: number; z: number }): boolean => {
  const P = sink.positions;
  const d = { x: q.x - p.x, y: q.y - p.y, z: q.z - p.z };
  for (let t = 0; t < sink.indices.length; t += 3) {
    const v = [0, 1, 2].map((k) => sink.indices[t + k]! * 3).map((i) => ({ x: P[i]!, y: P[i + 1]!, z: P[i + 2]! }));
    const [a, b, c] = v as [typeof p, typeof p, typeof p];
    const e1 = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const e2 = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    const h = { x: d.y * e2.z - d.z * e2.y, y: d.z * e2.x - d.x * e2.z, z: d.x * e2.y - d.y * e2.x };
    const det = e1.x * h.x + e1.y * h.y + e1.z * h.z;
    if (Math.abs(det) < 1e-12) continue;
    const s = { x: p.x - a.x, y: p.y - a.y, z: p.z - a.z };
    const u = (s.x * h.x + s.y * h.y + s.z * h.z) / det;
    const qv = { x: s.y * e1.z - s.z * e1.y, y: s.z * e1.x - s.x * e1.z, z: s.x * e1.y - s.y * e1.x };
    const w = (d.x * qv.x + d.y * qv.y + d.z * qv.z) / det;
    const k = (e2.x * qv.x + e2.y * qv.y + e2.z * qv.z) / det;
    if (u >= 0 && w >= 0 && u + w <= 1 && k > 0 && k < 1) return true;
  }
  return false;
};

describe("Brama Krakowska from the landmark kit (ADR-0062)", () => {
  it("finds its recipe by the data's position for the gate, its tower and octagon, and for no other building", () => {
    for (const id of GATE) {
      const b = data(id);
      expect(landmarkAt(b.x, b.z, b.outline.length / 2)?.part.osm).toBe(id);
    }
    const jezuicka = data("w66286384");
    expect(landmarkAt(jezuicka.x, jezuicka.z, jezuicka.outline.length / 2)).toBeNull();
    expect(near.filter((b) => landmarkAt(b.x, b.z, b.outline.length / 2)).length).toBe(GATE.length);
  });

  it("keeps every part within its outline (a cornice's depth) and between its foot and the data's top and roof", () => {
    for (const id of GATE) {
      const f = frameOf(id);
      const roof = f.b.roof ?? 0;
      const peak = f.top + (id === "r7224409" ? 0.06 : roof);
      const pts = points(near3(f));
      // The passage's lining reaches under its floor, which the street outside sets.
      const foot = Math.min(f.b.foot, ...(f.b.passages ?? []).flatMap((p) => p.floor));
      expect(pts.length).toBeGreaterThan(100);
      for (const p of pts) {
        expect(outside(f.b.ring, p)).toBeLessThan(0.6);
        expect(p.y).toBeGreaterThan(foot - 0.45);
        expect(p.y).toBeLessThanOrEqual(peak + 1e-6);
      }
      // The helmet fills the data's roof: its mast's warning light is the gate's peak.
      if (id === "w617878341") expect(Math.max(...pts.map((p) => p.y))).toBeGreaterThan(peak - 0.05);
    }
  });

  it("gives no part the window grid, a tiled roof, a superstructure or procedural towers", () => {
    for (const id of GATE) {
      const plain = new MeshSink();
      planNearBuilding(plain, frameOf(id, false));
      const kit = points(near3(frameOf(id)));
      // Walls with storeys and bays (windows) carry uv2.x > 0; roofs the roof style.
      expect(kit.every((p) => p.u2 === 0)).toBe(true);
      expect(kit.every((p) => p.v2 < ROOF_STYLE)).toBe(true);
      expect(points(plain).some((p) => p.u2 > 0 || p.v2 >= ROOF_STYLE)).toBe(true);
    }
  });

  it("leaves the passage open from mouth to mouth under the vault's springing and up to its crown on the axis", () => {
    const f = frameOf("r7224409");
    const p = f.b.passages![0]!;
    const sink = near3(f);
    const dx = p.to.x - p.from.x;
    const dz = p.to.z - p.from.z;
    const len = Math.hypot(dx, dz);
    const across = { x: -dz / len, z: dx / len };
    const floor = Math.max(p.floor[0], p.floor[1]);
    for (const s of [-0.8, 0, 0.8].map((k) => (k * p.width) / 2)) {
      for (const y of [floor + 0.3, (floor + p.spring) / 2, p.spring - 0.1, ...(s === 0 ? [p.crown - 0.15] : [])]) {
        const a = { x: p.from.x + across.x * s, y, z: p.from.z + across.z * s };
        const b = { x: p.to.x + across.x * s, y, z: p.to.z + across.z * s };
        expect(crosses(sink, a, b), `blocked at s ${s.toFixed(2)}, y ${y.toFixed(2)}`).toBe(false);
      }
    }
    // The crown is the one from `sites.ts`: 4.2 m over the higher floor.
    expect(p.crown - floor).toBeCloseTo(4.2, 6);
  });

  it("has a smaller far version with the solid, the helmet and the lit elements", () => {
    for (const id of GATE) {
      const f = frameOf(id) as LandmarkFrame;
      const far = new MeshSink();
      planFarLandmark(far, f);
      expect(far.vertexCount).toBeGreaterThan(0);
      expect(far.vertexCount).toBeLessThan(near3(f).vertexCount);
      if (id === "w617878341") expect(points(far).some((p) => p.a === DRESS_FLAG.lit && p.y > f.top + 1)).toBe(true);
    }
  });

  it("puts the museum's plaque and the screen on the gate's west front, the holo clock on the octagon", () => {
    const slots: string[] = [];
    const slot = (name: string) => slots.push(name) - 1;
    const signs = new MeshSink();
    planLandmarkSigns(signs, frameOf("r7224409") as LandmarkFrame, slot);
    planLandmarkSigns(signs, frameOf("w617878341") as LandmarkFrame, slot);
    expect(slots).toEqual(["STARE MIASTO 旧市街", "Muzeum Historii Miasta Lublina"]);
    const kinds = new Set(points(signs).map((p) => Math.round(p.v2)));
    for (const k of [MAP_SIGN_KIND.name, MAP_SIGN_KIND.holo, MAP_SIGN_KIND.beam, MAP_SIGN_KIND.strobe]) expect(kinds.has(k)).toBe(true);
    // The names hang on the west (Krakowskie Przedmieście) side of the gate.
    const names = points(signs).filter((p) => Math.round(p.v2) === MAP_SIGN_KIND.name);
    expect(Math.max(...names.map((p) => p.x))).toBeLessThan(466);
  });

  it("draws the gate from its recipe in the map city: no tiled roof over the octagon", () => {
    const scene = new Scene(new NullEngine());
    const city = new MapCity({ scene, materials: new ToonMaterials(scene), shadow: null, quality: "high", signAtlas: RawTexture.CreateRGBATexture(new Uint8Array(4), 1, 1, scene) });
    for (const e of items) city.spawn(e.id, e.s.view, e.s.at);
    city.flush();
    for (let k = 0; k < 20; k++) city.update(1 / 60, { x: 472, y: 2, z: -91 }, false);
    const octagon = ringOf(items.find((i) => i.b.id === "w617878341")!.s);
    const top = data("w617878341").y + data("w617878341").height;
    const meshes = city.meshes.filter((m) => m.name.startsWith("map-near"));
    expect(meshes.length).toBeGreaterThan(0);
    let helm = 0;
    for (const m of meshes) {
      const pos = m.getVerticesData("position")!;
      const uv2 = m.getVerticesData("uv2")!;
      for (let i = 0; i < pos.length / 3; i++) {
        if (pos[i * 3 + 1]! < top + 0.5 || !pointInRing({ x: pos[i * 3]!, z: pos[i * 3 + 2]! }, octagon)) continue;
        helm++;
        expect(uv2[i * 2 + 1]!).toBeLessThan(ROOF_STYLE);
      }
    }
    expect(helm).toBeGreaterThan(50);
  });
});
