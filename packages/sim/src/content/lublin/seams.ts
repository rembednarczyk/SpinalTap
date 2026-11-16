import { type TerrainGrid, terrainHeightAt } from "@seki/core";

/** A chunk by its id and rectangle. */
export interface SeamChunk {
  readonly id: string;
  readonly bounds: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
}

/** Where two chunks' rectangles meet: the line x (`along` "z") or z (`along` "x") at `at`, from `lo` to `hi` along it. */
export interface Seam {
  readonly a: string;
  readonly b: string;
  readonly along: "x" | "z";
  readonly at: number;
  readonly lo: number;
  readonly hi: number;
}

/** The stretches where the chunks' rectangles meet side by side (a corner alone is none). */
export const chunkSeams = (chunks: readonly SeamChunk[]): Seam[] => {
  const out: Seam[] = [];
  for (let i = 0; i < chunks.length; i++) {
    for (let j = i + 1; j < chunks.length; j++) {
      const [p, q] = [chunks[i]!, chunks[j]!];
      const [a, b] = [p.bounds, q.bounds];
      const [zLo, zHi] = [Math.max(a.minZ, b.minZ), Math.min(a.maxZ, b.maxZ)];
      const [xLo, xHi] = [Math.max(a.minX, b.minX), Math.min(a.maxX, b.maxX)];
      if (zHi > zLo && (a.maxX === b.minX || a.minX === b.maxX)) out.push({ a: p.id, b: q.id, along: "z", at: a.maxX === b.minX ? a.maxX : a.minX, lo: zLo, hi: zHi });
      if (xHi > xLo && (a.maxZ === b.minZ || a.minZ === b.maxZ)) out.push({ a: p.id, b: q.id, along: "x", at: a.maxZ === b.minZ ? a.maxZ : a.minZ, lo: xLo, hi: xHi });
    }
  }
  return out;
};

/**
 * The grids with each seam's points taken from the coarser grid's surface there (ADR-0043: the
 * chunks' terrain meets at their seams). The import samples each chunk's grid on its own cell and
 * the shaping moves each grid's own points, so where the cells differ the finer grid's points
 * between the coarser's lay up to 0.4 m off its surface, and a pad on a point of one grid alone
 * left a ledge of 3.3 m (G-748, the arcade of the Arkady on the 4 m grid by the 2.5 m one). The
 * import's cells are each a multiple of the finer ones (G-758), so the two then meet exactly; a
 * 4 m grid by 5 m and 2.5 m ones met only every 20 m and kept ledges of up to 0.51 m. The coarsest
 * owners go first, so the points a seam reads are already set where a coarser seam sets them;
 * between grids of one cell the first in the table owns the seam, as it owns the ground on it
 * (`groundY`).
 */
export const stitchSeams = (chunks: readonly SeamChunk[], grids: ReadonlyMap<string, TerrainGrid>): Map<string, TerrainGrid> => {
  const out = new Map([...grids].map(([id, g]) => [id, { ...g, heights: [...g.heights] }]));
  const order = new Map(chunks.map((c, i) => [c.id, i]));
  const pairs = chunkSeams(chunks).flatMap((s) => {
    const [ga, gb] = [out.get(s.a), out.get(s.b)];
    if (!ga || !gb) return [];
    const aOwns = ga.cell > gb.cell || (ga.cell === gb.cell && order.get(s.a)! < order.get(s.b)!);
    return [{ s, owner: aOwns ? ga : gb, follower: aOwns ? gb : ga }];
  });
  pairs.sort((p, q) => q.owner.cell - p.owner.cell);
  for (const { s, owner, follower: g } of pairs) {
    const fixed = s.along === "z" ? Math.round((s.at - g.originX) / g.cell) : Math.round((s.at - g.originZ) / g.cell);
    const origin = s.along === "z" ? g.originZ : g.originX;
    const [k0, k1] = [Math.ceil((s.lo - origin) / g.cell - 1e-9), Math.floor((s.hi - origin) / g.cell + 1e-9)];
    for (let k = k0; k <= k1; k++) {
      const [col, row] = s.along === "z" ? [fixed, k] : [k, fixed];
      if (col < 0 || col >= g.cols || row < 0 || row >= g.rows) continue;
      g.heights[row * g.cols + col] = terrainHeightAt(owner, g.originX + col * g.cell, g.originZ + row * g.cell);
    }
  }
  return out;
};
