import type { TerrainGrid } from "@seki/core";
import type { Rect } from "../content/builders";
import type { ChunkIndex } from "./chunk-index";

/** Edge of a block, in terrain cells (10-20 m): small enough that a seam of chunks or a deck spoils little of the way, big enough for a look a few dozen samples. */
const BLOCK = 4;
/** The bound must be under the walk's slope by this: rounding of the sampled slope never reaches it. */
const SLACK = 1e-6;
/** Block not looked at yet, gentle, not. */
const [UNKNOWN, GENTLE, NOT] = [0, 1, 2];

/** Do the two closed boxes share a point? */
const touch = (a: Rect, b: Rect): boolean => a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;

/** Largest rise between two neighbouring grid points along x (`dc` 1) or z (`dr` 1) over cells c0..c1, r0..r1 and their far edge. */
const steepestEdge = (g: TerrainGrid, c0: number, c1: number, r0: number, r1: number, dc: number, dr: number): number => {
  let m = 0;
  for (let r = r0; r <= r1 + dc; r++) {
    for (let c = c0; c <= c1 + dr; c++) {
      m = Math.max(m, Math.abs((g.heights[(r + dr) * g.cols + c + dc] ?? 0) - (g.heights[r * g.cols + c] ?? 0)));
    }
  }
  return m;
};

/**
 * Blocks of the chunks' terrain where no point is too steep to walk (the ground's `steepAt`) for
 * any reach, known without sampling one slope (G-886): a chase's walk test asked the slope every
 * half cell of the way, 400 times on 200 m of level street, every step. The terrain is bilinear,
 * so a slope measured anywhere over a block (its samples reaching `span` past its edge) is no
 * steeper than the steepest edge between grid points there: a block whose bound is under the
 * walk's slope has no bank. Only where the terrain alone is the ground of those samples: in the
 * chunk's own bounds, off every chunk before it in the table (the shafts first) and off every
 * deck, flight and vault.
 */
export class GentleBlocks {
  private readonly states: (Uint8Array | null)[];

  constructor(
    private readonly chunks: readonly { readonly bounds: Rect; readonly terrain?: TerrainGrid }[],
    /** The ground's own: whose ground a point is. */
    private readonly index: ChunkIndex,
    /** The first chunks are shafts: no blocks of their own. */
    private readonly cuts: number,
    /** The decks', flights' and vaults' boxes: their ground is not the terrain's. */
    private readonly other: readonly Rect[],
    private readonly span: number,
    private readonly maxSlope: number,
  ) {
    this.states = chunks.map(() => null);
  }

  /** Is (x, z) in a gentle block of the chunk whose ground it is? The block's bounds then into `out`. */
  at(x: number, z: number, out: { minX: number; maxX: number; minZ: number; maxZ: number }): boolean {
    const i = this.index.at(x, z);
    const g = this.chunks[i]?.terrain;
    if (!g || i < this.cuts || g.cols < 2 || g.rows < 2) return false;
    const [fx, fz] = [(x - g.originX) / g.cell, (z - g.originZ) / g.cell];
    if (!(fx >= 0 && fz >= 0 && fx <= g.cols - 1 && fz <= g.rows - 1)) return false;
    const [nx, nz] = [Math.ceil((g.cols - 1) / BLOCK), Math.ceil((g.rows - 1) / BLOCK)];
    const [bx, bz] = [Math.min(Math.floor(fx / BLOCK), nx - 1), Math.min(Math.floor(fz / BLOCK), nz - 1)];
    const states = (this.states[i] ??= new Uint8Array(nx * nz));
    const box = {
      minX: g.originX + bx * BLOCK * g.cell,
      maxX: g.originX + Math.min((bx + 1) * BLOCK, g.cols - 1) * g.cell,
      minZ: g.originZ + bz * BLOCK * g.cell,
      maxZ: g.originZ + Math.min((bz + 1) * BLOCK, g.rows - 1) * g.cell,
    };
    if (states[bz * nx + bx] === UNKNOWN) states[bz * nx + bx] = this.gentle(i, g, bx, bz, box) ? GENTLE : NOT;
    if (states[bz * nx + bx] !== GENTLE) return false;
    Object.assign(out, box);
    return true;
  }

  private gentle(i: number, g: TerrainGrid, bx: number, bz: number, box: Rect): boolean {
    const s = this.span;
    const reach = { minX: box.minX - s, maxX: box.maxX + s, minZ: box.minZ - s, maxZ: box.maxZ + s };
    const own = this.chunks[i]!.bounds;
    if (reach.minX < own.minX || reach.maxX > own.maxX || reach.minZ < own.minZ || reach.maxZ > own.maxZ) return false;
    for (let j = 0; j < i; j++) if (touch(reach, this.chunks[j]!.bounds)) return false;
    if (this.other.some((o) => touch(reach, o))) return false;
    // The cells under the block and as many round it as the samples reach past its edge.
    const ring = Math.ceil(s / g.cell);
    const c0 = Math.max(0, bx * BLOCK - ring);
    const c1 = Math.min(g.cols - 2, (bx + 1) * BLOCK - 1 + ring);
    const r0 = Math.max(0, bz * BLOCK - ring);
    const r1 = Math.min(g.rows - 2, (bz + 1) * BLOCK - 1 + ring);
    const slope = Math.hypot(steepestEdge(g, c0, c1, r0, r1, 1, 0), steepestEdge(g, c0, c1, r0, r1, 0, 1)) / g.cell;
    return slope < this.maxSlope - SLACK;
  }
}
