/**
 * The cleaning of the bare ground rule's raster (ADR-0077 step 1.1, `bare-cover.ts`), as a land
 * cover layer is cleaned in GIS: the cover's classes read onto the free cells, shade and crowns
 * taking the class most of their neighbourhood has, specks joining what surrounds them, and loose
 * regions off a town's paved places left bare.
 *
 * Each raster pass reads a row at a time through a function of its own (`coverRow`, `mixedRow`):
 * V8 optimises a function called that often once for all the chunks, where the loop of one call
 * over a whole raster is compiled anew, on the stack, in every call.
 */
import { COVER } from "../../orto/src/classify.ts";
import { type Cover } from "../../orto/src/cover.ts";
import { type Cells, LABEL as CELL_LABEL, STEP as CELL_STEP, scratch, taken as cellTaken } from "./bare-cells.ts";

// Module-local copies of what the cell loops read: Vitest's module runner reads an imported binding
// through a getter of the module's namespace, which a loop of 190 000 cells would pay at each cell.
const LABEL = { ...CELL_LABEL } as const;
const STEP = CELL_STEP;
const taken = cellTaken;

const labelOf = (cls: number): number =>
  cls === COVER.green ? LABEL.grass : cls === COVER.paving ? LABEL.square : cls === COVER.shadow ? LABEL.mixed : cls === COVER.canopy ? LABEL.crown : LABEL.other;

/**
 * What a cell adds to the packed counts of `readCover`'s table: grass in bits 0-9, square in 10-19,
 * other in 20-29. A window's counts (at most 81 a class) never fill a field, so the table, kept
 * modulo 2^32, gives them exactly however large its entries grow.
 */
const PACKED = Int32Array.from({ length: 8 }, (_, l) => (l === LABEL.grass ? 1 : l === LABEL.square ? 1 << 10 : l === LABEL.other ? 1 << 20 : 0));

/**
 * Shade and crowns of row `j` take the class most of the free cells `r` round them have, by the
 * packed summed-area table `t` of the cells as the cover gave them (`readCover`): `lo` and `hi`
 * where its rows j - r and j + r + 1 (within the raster) begin in it.
 */
const mixedRow = (cells: Cells, t: Int32Array, j: number, r: number, lo: number, hi: number): void => {
  const { nx, label } = cells;
  const o = j * nx;
  for (let i = 0; i < nx; i++) {
    const l = label[o + i]!;
    if (l !== LABEL.mixed && l !== LABEL.crown) continue;
    const i0 = Math.max(0, i - r);
    const i1 = Math.min(nx, i + r + 1);
    const c = (t[hi + i1]! - t[lo + i1]! - t[hi + i0]! + t[lo + i0]!) | 0;
    const g = c & 1023;
    const s = (c >> 10) & 1023;
    const q = (c >> 20) & 1023;
    // Ties and none round it stay bare. A crown over lawn or paving takes a lawn (a tree's bed: paving
    // under it would be a guess, T-285), and stays bare over asphalt.
    label[o + i] = l === LABEL.crown ? (g > q || s > q ? LABEL.grass : LABEL.other) : g > s && g > q ? LABEL.grass : s > g && s > q ? LABEL.square : LABEL.other;
  }
};

/** What `coverRow` reads a row from: `base` the row's start in the raster's classes (`cls`), -1 off it. */
interface CoverRow {
  readonly label: Uint8Array;
  readonly nx: number;
  readonly cols: Int32Array;
  readonly labels: Uint8Array;
  readonly cls: Uint8Array;
  base: number;
  readonly none: number;
  readonly t: Int32Array;
}

/**
 * Row `j` of `readCover`, its row of the table from `here` on and the row south from `up` on, a
 * function of its own: called a row at a time, V8 optimises it once for every chunk, where a loop
 * over the whole raster is compiled anew in each call.
 */
const coverRow = (r: CoverRow, j: number, up: number, here: number): void => {
  const { label, nx, cols, labels, cls, base, none, t } = r;
  const o = j * nx;
  let run = 0;
  for (let i = 0; i < nx; i++) {
    let l = label[o + i]!;
    if (!taken(l)) {
      const col = cols[i]!;
      label[o + i] = l = labels[base < 0 || col < 0 ? none : cls[base + col]!]!;
    }
    run = (run + PACKED[l]!) | 0;
    t[here + i] = (run + t[up + i]!) | 0;
  }
};

/**
 * The free cells' labels from the cover (covered ones stay covered), shade and crowns resolved
 * (`mixedRow`), in one pass: the packed summed-area table of the grass, square and other cells as
 * the cover gives them (`PACKED`; entry (i, j) counts those west and south of (i, j)) is written a
 * row at a time, and a row's shade is resolved once the table holds every row it reads,
 * `around` rows on.
 */
export const readCover = (cells: Cells, cover: Cover, around: number): void => {
  const { nx, nz, label } = cells;
  const { header: h, cls } = cover;
  const width = h.width;
  // Each class's label, and each column's column of the raster (-1 off it).
  const labels = Uint8Array.from({ length: 16 }, (_, c) => labelOf(c));
  const cols = Int32Array.from({ length: nx }, (_, i) => {
    const col = Math.floor((cells.rect.minX + (i + 0.5) * STEP - h.x0) / h.step);
    return col < 0 || col >= width ? -1 : col;
  });
  const t = scratch.i32("summed", (nx + 1) * (nz + 1), null);
  const at = (j: number) => j * (nx + 1);
  const mixed = (j: number) => mixedRow(cells, t, j, around, at(Math.max(0, j - around)), at(Math.min(nz, j + around + 1)));
  // Row 0 and column 0 count nothing; the rest is written below.
  t.fill(0, 0, nx + 1);
  const read: CoverRow = { label, nx, cols, labels, cls, base: -1, none: COVER.none, t };
  for (let j = 0; j < nz; j++) {
    const row = Math.floor((h.z1 - (cells.rect.minZ + (j + 0.5) * STEP)) / h.step);
    read.base = row < 0 || row >= h.height ? -1 : row * width;
    t[at(j + 1)] = 0;
    coverRow(read, j, at(j) + 1, at(j + 1) + 1);
    if (j >= around) mixed(j - around);
  }
  for (let j = Math.max(0, nz - around); j < nz; j++) mixed(j);
};

/**
 * The scratch a walk of regions keeps: which cells it has seen, the cells of a region, the free
 * cells of each label round it, its cell edges out of it, and which cells keep to themselves.
 */
interface RegionWalk {
  readonly seen: Uint8Array;
  readonly queue: Int32Array;
  readonly round: Int32Array;
  edges: number;
  /** Cells of one value here and the others are regions apart (all 0: none are). */
  readonly apart: Uint8Array;
}

const regionWalk = (cells: Cells, apart: Uint8Array | null): RegionWalk => ({
  seen: scratch.u8("region.seen", cells.nx * cells.nz),
  queue: scratch.i32("region.queue", cells.nx * cells.nz, null),
  round: new Int32Array(8),
  edges: 0,
  apart: apart ?? scratch.u8("region.apart", cells.nx * cells.nz),
});

/**
 * The 4-connected region of free cells of one label from cell `s`, apart from the cells `w.apart`
 * sets apart from it: its cells (in `queue`, as many as it returns), the free cells of each label
 * round it (`round`) and its cell edges out of it (`edges`).
 */
const regionFrom = (cells: Cells, w: RegionWalk, s: number): number => {
  const { nx, label } = cells;
  const size = label.length;
  const { seen, queue, round, apart } = w;
  const own = label[s]!;
  const side = apart[s]!;
  let n = 0;
  let edges = 0;
  queue[n++] = s;
  seen[s] = 1;
  round.fill(0);
  // The cells east, west, north and south of each (off the raster: an edge out).
  for (let q = 0; q < n; q++) {
    const k = queue[q]!;
    const i = k % nx;
    for (let d = 0; d < 4; d++) {
      const m = d === 0 ? (i + 1 < nx ? k + 1 : -1) : d === 1 ? (i > 0 ? k - 1 : -1) : d === 2 ? (k + nx < size ? k + nx : -1) : k - nx;
      const l = m < 0 ? -1 : label[m]!;
      if (l === own) {
        if (apart[m] === side && !seen[m]) {
          seen[m] = 1;
          queue[n++] = m;
        }
      } else {
        edges++;
        if (l >= 0 && !taken(l)) round[l]!++;
      }
    }
  }
  w.edges = edges;
  return n;
};

/** No region's key (`componentRow`): a cell that belongs to none. */
const NONE = 255;

/**
 * The 4-connected regions of a raster's cells of one key, by their runs along the rows: a row's
 * runs joined to the runs of the row south they share a column with (union-find over the runs),
 * each region's cells counted (`size`, at its root) and, for `edges`, its cell edges out of it
 * (to a cell of another label or off the raster). A run is read with a few typed-array reads a
 * cell, where a walk cell by cell looks four ways round each.
 */
interface Components {
  /** Each run's first cell, the cell past its last and its key. */
  readonly start: Int32Array;
  readonly end: Int32Array;
  readonly key: Uint8Array;
  readonly parent: Int32Array;
  /** By a region's root run: its cells and its edges out. */
  readonly size: Int32Array;
  readonly edges: Int32Array;
  runs: number;
}

const root = (parent: Int32Array, r: number): number => {
  while (parent[r] !== r) {
    parent[r] = parent[parent[r]!]!;
    r = parent[r]!;
  }
  return r;
};

/**
 * The runs of row `j` (key a cell: its label where free for `loose` false; where grass or square off
 * a town's paved places for `loose` true; `NONE` elsewhere), joined to the row south's runs from
 * `south` on; a function of its own (see the module's comment). Where the row's runs begin.
 */
const componentRow = (cells: Cells, c: Components, j: number, south: number, loose: boolean): number => {
  const { nx, label, zone } = cells;
  const { start, end, key, parent } = c;
  const o = j * nx;
  const first = c.runs;
  let n = first;
  for (let i = 0; i < nx; ) {
    const l = label[o + i]!;
    const k = loose ? (zone[o + i] || (l !== LABEL.grass && l !== LABEL.square) ? NONE : l) : taken(l) ? NONE : l;
    if (k === NONE) {
      i++;
      continue;
    }
    let e = i + 1;
    while (e < nx && label[o + e] === l && (!loose || !zone[o + e])) e++;
    start[n] = o + i;
    end[n] = o + e;
    key[n] = k;
    parent[n] = n;
    n++;
    i = e;
  }
  c.runs = n;
  // Runs of one key sharing a column with a run of the row south are one region.
  for (let p = south, q = first; p < first && q < n; ) {
    const pa = start[p]! + nx;
    const pb = end[p]! + nx;
    const qa = start[q]!;
    const qb = end[q]!;
    if (pa < qb && qa < pb && key[p] === key[q]) {
      const x = root(parent, p);
      const y = root(parent, q);
      if (x !== y) parent[Math.max(x, y)] = Math.min(x, y);
    }
    if (pb <= qb) p++;
    else q++;
  }
  return first;
};

/** The edges out of run `r` (`Components`): at its ends and along the rows north and south of it. */
const runEdges = (cells: Cells, c: Components, r: number): number => {
  const { nx, nz, label } = cells;
  const a = c.start[r]!;
  const b = c.end[r]!;
  const own = c.key[r]!;
  const j = Math.floor(a / nx);
  const o = j * nx;
  let edges = (a === o || label[a - 1] !== own ? 1 : 0) + (b === o + nx || label[b] !== own ? 1 : 0);
  if (j === 0) edges += b - a;
  else for (let k = a - nx; k < b - nx; k++) if (label[k] !== own) edges++;
  if (j === nz - 1) edges += b - a;
  else for (let k = a + nx; k < b + nx; k++) if (label[k] !== own) edges++;
  return edges;
};

const components = (cells: Cells, loose: boolean): Components => {
  const n = cells.nx * cells.nz;
  const c: Components = {
    start: scratch.i32("regions.start", n, null),
    end: scratch.i32("regions.end", n, null),
    key: scratch.u8("regions.key", n, null),
    parent: scratch.i32("regions.parent", n, null),
    size: scratch.i32("regions.size", n, null),
    edges: scratch.i32("regions.edges", n, null),
    runs: 0,
  };
  for (let j = 0, south = 0; j < cells.nz; j++) south = componentRow(cells, c, j, south, loose);
  c.size.fill(0, 0, c.runs);
  if (loose) c.edges.fill(0, 0, c.runs);
  for (let r = 0; r < c.runs; r++) {
    const top = root(c.parent, r);
    c.size[top]! += c.end[r]! - c.start[r]!;
    if (loose) c.edges[top]! += runEdges(cells, c, r);
  }
  return c;
};

/**
 * Regions of one label under `speck` cells take the label most of the free cells round them have:
 * the minimum mapping unit; but a speck of green in paving stays a lawn (a tree's pit, a bed), not
 * paving on the orthophoto's green (ADR-0077 step 1.2, T-285). The regions' sizes come from their
 * runs (`components`); a speck, in the order of its first cell, is walked cell by cell for the
 * labels round it as they are then.
 */
export const joinSpecks = (cells: Cells, speck: number): void => {
  const { label } = cells;
  const c = components(cells, false);
  const w = regionWalk(cells, null);
  const { seen, queue, round } = w;
  // The free cells in their order, a run at a time: the runs come row by row, west to east.
  for (let r = 0; r < c.runs; r++) {
    if (c.size[root(c.parent, r)]! >= speck) continue;
    for (let s = c.start[r]!; s < c.end[r]!; s++) {
      if (seen[s]) continue;
      const n = regionFrom(cells, w, s);
      // The label most of the border has, the lower one on a tie.
      let to = -1;
      for (let l = 0; l < round.length; l++) if (round[l]! > 0 && (to < 0 || round[l]! > round[to]!)) to = l;
      if (to < 0 || (to === LABEL.square && label[s] === LABEL.grass)) continue;
      for (let q = 0; q < n; q++) label[queue[q]!] = to;
    }
  }
};

/**
 * Off a town's paved places, a region of lawn or paving narrower than `width` (m) on the average
 * or under `area` (m²) stays bare. A region's cells and edges out come from its runs
 * (`components`): a region turned bare changes no other's, whose edges meet it as another label.
 */
export const dropLoose = (cells: Cells, width: number, area: number): void => {
  const { label } = cells;
  const c = components(cells, true);
  for (let r = 0; r < c.runs; r++) {
    const top = root(c.parent, r);
    const n = c.size[top]!;
    const edges = c.edges[top]!;
    // Area n / 4 m², outline edges / 2 m: the mean width 2 area / outline.
    if (n / edges >= width && n * STEP * STEP >= area) continue;
    label.fill(LABEL.other, c.start[r]!, c.end[r]!);
  }
};
