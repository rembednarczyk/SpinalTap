/**
 * The raster of a chunk the bare ground rule works on (ADR-0077 step 1.1, `bare-cover.ts`): a label
 * a 0.5 m cell (what is there or is to be laid), a mask of a town's paved places, and the rings that
 * cover cells, so a fill can be cut where a piece of the map begins.
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
  /** The rings that cover cells, with their boxes. */
  private readonly covers: { readonly ring: readonly Pt[]; readonly box: Rect }[] = [];
  constructor(rect: Rect) {
    this.rect = rect;
    this.nx = Math.round((rect.maxX - rect.minX) / STEP);
    this.nz = Math.round((rect.maxZ - rect.minZ) / STEP);
    this.label = scratch.u8("cells.label", this.nx * this.nz, LABEL.other);
    this.zone = scratch.u8("cells.zone", this.nx * this.nz);
    this.road = scratch.i32("cells.road", this.nx * this.nz);
  }
  at(i: number, j: number): Pt {
    return { x: this.rect.minX + (i + 0.5) * STEP, z: this.rect.minZ + (j + 0.5) * STEP };
  }
  has(i: number, j: number): boolean {
    return i >= 0 && j >= 0 && i < this.nx && j < this.nz;
  }
  /**
   * Marks the cells whose centres lie in the ring covered (carriageway number `road`, from 1) and
   * keeps the ring, so the fills can be cut by it (`coversNear`).
   */
  cover(ring: readonly Pt[], road = 0): void {
    this.scan(ring, (from, to) => {
      this.label.fill(LABEL.covered, from, to);
      if (road) this.road.fill(road, from, to);
    });
    let [minX, minZ, maxX, maxZ] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of ring) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    this.covers.push({ ring, box: { minX, minZ, maxX, maxZ } });
  }
  /** The rings covering cells whose boxes meet `r`. */
  coversNear(r: Rect): (readonly Pt[])[] {
    return this.covers.filter((c) => c.box.minX < r.maxX && r.minX < c.box.maxX && c.box.minZ < r.maxZ && r.minZ < c.box.maxZ).map((c) => c.ring);
  }
  /** Marks the cells whose centres lie in the ring part of a town's paved place. */
  zoneIn(ring: readonly Pt[]): void {
    this.scan(ring, (from, to) => this.zone.fill(1, from, to));
  }
  /** Marks the cells within `d` of the ring (a point is a ring of one), or in it, part of a town's paved place. */
  zoneNear(ring: readonly Pt[], d: number): void {
    this.near(ring, d, (k) => (this.zone[k] = 1));
  }
  /** Grows the town's paved places by `d` (m) every way (a square round each cell): the nearest one along the rows, then down the columns. */
  growZone(d: number): void {
    const { nx, nz, zone } = this;
    const r = Math.round(d / STEP);
    const FAR = 1 << 20;
    const rows = scratch.u8("zone.rows", nx * nz);
    for (let j = 0; j < nz; j++) {
      const o = j * nx;
      let last = -FAR;
      for (let i = 0; i < nx; i++) {
        if (zone[o + i]) last = i;
        if (i - last <= r) rows[o + i] = 1;
      }
      last = FAR;
      for (let i = nx - 1; i >= 0; i--) {
        if (zone[o + i]) last = i;
        if (last - i <= r) rows[o + i] = 1;
      }
    }
    const last = new Int32Array(nx).fill(-FAR);
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        if (rows[j * nx + i]) last[i] = j;
        if (j - last[i]! <= r) zone[j * nx + i] = 1;
      }
    last.fill(FAR);
    for (let j = nz - 1; j >= 0; j--)
      for (let i = 0; i < nx; i++) {
        if (rows[j * nx + i]) last[i] = j;
        if (last[i]! - j <= r) zone[j * nx + i] = 1;
      }
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
      const [dx, dz] = [c.x - a.x, c.z - a.z];
      const len2 = dx * dx + dz * dz || 1;
      for (let j = j0; j <= j1; j++) {
        const pz = this.rect.minZ + (j + 0.5) * STEP;
        for (let i = i0; i <= i1; i++) {
          // As `segmentGap`, the cell's centre inline.
          const px = this.rect.minX + (i + 0.5) * STEP;
          const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / len2));
          if (Math.hypot(a.x + dx * t - px, a.z + dz * t - pz) <= d) set(j * this.nx + i);
        }
      }
    }
  }
}
