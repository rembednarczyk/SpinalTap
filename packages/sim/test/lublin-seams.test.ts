import { describe, expect, it } from "vitest";
import { type TerrainGrid, terrainHeightAt } from "@seki/core";
import { MAP_CHUNKS } from "../src/content/lublin/sites";
import { SHAPED_TERRAIN } from "../src/content/lublin/terrain";
import { stitchSeams } from "../src/content/lublin/seams";

/**
 * The game's terrain meets at the chunks' seams (ADR-0043, G-748): the arcade of the Arkady had
 * the 4 m grid of krakowskie-2-1 3.3 m under the 2.5 m one of stare-miasto-0-1 along x = 460, and
 * the import's grids of different cells were up to 0.4 m apart on eleven other seams.
 */

type Bounds = (typeof MAP_CHUNKS)[number]["bounds"];
interface Side {
  readonly a: string;
  readonly b: string;
  /** The points along the seam, every 0.25 m. */
  readonly at: readonly { readonly x: number; readonly z: number }[];
}

/** The seams of the chunks' rectangles, found here and not by the code under test. */
const seams = (chunks: readonly { readonly id: string; readonly bounds: Bounds }[]): Side[] => {
  const out: Side[] = [];
  for (const [i, p] of chunks.entries()) {
    for (const q of chunks.slice(i + 1)) {
      const [a, b] = [p.bounds, q.bounds];
      const at: { x: number; z: number }[] = [];
      const x = a.maxX === b.minX ? a.maxX : a.minX === b.maxX ? a.minX : null;
      const z = a.maxZ === b.minZ ? a.maxZ : a.minZ === b.maxZ ? a.minZ : null;
      if (x !== null) for (let t = Math.max(a.minZ, b.minZ); t <= Math.min(a.maxZ, b.maxZ); t += 0.25) at.push({ x, z: t });
      if (z !== null) for (let t = Math.max(a.minX, b.minX); t <= Math.min(a.maxX, b.maxX); t += 0.25) at.push({ x: t, z });
      if (at.length > 1) out.push({ a: p.id, b: q.id, at });
    }
  }
  return out;
};

const grid = (id: string): TerrainGrid => SHAPED_TERRAIN.get(id)!;
const divides = (fine: number, coarse: number) => Math.abs(coarse / fine - Math.round(coarse / fine)) < 1e-9;
const onGrid = (g: TerrainGrid, p: { x: number; z: number }) => divides(g.cell, p.x - g.originX) && divides(g.cell, p.z - g.originZ);

describe("the terrain of the game's Lublin at the chunks' seams", () => {
  const all = seams(MAP_CHUNKS);

  it("finds the seams of the map", () => {
    expect(all.length).toBeGreaterThanOrEqual(15);
    expect(all.some((s) => s.a === "krakowskie-2-1" && s.b === "stare-miasto-0-1")).toBe(true);
  });

  it("meets along every seam whose one grid's cell is a multiple of the other's (within 0.05 m)", () => {
    const gaps: string[] = [];
    for (const s of all) {
      const [ga, gb] = [grid(s.a), grid(s.b)];
      if (!divides(Math.min(ga.cell, gb.cell), Math.max(ga.cell, gb.cell))) continue;
      const worst = Math.max(...s.at.map((p) => Math.abs(terrainHeightAt(ga, p.x, p.z) - terrainHeightAt(gb, p.x, p.z))));
      if (worst > 0.05) gaps.push(`${s.a} | ${s.b} ${worst.toFixed(2)}`);
    }
    expect(gaps).toEqual([]);
  });

  it("has the finer grid's points on every seam on the coarser grid's surface", () => {
    const off: string[] = [];
    for (const s of all) {
      const [ga, gb] = [grid(s.a), grid(s.b)];
      if (ga.cell === gb.cell) continue;
      const [fine, coarse] = ga.cell < gb.cell ? [ga, gb] : [gb, ga];
      for (const p of s.at.filter((q) => onGrid(fine, q))) {
        const d = Math.abs(terrainHeightAt(fine, p.x, p.z) - terrainHeightAt(coarse, p.x, p.z));
        if (d > 1e-6) off.push(`${s.a} | ${s.b} (${p.x}; ${p.z}) ${d.toFixed(2)}`);
      }
    }
    expect(off).toEqual([]);
  });

  it("leaves no ledge under the arcade of the Arkady along x = 460 at the 2.5 m grid's points (G-748)", () => {
    const [k, s] = [grid("krakowskie-2-1"), grid("stare-miasto-0-1")];
    for (let z = 100; z <= 130; z += 2.5) expect(terrainHeightAt(s, 460, z), `z ${z}`).toBeCloseTo(terrainHeightAt(k, 460, z), 6);
  });
});

describe("stitching the seams", () => {
  const bounds = (minX: number, maxX: number) => ({ minX, maxX, minZ: 0, maxZ: 20 });
  const of = (originX: number, cell: number, cols: number, rows: number, f: (x: number, z: number) => number): TerrainGrid => {
    const heights: number[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) heights.push(f(originX + c * cell, r * cell));
    return { originX, originZ: 0, cell, cols, rows, heights };
  };
  const chunks = [
    { id: "west", bounds: bounds(0, 20) },
    { id: "east", bounds: bounds(20, 40) },
  ];

  it("puts the finer grid's seam on the coarser one's, the first in the table or not, and leaves the rest", () => {
    const coarse = of(0, 5, 5, 5, (x, z) => z * 0.3);
    const fine = of(20, 2.5, 9, 9, (x, z) => z * 0.3 + Math.sin(z) * 0.4 + x * 0.01);
    for (const order of [chunks, [...chunks].reverse()]) {
      const out = stitchSeams(order, new Map([["west", coarse], ["east", fine]]));
      for (let z = 0; z <= 20; z += 0.25) expect(terrainHeightAt(out.get("east")!, 20, z)).toBeCloseTo(terrainHeightAt(coarse, 20, z), 9);
      expect(out.get("west")!.heights).toEqual(coarse.heights);
      expect(out.get("east")!.heights[1]).toBe(fine.heights[1]);
    }
  });

  it("meets round a corner of four grids (10, 5 and 2.5 m) whatever the table's order", () => {
    const f = (x: number, z: number) => Math.sin(x * 0.3) + Math.cos(z * 0.21) * 2;
    const at = (minX: number, minZ: number) => ({ minX, maxX: minX + 20, minZ, maxZ: minZ + 20 });
    const square = (x0: number, z0: number, cell: number, lift: number): TerrainGrid => {
      const g = of(x0, cell, 20 / cell + 1, 20 / cell + 1, (x, z) => f(x, z + z0) + lift);
      return { ...g, originZ: z0 };
    };
    const grids = new Map([
      ["sw", square(0, 0, 10, 0.3)],
      ["se", square(20, 0, 5, -0.2)],
      ["nw", square(0, 20, 2.5, 0.1)],
      ["ne", square(20, 20, 2.5, 0)],
    ]);
    const four = [
      { id: "sw", bounds: at(0, 0) },
      { id: "se", bounds: at(20, 0) },
      { id: "nw", bounds: at(0, 20) },
      { id: "ne", bounds: at(20, 20) },
    ];
    const orders = (a: typeof four): (typeof four)[] => (a.length <= 1 ? [a] : a.flatMap((c, i) => orders([...a.slice(0, i), ...a.slice(i + 1)]).map((o) => [c, ...o])));
    const sides = [["sw", "se", 20, 0, "x"], ["nw", "ne", 20, 20, "x"], ["sw", "nw", 0, 20, "z"], ["se", "ne", 20, 20, "z"]] as const;
    for (const order of orders(four)) {
      const out = stitchSeams(order, grids);
      for (const [p, q, x0, z0, fixed] of sides) {
        for (let t = 0; t <= 20; t += 0.25) {
          const [x, z] = fixed === "x" ? [x0, z0 + t] : [x0 + t, z0];
          expect(terrainHeightAt(out.get(p)!, x, z), `${order.map((c) => c.id).join(",")} ${p}|${q} (${x}; ${z})`).toBeCloseTo(terrainHeightAt(out.get(q)!, x, z), 9);
        }
      }
      expect(out.get("sw")!.heights).toEqual(grids.get("sw")!.heights);
    }
  });

  it("between grids of one cell gives the seam to the first chunk in the table", () => {
    const [w, e] = [of(0, 5, 5, 5, () => 1), of(20, 5, 5, 5, () => 2)];
    const out = stitchSeams(chunks, new Map([["west", w], ["east", e]]));
    expect(out.get("east")!.heights[0]).toBe(1);
    expect(out.get("west")!.heights[4]).toBe(1);
  });
});
