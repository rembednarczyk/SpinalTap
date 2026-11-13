import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { GroundSurface, Vec3 } from "@seki/core";
import { LUBLIN_CHUNKS, buildingView, groundView, terrainView } from "@seki/sim/lublin";
import { describe, expect, it } from "vitest";
import { RawTexture, Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { planGround } from "../src/renderer/mapcity/cell-ground";
import { cellsMeeting } from "../src/renderer/mapcity/ground-plan";
import { MapCity, type MapView } from "../src/renderer/mapcity/map-city";
import { MapEntries } from "../src/renderer/mapcity/map-entries";
import { type P2, boundsOf } from "../src/renderer/mapcity/polygon";
import { MeshSink } from "../src/renderer/mesh-sink";

/**
 * The ground the map city lays, bit for bit (G-444): the drape and its cuts were made cheaper
 * without moving a vertex. A hash of every number of the ground and water meshes of a few chunks
 * of Lublin (paving over paving, kerbs, the metro's shafts, the river) and of a small world with
 * a bridge's deck, laid whole and in the cells the glitch scan asks for.
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

/** Chunks of each district: Plac Litewski, the Old Town, Podzamcze's squares and the river. */
const CHUNKS = ["krakowskie-1-1", "stare-miasto-1-1", "podzamcze-1-0", "nabrzeze-0-1"];

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
  it("is the same in a few chunks of Lublin", () => {
    const scene = new Scene(new NullEngine());
    const atlas = RawTexture.CreateRGBATexture(new Uint8Array(4), 1, 1, scene);
    const city = new MapCity({ scene, materials: new ToonMaterials(scene), shadow: null, quality: "high", signAtlas: atlas });
    let id = 1;
    for (const c of LUBLIN_CHUNKS.filter((c) => CHUNKS.includes(c.id))) {
      city.spawn(id++, terrainView(c) as MapView, { x: 0, y: 0, z: 0 });
      for (const b of c.buildings) city.spawn(id++, buildingView(b) as MapView, { x: b.x, y: b.y, z: b.z });
      for (const g of c.ground) city.spawn(id++, groundView(g) as MapView, { x: 0, y: 0, z: 0 });
    }
    city.flush();
    const hash = hasher();
    const meshes = city.meshes.filter((m) => m.name.startsWith("map-ground") || m.name.startsWith("map-water")).sort((a, b) => (a.name < b.name ? -1 : 1));
    let vertices = 0;
    for (const m of meshes) {
      for (const kind of ["position", "normal", "color", "uv", "uv2"]) hash.add(m.getVerticesData(kind) ?? []);
      hash.add(m.getIndices() ?? []);
      vertices += m.getTotalVertices();
    }
    // The map's data, not the laying, moved it last: the bare ground of the town's paved places and
    // the compact lawns and yards laid as grass and paving from the orthophoto's cover (ADR-0077 step
    // 1.1), so two cells without a piece of ground before have one now. The laying moved it once:
    // steps at the map's edge read the ground on its side (G-703), and here, with only these four
    // chunks, the flight at (20; 9) on krakowskie-1-1's west side has no terrain past it. The
    // colours moved it alone: the paving's and the sidewalks' from the orthophoto (G-721, G-734), no vertex moved.
    // Two footbridges' decks run on to the top of their banks (G-739): 20 vertices more, the same meshes. The map's
    // data moved it again: the bands along lines buffered with round joins and ends (ADR-0078 step 2),
    // 142 558 vertices before, the arcs a few more; and the ground the paths' loops enclose laid whole from the cover.
    // The kerbs' strips laid from the cover, lawns under the crowns and the specks of green (ADR-0077
    // step 1.2): 151 928 -> 168 499 vertices, the same meshes.
    // The gaps' patches in the joints (G-760), pieces of their own: 168 499 vertices before.
    expect({ meshes: meshes.length, vertices, hash: hash.hex }).toEqual({ meshes: 24, vertices: 171653, hash: "2f66bb82" });
    scene.dispose();
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
