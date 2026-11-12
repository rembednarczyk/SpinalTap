/**
 * The kerbs' band of the bare ground rule (ADR-0077 step 1.1, `bare-cover.ts`): within a few metres
 * of a carriageway a fill gives way behind bare ground on its kerb.
 */
import { type Cells, LABEL, STEP, scratch } from "./bare-cells.ts";

/** Blocks of cells a side, for `nearFill`. */
const BLOCK = 4;

/**
 * Whether a cell may be within `r` cells (a square every way) of a fill: blocks of `BLOCK` cells
 * holding one, grown by as many blocks as cover `r` and one more. More cells than the exact reach,
 * never fewer.
 */
const nearFill = (cells: Cells, r: number): Uint8Array => {
  const { nx, nz, label } = cells;
  const [bx, bz] = [Math.ceil(nx / BLOCK), Math.ceil(nz / BLOCK)];
  const has = new Uint8Array(bx * bz);
  for (let j = 0; j < nz; j++) {
    const o = j * nx;
    const row = Math.floor(j / BLOCK) * bx;
    for (let i = 0; i < nx; i++) {
      const l = label[o + i];
      if (l === LABEL.grass || l === LABEL.square) has[row + Math.floor(i / BLOCK)] = 1;
    }
  }
  const g = Math.ceil(r / BLOCK) + 1;
  const near = new Uint8Array(bx * bz);
  for (let j = 0; j < bz; j++)
    for (let i = 0; i < bx; i++) {
      if (!has[j * bx + i]) continue;
      for (let jj = Math.max(0, j - g); jj <= Math.min(bz - 1, j + g); jj++) near.fill(1, jj * bx + Math.max(0, i - g), jj * bx + Math.min(bx - 1, i + g) + 1);
    }
  // Per cell, a row of blocks at a time.
  const out = scratch.u8("kerbs.near", nx * nz);
  for (let j = 0; j < nz; j++) {
    const row = Math.floor(j / BLOCK) * bx;
    for (let i = 0; i < nx; i++) out[j * nx + i] = near[row + Math.floor(i / BLOCK)]!;
  }
  return out;
};

/**
 * A fill gives way within `band` metres of a carriageway behind bare ground on its kerb: a lawn or
 * paving short of the kerb would leave a bare strip along it with a surface past it, what
 * `kerb-gap-bare` and `kerb-strip-bare` count (the kerbs' strips are the next rule's, ADR-0077
 * step 1.2). For each carriageway piece the free cells round it are taken by their distance from it
 * (a step every way; a pavement or a wall ends the walk): one with a nearer neighbour bare, or
 * behind bare, is behind bare too, and a fill there turns bare. A fill on the kerb stays.
 */
export const keepKerbs = (cells: Cells, band: number): void => {
  const { nx, nz, label, road } = cells;
  const reach = Math.ceil(band / STEP);
  const bare = (l: number) => l === LABEL.other || l === LABEL.mixed || l === LABEL.blocked;
  const fill = (l: number) => l === LABEL.grass || l === LABEL.square;
  const free = (k: number) => label[k] !== LABEL.covered;
  const size = nx * nz;
  // The cells round k (8 of them, fewer at the edge), into `round`, row by row from the south-west; their number.
  const DI = [-1, 0, 1, -1, 1, -1, 0, 1];
  const DK = DI.map((di, r) => (r < 3 ? -nx : r < 5 ? 0 : nx) + di);
  const round = new Int32Array(8);
  const around = (k: number): number => {
    const i = k % nx;
    let n = 0;
    for (let r = 0; r < 8; r++) {
      const ii = i + DI[r]!;
      const m = k + DK[r]!;
      if (ii >= 0 && ii < nx && m >= 0 && m < size) round[n++] = m;
    }
    return n;
  };
  // Each carriageway's cells on its edge (a free cell round them) within reach of a fill: the walks start there.
  const near = nearFill(cells, reach);
  const seeds = new Map<number, number[]>();
  for (let k = 0; k < nx * nz; k++) {
    if (!road[k] || !near[k]) continue;
    const n = around(k);
    let edge = false;
    for (let r = 0; r < n && !edge; r++) edge = free(round[r]!);
    if (edge) (seeds.get(road[k]!) ?? seeds.set(road[k]!, []).get(road[k]!)!).push(k);
  }
  const depth = scratch.i16("kerbs.depth", nx * nz, -1);
  const behind = scratch.u8("kerbs.behind", nx * nz);
  const queue = scratch.i32("kerbs.queue", nx * nz);
  const src = scratch.i32("kerbs.src", nx * nz);
  // Squared distance in cells to the cell of the carriageway the walk came from, and the cells by it.
  const far = scratch.i32("kerbs.far", nx * nz);
  const byFar: number[][] = Array.from({ length: 2 * reach * reach + 1 }, () => []);
  for (const [, from] of [...seeds].sort((a, b) => a[0] - b[0])) {
    let n = 0;
    let fills = 0;
    for (const k of from) {
      queue[n++] = k;
      depth[k] = 0;
      src[k] = k;
    }
    for (let q = 0; q < n; q++) {
      const k = queue[q]!;
      if (depth[k]! >= reach || (depth[k]! > 0 && !free(k))) continue;
      const c = around(k);
      for (let r = 0; r < c; r++) {
        const m = round[r]!;
        // Only near a fill: a walk from the kerb to one never leaves its reach.
        if (depth[m]! >= 0 || !free(m) || !near[m]) continue;
        depth[m] = depth[k]! + 1;
        src[m] = src[k]!;
        const s0 = src[m]!;
        const di = (m % nx) - (s0 % nx);
        const dj = (m - (m % nx)) / nx - (s0 - (s0 % nx)) / nx;
        far[m] = di * di + dj * dj;
        if (fill(label[m]!)) fills++;
        queue[n++] = m;
      }
    }
    if (fills > 0) {
      // Nearest the carriageway first, as the crow flies.
      for (let q = from.length; q < n; q++) byFar[Math.min(byFar.length - 1, far[queue[q]!]!)]!.push(queue[q]!);
      for (const bucket of byFar) {
        for (const k of bucket) {
          const c = around(k);
          for (let r = 0; r < c && !behind[k]; r++) {
            const m = round[r]!;
            if (depth[m]! > 0 && far[m]! < far[k]! && (bare(label[m]!) || behind[m] === 1)) behind[k] = 1;
          }
          if (behind[k] && fill(label[k]!)) label[k] = LABEL.other;
        }
        bucket.length = 0;
      }
    }
    for (let q = 0; q < n; q++) {
      depth[queue[q]!] = -1;
      behind[queue[q]!] = 0;
    }
  }
};

/** The outlines of one label in a tile of cells, simplified, as the chunk's ground; a hole splits the tile. */
