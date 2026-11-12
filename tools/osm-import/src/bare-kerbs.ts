/**
 * The kerbs' band of the bare ground rule (ADR-0077 step 1.1, `bare-cover.ts`): within a few metres
 * of a carriageway a fill gives way behind bare ground on its kerb.
 */
import { type Cells, LABEL as CELL_LABEL, STEP, scratch } from "./bare-cells.ts";

// A module-local copy of the labels the cell loops read: Vitest's module runner reads an imported
// binding through a getter of the module's namespace, at each cell.
const LABEL = { ...CELL_LABEL } as const;

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
      if (l === LABEL.grass || l === LABEL.square) has[row + ((i / BLOCK) | 0)] = 1;
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
  const out = scratch.u8("kerbs.near", nx * nz, null);
  for (let j = 0; j < nz; j++) {
    const row = Math.floor(j / BLOCK) * bx;
    for (let i = 0; i < nx; i++) out[j * nx + i] = near[row + ((i / BLOCK) | 0)]!;
  }
  return out;
};

const isBare = (l: number): boolean => l === LABEL.other || l === LABEL.mixed || l === LABEL.blocked;
const isFill = (l: number): boolean => l === LABEL.grass || l === LABEL.square;

/** Column steps of the cells round a cell, row by row from the south-west. */
const DI = [-1, 0, 1, -1, 1, -1, 0, 1] as const;

/**
 * The raster of the kerbs' walks, with the cells round k (8 of them, fewer at the edge) into
 * `round` (`around`). Each step of the rule is a function of its own: V8 optimises a long loop
 * where it runs (on-stack replacement), and one function of many loops is compiled anew at each.
 */
class Walks {
  readonly nx: number;
  readonly size: number;
  readonly label: Uint8Array;
  readonly round = new Int32Array(8);
  /** The steps to the cells round a cell (`DI` and a row up or down). */
  readonly dk: Int32Array;
  readonly near: Uint8Array;
  readonly depth: Int16Array;
  readonly behind: Uint8Array;
  readonly queue: Int32Array;
  readonly src: Int32Array;
  /** Squared distance in cells to the cell of the carriageway the walk came from. */
  readonly far: Int32Array;
  constructor(cells: Cells, near: Uint8Array) {
    const { nx, nz, label } = cells;
    this.nx = nx;
    this.size = nx * nz;
    this.label = label;
    this.near = near;
    this.dk = Int32Array.from(DI, (di, r) => (r < 3 ? -nx : r < 5 ? 0 : nx) + di);
    this.depth = scratch.i16("kerbs.depth", this.size, -1);
    this.behind = scratch.u8("kerbs.behind", this.size);
    this.queue = scratch.i32("kerbs.queue", this.size, null);
    this.src = scratch.i32("kerbs.src", this.size, null);
    this.far = scratch.i32("kerbs.far", this.size, null);
  }
  around(k: number): number {
    const { nx, size, dk, round } = this;
    const i = k % nx;
    let n = 0;
    for (let r = 0; r < 8; r++) {
      const ii = i + DI[r]!;
      const m = k + dk[r]!;
      if (ii >= 0 && ii < nx && m >= 0 && m < size) round[n++] = m;
    }
    return n;
  }
}

/** Each carriageway's cells on its edge (a free cell round them) within reach of a fill, by its number: the walks start there. */
const kerbSeeds = (w: Walks, road: Int32Array): Map<number, number[]> => {
  const { label, near, round, size } = w;
  const seeds = new Map<number, number[]>();
  for (let k = 0; k < size; k++) {
    if (!road[k] || !near[k]) continue;
    const n = w.around(k);
    let edge = false;
    for (let r = 0; r < n && !edge; r++) edge = label[round[r]!] !== LABEL.covered;
    if (edge) (seeds.get(road[k]!) ?? seeds.set(road[k]!, []).get(road[k]!)!).push(k);
  }
  return seeds;
};

/** The walk from the cells `from` out to `reach` steps, through free cells near a fill, into `queue`: the cells walked and whether a fill is among them. */
const walk = (w: Walks, from: readonly number[], reach: number): { n: number; fills: number } => {
  const { nx, label, near, round, depth, queue, src, far } = w;
  let n = 0;
  let fills = 0;
  for (const k of from) {
    queue[n++] = k;
    depth[k] = 0;
    src[k] = k;
  }
  for (let q = 0; q < n; q++) {
    const k = queue[q]!;
    if (depth[k]! >= reach || (depth[k]! > 0 && label[k] === LABEL.covered)) continue;
    const c = w.around(k);
    for (let r = 0; r < c; r++) {
      const m = round[r]!;
      // Only near a fill: a walk from the kerb to one never leaves its reach.
      if (depth[m]! >= 0 || label[m] === LABEL.covered || !near[m]) continue;
      depth[m] = depth[k]! + 1;
      src[m] = src[k]!;
      const s0 = src[m]!;
      const di = (m % nx) - (s0 % nx);
      const dj = (m - (m % nx)) / nx - (s0 - (s0 % nx)) / nx;
      far[m] = di * di + dj * dj;
      if (isFill(label[m]!)) fills++;
      queue[n++] = m;
    }
  }
  return { n, fills };
};

/** The cells of a walk (`queue` from `start` to `n`) nearest the carriageway first, as the crow flies: those behind bare turn bare. */
const giveWay = (w: Walks, byFar: number[][], start: number, n: number): void => {
  const { label, round, depth, behind, queue, far } = w;
  for (let q = start; q < n; q++) byFar[Math.min(byFar.length - 1, far[queue[q]!]!)]!.push(queue[q]!);
  for (const bucket of byFar) {
    for (const k of bucket) {
      const c = w.around(k);
      for (let r = 0; r < c && !behind[k]; r++) {
        const m = round[r]!;
        if (depth[m]! > 0 && far[m]! < far[k]! && (isBare(label[m]!) || behind[m] === 1)) behind[k] = 1;
      }
      if (behind[k] && isFill(label[k]!)) label[k] = LABEL.other;
    }
    bucket.length = 0;
  }
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
  const reach = Math.ceil(band / STEP);
  const w = new Walks(cells, nearFill(cells, reach));
  const seeds = kerbSeeds(w, cells.road);
  const byFar: number[][] = Array.from({ length: 2 * reach * reach + 1 }, () => []);
  for (const [, from] of [...seeds].sort((a, b) => a[0] - b[0])) {
    const { n, fills } = walk(w, from, reach);
    if (fills > 0) giveWay(w, byFar, from.length, n);
    for (let q = 0; q < n; q++) {
      w.depth[w.queue[q]!] = -1;
      w.behind[w.queue[q]!] = 0;
    }
  }
};

/** The outlines of one label in a tile of cells, simplified, as the chunk's ground; a hole splits the tile. */
