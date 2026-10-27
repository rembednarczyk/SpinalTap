// @ts-expect-error The engine is typed for the browser; the test reads the kit off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { BlockFront, BlockSkin, Vec3 } from "@seki/core";
import { describe, expect, it } from "vitest";
import { MeshBuilder, Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { CityKit } from "../src/renderer/city-kit";
import { GeometrySink, KIT_TEXTURE, type Placement, addDecor, addSigns, parseCityKit, planSkin, swatchUv, turnXZ } from "../src/renderer/city-kit-data";

const file = (readFileSync as (url: URL) => Uint8Array)(new URL("../../app/public/city/city-kit.glb", import.meta.url));
const data = parseCityKit(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer);

/** World bounding box of a set of placements, from the models' vertices. */
const boundsOf = (placements: readonly Placement[]) => {
  const sink = new GeometrySink();
  for (const p of placements) sink.addModel(data.models.get(p.key)!, p);
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (let i = 0; i < sink.positions.length; i += 3) {
    const [x, y, z] = [sink.positions[i]!, sink.positions[i + 1]!, sink.positions[i + 2]!];
    min.x = Math.min(min.x, x);
    min.y = Math.min(min.y, y);
    min.z = Math.min(min.z, z);
    max.x = Math.max(max.x, x);
    max.y = Math.max(max.y, y);
    max.z = Math.max(max.z, z);
  }
  return { min, max, sink };
};

const FRONTS: readonly BlockFront[] = ["x+", "x-", "z+", "z-"];
const outward: Readonly<Record<BlockFront, Vec3>> = { "x+": { x: 1, y: 0, z: 0 }, "x-": { x: -1, y: 0, z: 0 }, "z+": { x: 0, y: 0, z: 1 }, "z-": { x: 0, y: 0, z: -1 } };

describe("city kit data (ADR-0022)", () => {
  it("parses every model with geometry, its size, roof and styles", () => {
    expect(data.models.size).toBeGreaterThanOrEqual(20);
    for (const m of data.models.values()) {
      expect(m.positions.length).toBeGreaterThan(0);
      expect(m.positions.length).toBe(m.normals.length);
      expect(m.uvs.length / 2).toBe(m.positions.length / 3);
      expect(m.roof).toBeGreaterThan(0);
      expect(m.roof).toBeLessThanOrEqual(m.size.y + 1e-3);
      expect(m.styles.length).toBeGreaterThan(0);
      for (const i of m.indices) expect(i).toBeLessThan(m.positions.length / 3);
    }
    for (const style of ["shop", "bar", "tenement", "tower", "van", "car", "wreck", "dumpster"]) {
      expect([...data.models.values()].some((m) => m.styles.includes(style))).toBe(true);
    }
    expect(data.swatches.find((s) => s.name === "wall")?.kind).toBe("tint");
    expect(data.swatches.find((s) => s.name === "neon-pink")?.kind).toBe("glow");
  });

  it("keeps palette UVs in the palette band of the kit texture", () => {
    const [u, v] = swatchUv(data, "cable");
    expect(u).toBeGreaterThan(0);
    expect(u).toBeLessThan(1);
    expect(v).toBeLessThan(KIT_TEXTURE.paletteHeight / KIT_TEXTURE.height);
  });

  it("turns a model's front (-Z) towards each facing", () => {
    for (const front of FRONTS) {
      const plan = planSkin(data, { style: "van", front }, { x: 3, y: 2, z: 3 }, { x: 0, y: 1, z: 0 })!;
      const [x, z] = turnXZ(0, -1, plan.turn);
      expect(x).toBeCloseTo(outward[front].x, 6);
      expect(z).toBeCloseTo(outward[front].z, 6);
    }
  });

  it("fills a building's collision box exactly, its main roof at the top", () => {
    const size = { x: 14, y: 18, z: 22 };
    const center = { x: 30, y: 9, z: 63 };
    for (const front of FRONTS) {
      for (const style of ["shop", "tenement", "tower", "bar"] as const) {
        const plan = planSkin(data, { style, front }, size, center)!;
        const { min, max } = boundsOf(plan.placements);
        expect(min.x).toBeCloseTo(center.x - size.x / 2, 2);
        expect(max.x).toBeCloseTo(center.x + size.x / 2, 2);
        expect(min.z).toBeCloseTo(center.z - size.z / 2, 2);
        expect(max.z).toBeCloseTo(center.z + size.z / 2, 2);
        expect(min.y).toBeCloseTo(0, 3);
        // Parapets and roof housings may stand above the walkable top.
        expect(max.y).toBeGreaterThanOrEqual(size.y - 1e-3);
        for (const p of plan.placements) expect(p.sy * data.models.get(p.key)!.roof).toBeCloseTo(size.y, 3);
      }
    }
  });

  it("puts the bar's storefront in the front row of a bar block", () => {
    const plan = planSkin(data, { style: "bar", front: "x-" }, { x: 14, y: 10, z: 18 }, { x: 14, y: 5, z: 2 })!;
    expect(plan.placements.some((p) => p.key === "nt-bar")).toBe(true);
  });

  it("fits a vehicle to its box in one piece", () => {
    const size = { x: 6, y: 2.6, z: 2.2 };
    const center = { x: 30, y: 1.3, z: 76.4 };
    const plan = planSkin(data, { style: "van", front: "x+" }, size, center)!;
    expect(plan.placements).toHaveLength(1);
    expect(plan.decor).toHaveLength(0);
    const { min, max } = boundsOf(plan.placements);
    expect(max.x - min.x).toBeCloseTo(6, 2);
    expect(max.z - min.z).toBeCloseTo(2.2, 2);
    expect(max.y - min.y).toBeCloseTo(2.6, 2);
  });

  it("is deterministic per block and varies between blocks", () => {
    const skin: BlockSkin = { style: "tenement", front: "z+", street: 8 };
    const a = planSkin(data, skin, { x: 30, y: 15, z: 22 }, { x: 25, y: 7.5, z: 63 });
    const b = planSkin(data, skin, { x: 30, y: 15, z: 22 }, { x: 25, y: 7.5, z: 63 });
    expect(a).toEqual(b);
    const keys = new Set<string>();
    for (let i = 0; i < 12; i++) for (const p of planSkin(data, skin, { x: 16, y: 10 + i, z: 8 }, { x: 10 + i * 16, y: 5 + i / 2, z: 86 })!.placements) keys.add(p.key);
    expect(keys.size).toBeGreaterThan(2);
  });

  it("hangs decor on the street side and cables across the street", () => {
    const size = { x: 20, y: 16, z: 8 };
    const center = { x: 40, y: 8, z: 86 };
    const plan = planSkin(data, { style: "shop", front: "z-", street: 8 }, size, center)!;
    const sink = new GeometrySink();
    addDecor(sink, data, plan);
    addSigns(sink, plan);
    expect(sink.vertexCount).toBeGreaterThan(0);
    // Facade at z = 82; everything decor sits in front of it (towards -z), cables reach z = 74.
    let minZ = Infinity;
    for (let i = 2; i < sink.positions.length; i += 3) {
      expect(sink.positions[i]!).toBeLessThanOrEqual(82 + 1e-6);
      minZ = Math.min(minZ, sink.positions[i]!);
    }
    if (plan.decor.some((d) => d.kind === "cable")) expect(minZ).toBeLessThan(75);
  });

  it("winds quads clockwise seen from the front, like Babylon's own boxes", () => {
    const sink = new GeometrySink();
    const n = { x: 0, y: 0, z: -1 };
    sink.quad({ x: -1, y: -1, z: 0 }, { x: 1, y: -1, z: 0 }, { x: 1, y: 1, z: 0 }, { x: -1, y: 1, z: 0 }, n, [0, 0]);
    const p = (k: number) => ({ x: sink.positions[k * 3]!, y: sink.positions[k * 3 + 1]!, z: sink.positions[k * 3 + 2]! });
    const [a, b, c] = [p(sink.indices[0]!), p(sink.indices[1]!), p(sink.indices[2]!)];
    const e1 = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const e2 = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    const crossZ = e1.x * e2.y - e1.y * e2.x;
    // Babylon's CreateBox: the cross product of a front face points against its normal.
    expect(Math.sign(crossZ)).toBe(-Math.sign(n.z));
  });
});

describe("CityKit cells", () => {
  const scene = new Scene(new NullEngine());
  const materials = new ToonMaterials(scene);

  it("bakes the blocks of a cell into one mesh, hides their boxes and rebuilds on removal", () => {
    const kit = new CityKit(scene, materials, null, data, { labels: false });
    const boxA = MeshBuilder.CreateBox("a", { size: 1 }, scene);
    const boxB = MeshBuilder.CreateBox("b", { size: 1 }, scene);
    expect(kit.add(1, { style: "shop", front: "z+" }, { x: 16, y: 12, z: 6 }, { x: 76, y: 6, z: 61 }, boxA)).toBe(true);
    expect(kit.add(2, { style: "car", front: "x+" }, { x: 4.4, y: 1.4, z: 2 }, { x: 90, y: 0.7, z: 63 }, boxB)).toBe(true);
    kit.flush();
    expect(kit.meshCount).toBe(1);
    expect(boxA.isVisible).toBe(false);
    expect(boxB.isVisible).toBe(false);
    const mesh = scene.getMeshByName("city-1:0")!;
    expect(mesh.material).toBe(kit.material);
    const verts = mesh.getTotalVertices();
    kit.remove(2);
    kit.flush();
    expect(scene.getMeshByName("city-1:0")!.getTotalVertices()).toBeLessThan(verts);
    kit.remove(1);
    kit.flush();
    expect(kit.meshCount).toBe(0);
    expect(scene.getMeshByName("city-1:0")).toBeNull();
    kit.setDaylight(1);
  });
});
