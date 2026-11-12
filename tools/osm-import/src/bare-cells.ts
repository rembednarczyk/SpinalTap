/**
 * The raster of a chunk the bare ground rule works on (ADR-0077 step 1.1, `bare-cover.ts`): a label
 * a 0.5 m cell (what is there or is to be laid), a mask of a town's paved places, and the edges of
 * the rings that cover cells, filed by bin, so an outline can end where a piece of the map begins.
 */
import { type Pt, type Rect } from "./geometry.ts";

/** The cover's grid (m). */
export const STEP = 0.5;

/** Labels of a cell: what the rule lays there (`COVERED`: a piece or a wall is there; `BLOCKED`: by a bridge, left bare). */
export const LABEL = { covered: 0, grass: 1, square: 2, other: 3, mixed: 4, blocked: 5 } as const;
export const taken = (label: number): boolean => label === LABEL.covered || label === LABEL.blocked;

/**
 * Typed arrays the rule reuses from chunk to chunk by name, so the city's 20 chunks of some 190 000
 * cells do not leave the collector a few hundred MB to sweep. Each comes filled with `value`.
 */
const POOL = new Map<string, Int32Array | Int16Array | Uint8Array>();
const pooled = <T extends Int32Array | Int16Array | Uint8Array>(name: string, n: number, value: number, make: (n: number) => T): T => {
  let a = POOL.get(name) as T | undefined;
  if (!a || a.length < n) POOL.set(name, (a = make(n)));
  const out = a.subarray(0, n) as T;
  out.fill(value);
  return out;
};
export const scratch = {
  u8: (name: string, n: number, value = 0): Uint8Array => pooled(name, n, value, (m) => new Uint8Array(m)),
  i16: (name: string, n: number, value = 0): Int16Array => pooled(name, n, value, (m) => new Int16Array(m)),
  i32: (name: string, n: number, value = 0): Int32Array => pooled(name, n, value, (m) => new Int32Array(m)),
};

type Seg = readonly [Pt, Pt];
/** The side of a bin of the ring edges (m). */
const BIN = 2;

const segmentGap = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
};

/** The chunk's raster: a cell's centre at (minX + (i + 0.5) step, minZ + (j + 0.5) step). */
export class Cells {
  readonly nx: number;
  readonly nz: number;
  readonly rect: Rect;
  readonly label: Uint8Array;
  /** 1 in a town's paved place (`bare-cover.ts`, `TownPlaces`). */
  readonly zone: Uint8Array;
  /** Under a carriageway or a car park (a `road` piece): its number from 1, 0 off them. */
  readonly road: Int32Array;
  /** 1 under a piece drawn over the fills (a higher lift): a fill may run a little under it. */
  readonly over: Uint8Array;
  /** The ring edges by bin of `BIN` m (the chunk's bins `bx` by `bz`, one more all round). */
  private readonly bins: (Seg[] | undefined)[];
  private readonly bx: number;
  private readonly bz: number;
  constructor(rect: Rect) {
    this.rect = rect;
    this.nx = Math.round((rect.maxX - rect.minX) / STEP);
    this.nz = Math.round((rect.maxZ - rect.minZ) / STEP);
    this.bx = Math.ceil((rect.maxX - rect.minX) / BIN);
    this.bz = Math.ceil((rect.maxZ - rect.minZ) / BIN);
    this.bins = new Array<Seg[] | undefined>((this.bx + 2) * (this.bz + 2)).fill(undefined);
    this.label = scratch.u8("cells.label", this.nx * this.nz, LABEL.other);
    this.zone = scratch.u8("cells.zone", this.nx * this.nz);
    this.road = scratch.i32("cells.road", this.nx * this.nz);
    this.over = scratch.u8("cells.over", this.nx * this.nz);
  }
  at(i: number, j: number): Pt {
    return { x: this.rect.minX + (i + 0.5) * STEP, z: this.rect.minZ + (j + 0.5) * STEP };
  }
  has(i: number, j: number): boolean {
    return i >= 0 && j >= 0 && i < this.nx && j < this.nz;
  }
  /**
   * Marks the cells whose centres lie in the ring covered (carriageway number `road`, from 1; a
   * piece's drawn over the fills, if `over`) and files its edges.
   */
  cover(ring: readonly Pt[], road = 0, over = false): void {
    this.scan(ring, (from, to) => {
      this.label.fill(LABEL.covered, from, to);
      if (road) this.road.fill(road, from, to);
      if (over) this.over.fill(1, from, to);
    });
    for (let k = 0, m = ring.length - 1; k < ring.length; m = k++) this.file([ring[m]!, ring[k]!]);
  }
  /** Marks the cells whose centres lie in the ring part of a town's paved place. */
  zoneIn(ring: readonly Pt[]): void {
    this.scan(ring, (from, to) => this.zone.fill(1, from, to));
  }
  /** Marks the cells within `d` of the ring (a point is a ring of one), or in it, part of a town's paved place. */
  zoneNear(ring: readonly Pt[], d: number): void {
    this.near(ring, d, (k) => (this.zone[k] = 1));
  }
  /** Marks the free cells within `d` of the ring, or in it, `BLOCKED`. */
  block(ring: readonly Pt[], d: number): void {
    this.near(ring, d, (k) => {
      if (this.label[k] !== LABEL.covered) this.label[k] = LABEL.blocked;
    });
  }
  /** The cells whose centres lie in the ring (even-odd, a scanline a row), a run of a row at a time: `span(from, to)`, `to` past the last. */
  private scan(ring: readonly Pt[], span: (from: number, to: number) => void): void {
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of ring) {
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    const j0 = Math.max(0, Math.ceil((minZ - this.rect.minZ) / STEP - 0.5));
    const j1 = Math.min(this.nz - 1, Math.floor((maxZ - this.rect.minZ) / STEP - 0.5));
    if (j1 < j0) return;
    // Each edge's crossings of the rows' centre lines, row by row.
    const rows: number[][] = Array.from({ length: j1 - j0 + 1 }, () => []);
    for (let k = 0, m = ring.length - 1; k < ring.length; m = k++) {
      const p = ring[m]!;
      const q = ring[k]!;
      const lo = Math.max(j0, Math.ceil((Math.min(p.z, q.z) - this.rect.minZ) / STEP - 0.5));
      const hi = Math.min(j1, Math.floor((Math.max(p.z, q.z) - this.rect.minZ) / STEP - 0.5));
      for (let j = lo; j <= hi; j++) {
        const z = this.rect.minZ + (j + 0.5) * STEP;
        if (p.z > z !== q.z > z) rows[j - j0]!.push(p.x + ((z - p.z) * (q.x - p.x)) / (q.z - p.z));
      }
    }
    for (let j = j0; j <= j1; j++) {
      const xs = rows[j - j0]!;
      if (xs.length < 2) continue;
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.ceil((xs[k]! - this.rect.minX) / STEP - 0.5));
        const i1 = Math.min(this.nx - 1, Math.floor((xs[k + 1]! - this.rect.minX) / STEP - 0.5));
        if (i1 >= i0) span(j * this.nx + i0, j * this.nx + i1 + 1);
      }
    }
  }
  /** The cells within `d` of the ring's edges, or in it. */
  private near(ring: readonly Pt[], d: number, set: (k: number) => void): void {
    if (ring.length >= 3)
      this.scan(ring, (from, to) => {
        for (let k = from; k < to; k++) set(k);
      });
    // Each edge's cells within `d` of it (a point is an edge of no length).
    for (let e = 0; e < ring.length; e++) {
      const a = ring[e]!;
      const c = ring[(e + 1) % ring.length]!;
      const i0 = Math.max(0, Math.floor((Math.min(a.x, c.x) - d - this.rect.minX) / STEP));
      const i1 = Math.min(this.nx - 1, Math.ceil((Math.max(a.x, c.x) + d - this.rect.minX) / STEP));
      const j0 = Math.max(0, Math.floor((Math.min(a.z, c.z) - d - this.rect.minZ) / STEP));
      const j1 = Math.min(this.nz - 1, Math.ceil((Math.max(a.z, c.z) + d - this.rect.minZ) / STEP));
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const p = this.at(i, j);
          if (segmentGap(p, a, c) <= d) set(j * this.nx + i);
        }
    }
  }
  /** The bin of (bi, bj), the chunk's bins grown by one all round; -1 off them. */
  private binKey(bi: number, bj: number): number {
    return bi < -1 || bj < -1 || bi > this.bx || bj > this.bz ? -1 : (bj + 1) * (this.bx + 2) + bi + 1;
  }
  private file(s: Seg): void {
    const x0 = Math.min(s[0].x, s[1].x);
    const x1 = Math.max(s[0].x, s[1].x);
    const z0 = Math.min(s[0].z, s[1].z);
    const z1 = Math.max(s[0].z, s[1].z);
    if (x1 < this.rect.minX - 1 || x0 > this.rect.maxX + 1 || z1 < this.rect.minZ - 1 || z0 > this.rect.maxZ + 1) return;
    const bin = (v: number, m: number, n: number) => Math.min(n, Math.max(-1, Math.floor((v - m) / BIN)));
    for (let bj = bin(z0, this.rect.minZ, this.bz); bj <= bin(z1, this.rect.minZ, this.bz); bj++)
      for (let bi = bin(x0, this.rect.minX, this.bx); bi <= bin(x1, this.rect.minX, this.bx); bi++) (this.bins[this.binKey(bi, bj)] ??= []).push(s);
  }
  /** The share of the way from a to b where it first meets an edge of the covering rings; 0.5 without one. */
  enter(a: Pt, b: Pt): number {
    let best = Infinity;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const bi0 = Math.floor((Math.min(a.x, b.x) - this.rect.minX) / BIN);
    const bj0 = Math.floor((Math.min(a.z, b.z) - this.rect.minZ) / BIN);
    const bi1 = Math.floor((Math.max(a.x, b.x) - this.rect.minX) / BIN);
    const bj1 = Math.floor((Math.max(a.z, b.z) - this.rect.minZ) / BIN);
    for (let bj = bj0; bj <= bj1; bj++)
      for (let bi = bi0; bi <= bi1; bi++) {
        const list = this.bins[this.binKey(bi, bj)];
        if (!list) continue;
        for (const s of list) {
          const p = s[0];
          const ex = s[1].x - p.x;
          const ez = s[1].z - p.z;
          const den = dx * ez - dz * ex;
          if (Math.abs(den) < 1e-12) continue;
          const t = ((p.x - a.x) * ez - (p.z - a.z) * ex) / den;
          const u = ((p.x - a.x) * dz - (p.z - a.z) * dx) / den;
          if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && t < best) best = t;
        }
      }
    return Number.isFinite(best) ? Math.min(0.98, Math.max(0.02, best)) : 0.5;
  }
}
