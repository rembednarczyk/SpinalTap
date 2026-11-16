import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { GroundSurface, Vec3 } from "@seki/core";
import { describe, expect, it } from "vitest";
import { RawTexture, Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { planGround } from "../src/renderer/mapcity/cell-ground";
import { cellsMeeting } from "../src/renderer/mapcity/ground-plan";
import { cutGround } from "../src/renderer/mapcity/ground-cut";
import { MapCity } from "../src/renderer/mapcity/map-city";
import { MapEntries } from "../src/renderer/mapcity/map-entries";
import { type P2, boundsOf } from "../src/renderer/mapcity/polygon";
import { MeshSink } from "../src/renderer/mesh-sink";
import { FLOOR_MARKINGS, FLOOR_PIECES, FLOOR_SCAN, FLOOR_SHAFTS, FLOOR_TERRAINS } from "./fixtures/ground-floor";

/**
 * The ground the map city lays, bit for bit (G-444): the drape and its cuts were made cheaper
 * without moving a vertex. A hash of every number of the ground and water meshes of a test floor
 * of its own (`fixtures/ground-floor.ts`: paving over paving, kerbs, shafts, the river, steps, a
 * footbridge) and of a small world with a bridge's deck, laid whole and in the cells the glitch
 * scan asks for. Neither reads the map's tables, so a change of Lublin's content moves neither
 * hash; a change of the rules of laying the ground does (ADR-0088). `pnpm hashes:check` never
 * writes them: by hand (`vitest -u` or an edit), with the rule named in the commit.
 */

/** FNV-1a over the bits of the doubles: a change in the last bit of one changes it. */
const hasher = () => {
  let h = 0x811c9dc5;
  const f = new Float64Array(1);
  const w = new Uint32Array(f.buffer);
  return {
    add(values: ArrayLike<number>): void {
      h = Math.imul(h ^ values.length, 0x01000193);
      for (let i = 0; i < values.length; i++) {
        f[0] = values[i] as number;
        h = Math.imul(h ^ (w[0] as number), 0x01000193);
        h = Math.imul(h ^ (w[1] as number), 0x01000193);
      }
    },
    get hex(): string {
      return (h >>> 0).toString(16).padStart(8, "0");
    },
  };
};

const addSink = (hash: ReturnType<typeof hasher>, s: MeshSink): void => {
  for (const a of [s.positions, s.normals, s.colors, s.uvs, s.uvs2, s.indices]) hash.add(a);
};

const rect = (x0: number, z0: number, x1: number, z1: number): P2[] => [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];

type Piece = { readonly surface: GroundSurface; readonly ring: P2[]; readonly deck?: { readonly a: Vec3; readonly b: Vec3 } };

/** A bent terrain of two chunks sharing an edge, under paving of one lift and a road on a low bridge's deck. */
const world = (pieces: readonly Piece[]): MapEntries => {
  const e = new MapEntries();
  for (const [id, originX] of [[1, -10], [2, 20]] as const) {
    const heights: number[] = [];
    for (let k = 0; k < 25; k++) for (let i = 0; i < 13; i++) heights.push(0.05 * (originX + i * 2.5) + 0.02 * k + 0.1 * Math.sin(i * 0.7 + id) * Math.cos(k * 0.5));
    e.terrains.set(id, { grid: { originX, originZ: -10, cell: 2.5, cols: 13, rows: 25, heights }, open: undefined, bounds: { minX: originX, maxX: originX + 30, minZ: -10, maxZ: 50 }, mesh: null });
  }
  pieces.forEach((p, i) => e.addGround(100 + i, { surface: p.surface, ring: p.ring, y: 0, bounds: boundsOf(p.ring), cell: "", ...(p.deck ? { deck: p.deck } : {}) }));
  return e;
};

const PIECES: readonly Piece[] = [
  { surface: "square", ring: rect(0, 0, 30, 30) },
  { surface: "cobble", ring: [{ x: 8.3, z: -4.1 }, { x: 14.6, z: -3.2 }, { x: 19.9, z: 41.7 }, { x: 13.7, z: 42.2 }] },
  { surface: "square", ring: [{ x: 7.3, z: 4.1 }, { x: 21.7, z: 6.3 }, { x: 18.2, z: 19.4 }, { x: 5.1, z: 16.9 }] },
  { surface: "footway", ring: rect(2, 22, 9, 27) },
  { surface: "road", ring: rect(-8, 32, 45, 38) },
  { surface: "sidewalk", ring: rect(-8, 38, 45, 41) },
  { surface: "road", ring: rect(30, -6, 34, 46), deck: { a: { x: 32, y: 2.2, z: -8 }, b: { x: 32, y: 2.6, z: 48 } } },
];

describe("the ground the map city lays (G-444)", () => {
  it("is the same on its test floor, in the city's cells and cut by shafts in the scan's cells", () => {
    const scene = new Scene(new NullEngine());
    const atlas = RawTexture.CreateRGBATexture(new Uint8Array(4), 1, 1, scene);
    const city = new MapCity({ scene, materials: new ToonMaterials(scene), shadow: null, quality: "high", signAtlas: atlas });
    const origin = { x: 0, y: 0, z: 0 };
    let id = 1;
    for (const grid of FLOOR_TERRAINS) city.spawn(id++, { kind: "terrain", grid }, origin);
    for (const p of FLOOR_PIECES) city.spawn(id++, { kind: "ground", surface: p.surface, outline: p.outline, ...(p.deck ? { deck: p.deck } : {}) }, origin);
    for (const m of FLOOR_MARKINGS) city.spawn(id++, { kind: "road-marking", marking: m.marking, line: m.line }, origin);
    city.flush();
    const hash = hasher();
    const meshes = city.meshes.filter((m) => m.name.startsWith("map-ground") || m.name.startsWith("map-water")).sort((a, b) => (a.name < b.name ? -1 : 1));
    let vertices = 0;
    for (const m of meshes) {
      for (const kind of ["position", "normal", "color", "uv", "uv2"]) hash.add(m.getVerticesData(kind) ?? []);
      hash.add(m.getIndices() ?? []);
      vertices += m.getTotalVertices();
    }
    scene.dispose();
    // The same pieces laid one by one, whole and in the cells the glitch scan asks for, the shafts cut out of each.
    const e = new MapEntries();
    FLOOR_TERRAINS.forEach((grid, i) => {
      const bounds = { minX: grid.originX, maxX: grid.originX + (grid.cols - 1) * grid.cell, minZ: grid.originZ, maxZ: grid.originZ + (grid.rows - 1) * grid.cell };
      e.terrains.set(i + 1, { grid, open: undefined, bounds, mesh: null });
    });
    FLOOR_PIECES.forEach((p, i) => e.addGround(100 + i, { surface: p.surface, ring: p.outline, y: 0, bounds: boundsOf(p.outline), cell: "", ...(p.deck ? { deck: p.deck } : {}) }));
    let cut = 0;
    for (const within of [undefined, cellsMeeting(FLOOR_SCAN)]) {
      for (const g of e.grounds.keys()) {
        const ground = new MeshSink();
        const water = new MeshSink();
        planGround(ground, water, e, g, within);
        cutGround(ground, FLOOR_SHAFTS);
        addSink(hash, ground);
        addSink(hash, water);
        cut += (ground.positions.length + water.positions.length) / 3;
      }
    }
    // Moves only with the rules of laying the ground, never with the map's content (ADR-0088): by hand, with the rule in the commit.
    expect({ meshes: meshes.length, vertices, cut, hash: hash.hex }).toEqual({ meshes: 5, vertices: 4381, cut: 6428, hash: "53e83d0b" });
  });

  it("is the same in a small world with a bridge's deck, laid whole and in some cells", () => {
    const e = world(PIECES);
    const hash = hasher();
    for (const within of [undefined, cellsMeeting({ minX: 6, maxX: 21, minZ: 3, maxZ: 36 })]) {
      for (const id of e.grounds.keys()) {
        const ground = new MeshSink();
        const water = new MeshSink();
        planGround(ground, water, e, id, within);
        addSink(hash, ground);
        addSink(hash, water);
      }
    }
    // The paving's and the sidewalks' colours from the orthophoto (G-721, G-734) and the bridge's fascia
    // broken where its underside is (G-743) moved it, not the laying.
    expect(hash.hex).toBe("7a01ecb0");
  });
});
