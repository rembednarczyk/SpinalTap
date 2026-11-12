import { describe, expect, it } from "vitest";
import { type MapBuilding, facadeFrame, hiddenWall } from "../src/renderer/mapcity/facade-frame";
import { cleanRing } from "../src/renderer/mapcity/polygon";
import { LUBLIN_CHUNKS } from "../../sim/src/content/lublin";
import { TerrainEntries, type TerrainEntry } from "../src/renderer/mapcity/terrain-index";

/** A level terrain at (x, 0), 100 m square. */
const level = (x: number): TerrainEntry => ({
  grid: { originX: x, originZ: 0, cell: 100, cols: 2, rows: 2, heights: [0, 0, 0, 0] },
  open: undefined,
  bounds: { minX: x, maxX: x + 100, minZ: 0, maxZ: 100 },
  mesh: null,
});

/** Two terrains side by side, from x 0 to 200: the map's edge runs round them, not between them. */
const westEdge = (): TerrainEntries => {
  const t = new TerrainEntries();
  t.set(1, level(0));
  t.set(2, level(100));
  return t;
};

/** A house cut by the importer at the map's edge x = 0 (G-556), its west wall on it to 0.1 m. */
const cutHouse: MapBuilding = {
  id: 7,
  ring: cleanRing([
    { x: 0.1, z: 40 },
    { x: 12, z: 40 },
    { x: 12, z: 52 },
    { x: -0.05, z: 52 },
  ]),
  base: 0,
  foot: 0,
  height: 13,
  levels: 4,
  use: "residential",
  look: 1241,
};

describe("a wall on the map's edge (G-556)", () => {
  it("is found on a side of a terrain with no terrain past it, not inside one or between two", () => {
    const t = westEdge();
    expect(t.onMapEdge({ x: 0.1, z: 40 }, { x: -0.05, z: 52 })).toBe(true);
    expect(t.onMapEdge({ x: 5, z: 40 }, { x: 5, z: 52 })).toBe(false);
    expect(t.onMapEdge({ x: 100, z: 40 }, { x: 100, z: 52 })).toBe(false);
    expect(t.onMapEdge({ x: 0, z: 90 }, { x: 0, z: 120 })).toBe(false);
  });

  it("stands blind and drawn whole: no windows, no signs, and nothing past it hides it", () => {
    const t = westEdge();
    const f = facadeFrame(cutHouse, () => null, () => null, (a, c) => t.onMapEdge(a, c));
    const edge = f.walls.filter((w) => Math.max(w.a.x, w.b.x) < 1);
    expect(edge).toHaveLength(1);
    expect(edge[0]).toMatchObject({ blind: true, bay: 0, edge: true });
    expect(hiddenWall(f, edge[0]!)).toBe(false);
    for (const w of f.walls.filter((x) => x !== edge[0])) expect(w.blind).toBe(false);
    // Without the map's edge the same wall has windows, as before.
    expect(facadeFrame(cutHouse, () => null).walls.every((w) => !w.blind && w.bay > 0)).toBe(true);
  });

  it("finds the cut walls of Lublin on its edge: Pałac Ordynacki's south (z -240), Cicha 8's west (x -200), and no wall of a whole building", () => {
    const t = new TerrainEntries();
    LUBLIN_CHUNKS.forEach((c, i) => t.set(i + 1, { grid: c.terrain, open: undefined, bounds: c.bounds, mesh: null }));
    const edgeWalls = (id: string) => {
      const b = LUBLIN_CHUNKS.flatMap((c) => c.buildings).find((x) => x.id === id)!;
      const ring = Array.from({ length: b.outline.length / 2 }, (_, k) => ({ x: b.x + b.outline[2 * k]!, z: b.z + b.outline[2 * k + 1]! }));
      return ring.flatMap((a, k) => (t.onMapEdge(a, ring[(k + 1) % ring.length]!) ? [[a, ring[(k + 1) % ring.length]!]] : []));
    };
    expect(edgeWalls("w66335239").map(([a, c]) => [a!.z, c!.z])).toEqual([[-240, -240]]);
    expect(edgeWalls("w55897093").map(([a, c]) => [a!.x, c!.x])).toEqual([[-200, -200]]);
    // The Brigittines' church, whole in Krakowskie: no wall on the edge.
    expect(edgeWalls("w66264082")).toEqual([]);
    // Only the 38 buildings the importer cut there (G-556) have one.
    expect(LUBLIN_CHUNKS.flatMap((c) => c.buildings).filter((b) => edgeWalls(b.id).length > 0)).toHaveLength(38);
  });
});
