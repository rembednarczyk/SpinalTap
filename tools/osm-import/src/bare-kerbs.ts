/**
 * The kerbs' band of the bare ground rule (ADR-0077 step 1.1, `bare-cover.ts`): within a few metres
 * of a carriageway a fill gives way behind bare ground on its kerb.
 */
import { type Cells, LABEL, STEP } from "./bare-cells.ts";

/** The cells within `r` cells (a square every way) of a fill: the nearest one along the rows, then along the columns. */
const reachOf = (cells: Cells, r: number): Uint8Array => {
  const { nx, nz, label } = cells;
  const rows = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    let last = -Infinity;
    // Left to right the nearest one at or before i, right to left the one after.
    for (let i = 0; i < nx; i++) {
      if (label[j * nx + i] === LABEL.grass || label[j * nx + i] === LABEL.square) last = i;
      if (i - last <= r) rows[j * nx + i] = 1;
    }
    last = Infinity;
    for (let i = nx - 1; i >= 0; i--) {
      if (label[j * nx + i] === LABEL.grass || label[j * nx + i] === LABEL.square) last = i;
      if (last - i <= r) rows[j * nx + i] = 1;
    }
  }
  const out = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++) {
    let last = -Infinity;
    for (let j = 0; j < nz; j++) {
      if (rows[j * nx + i]) last = j;
      if (j - last <= r) out[j * nx + i] = 1;
    }
    last = Infinity;
    for (let j = nz - 1; j >= 0; j--) {
      if (rows[j * nx + i]) last = j;
      if (last - j <= r) out[j * nx + i] = 1;
    }
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
  // The cells round k (8 of them, fewer at the edge), into `round`; their number.
  const round = new Int32Array(8);
  const around = (k: number): number => {
    const i = k % nx;
    let n = 0;
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const m = k + dj * nx + di;
        if ((di !== 0 || dj !== 0) && i + di >= 0 && i + di < nx && m >= 0 && m < nx * nz) round[n++] = m;
      }
    return n;
  };
  // Each carriageway's cells on its edge (a free cell round them) within reach of a fill: the walks start there.
  const near = reachOf(cells, reach);
  const seeds = new Map<number, number[]>();
  for (let k = 0; k < nx * nz; k++) {
    if (!road[k] || !near[k]) continue;
    const n = around(k);
    let edge = false;
    for (let r = 0; r < n && !edge; r++) edge = free(round[r]!);
    if (edge) (seeds.get(road[k]!) ?? seeds.set(road[k]!, []).get(road[k]!)!).push(k);
  }
  const depth = new Int16Array(nx * nz).fill(-1);
  const behind = new Uint8Array(nx * nz);
  const queue = new Int32Array(nx * nz);
  const src = new Int32Array(nx * nz);
  // Squared distance in cells to the cell of the carriageway the walk came from, and the cells by it.
  const far = new Int32Array(nx * nz);
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
        if (depth[m]! >= 0 || !free(m)) continue;
        depth[m] = depth[k]! + 1;
        src[m] = src[k]!;
        const [di, dj] = [(m % nx) - (src[m]! % nx), Math.floor(m / nx) - Math.floor(src[m]! / nx)];
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
