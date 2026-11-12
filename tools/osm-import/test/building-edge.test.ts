import { describe, expect, it } from "vitest";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { LUBLIN_CHUNKS } from "../../../packages/sim/src/content/lublin";
import { MIN_EDGE_DEPTH, edgeDepth, piecesInRect } from "../src/building-edge.ts";
import { ALL_CHUNKS } from "../src/config.ts";
import { generate } from "../src/generate.ts";
import { type Pt, signedArea } from "../src/geometry.ts";
import { parseOsmXml } from "../src/osm.ts";
import { worldToGeo } from "../src/project.ts";

const pts = (xz: readonly number[]): Pt[] => Array.from({ length: xz.length / 2 }, (_, k) => ({ x: xz[2 * k]!, z: xz[2 * k + 1]! }));

/** A building of the map from x0 to x1 (the west edge of Krakowskie is x = -200), z from 100 to z1. */
const edgeMap = (x0: number, x1: number, z1: number, tags: string) => {
  const ring = [
    [x0, 100],
    [x1, 100],
    [x1, z1],
    [x0, z1],
  ];
  const nodes = ring.map(([x, z], k) => {
    const g = worldToGeo({ x: x!, z: z! });
    return ` <node id="${k + 1}" lat="${g.lat}" lon="${g.lon}"/>`;
  });
  return parseOsmXml(["<osm>", ...nodes, ` <way id="100"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/>${tags}</way>`, "</osm>"].join("\n"));
};
const krakowskie01 = () => [ALL_CHUNKS.find((c) => c.id === "krakowskie-0-1")!];

describe("buildings across the map's edge (G-556)", () => {
  it("cuts a building centred off the map at its edge instead of dropping it, as tall as it is", () => {
    // Centred off the map, 6 m of its 16 on it.
    const [c] = generate(edgeMap(-210, -194, 110, '<tag k="building" v="house"/><tag k="building:levels" v="2"/>'), () => 200, krakowskie01()).chunks;
    const b = c!.buildings.find((x) => x.id === "w100");
    expect(b).toBeDefined();
    const world = pts(b!.outline).map((p) => ({ x: p.x + b!.x, z: p.z + b!.z }));
    expect(Math.min(...world.map((p) => p.x))).toBeCloseTo(-200, 1);
    expect(Math.max(...world.map((p) => p.x))).toBeCloseTo(-194, 1);
    expect(signedArea(world)).toBeCloseTo(60, 0);
    expect(b!.levels).toBe(2);
  });

  it("gives a building cut at the edge the storeys of the whole building, not of its piece on the map", () => {
    // 128 m² in all, 16 m² on the map: a house of three or four storeys by Krakowskie's default, not a shed.
    const [c] = generate(edgeMap(-228, -196, 104, '<tag k="building" v="yes"/>'), () => 200, krakowskie01()).chunks;
    const b = c!.buildings.find((x) => x.id === "w100");
    expect(b?.levels).toBeGreaterThanOrEqual(3);
  });

  it("leaves a building whose piece on the map is a slab under 3 m deep off it, with the rest of it (decision 8.11)", () => {
    // 2 m of 16 on the map: Probostwo 7 and Pałac Morskich were such slabs.
    const [c] = generate(edgeMap(-214, -198, 110, '<tag k="building" v="house"/>'), () => 200, krakowskie01()).chunks;
    expect(c!.buildings.find((x) => x.id === "w100")).toBeUndefined();
    const ring = pts([-214, 100, -198, 100, -198, 110, -214, 110]);
    const rect = { minX: -200, minZ: -270, maxX: 460, maxZ: 160 };
    expect(edgeDepth(ring, piecesInRect(ring, rect)[0]!, rect)).toBeCloseTo(2, 5);
    expect(MIN_EDGE_DEPTH).toBe(3);
  });

  it("closes each piece of a ring leaving the rectangle and coming back on its own, without a corridor along the edge", () => {
    // A U open to the south over the edge z = 0: its two legs are on the rectangle, the bottom off it.
    const u = pts([0, -10, 30, -10, 30, 10, 20, 10, 20, -5, 10, -5, 10, 10, 0, 10]);
    const pieces = piecesInRect(u, { minX: -100, minZ: 0, maxX: 100, maxZ: 100 });
    expect(pieces).toHaveLength(2);
    expect(pieces.map((p) => signedArea(p)).sort()).toEqual([100, 100]);
    for (const p of pieces) for (const q of p) expect(q.x <= 10 || q.x >= 20).toBe(true);
    expect(piecesInRect(u, { minX: 100, minZ: 0, maxX: 200, maxZ: 100 })).toEqual([]);
    expect(piecesInRect(u, { minX: -100, minZ: -100, maxX: 100, maxZ: 100 })).toHaveLength(1);
  });

  it("keeps Cicha 3, 5, 6 and 8 in krakowskie-0-1, once in the city, inside the map", () => {
    const chunk = KRAKOWSKIE_CHUNKS.find((c) => c.id === "krakowskie-0-1")!;
    for (const id of ["w55897062", "w55897063", "w55897094", "w55897093"]) {
      const b = chunk.buildings.find((x) => x.id === id);
      expect(b, id).toBeDefined();
      expect(LUBLIN_CHUNKS.flatMap((c) => c.buildings).filter((x) => x.id === id)).toHaveLength(1);
      for (const p of pts(b!.outline)) expect(p.x + b!.x, id).toBeGreaterThanOrEqual(chunk.bounds.minX - 0.05);
    }
  });
});
