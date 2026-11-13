/**
 * The raster of a chunk the bare ground rule works on (ADR-0077 step 1.1, `bare-cover.ts`): a label
 * a 0.5 m cell (what is there or is to be laid), a mask of a town's paved places, and the rings that
 * cover cells, so a fill can be cut where a piece of the map begins.
 */
import { SpatialHash } from "../../../packages/core/src/math/spatial-hash.ts";
import { type Pt, type Rect } from "./geometry.ts";

/** The cover's grid (m). */
export const STEP = 0.5;

/** Side of the cells of the grid the covering rings are found by (m): a tile of fills (36 m) meets some 16 of them. */
const COVER_CELL = 12;

/** Labels of a cell: what the rule lays there (`COVERED`: a piece or a wall is there; `BLOCKED`: by a bridge, left bare). */
export const LABEL = { covered: 0, grass: 1, square: 2, other: 3, mixed: 4, blocked: 5 } as const;
export const taken = (label: number): boolean => label === LABEL.covered || label === LABEL.blocked;

/**
 * Typed arrays the rule reuses from chunk to chunk by name, so the city's 20 chunks of some 190 000
 * cells do not leave the collector a few hundred MB to sweep. Each comes filled with `value`, or
 * as the last user left it with `null` (for one written all over before it is read).
 */
const POOL = new Map<string, Int32Array | Int16Array | Uint8Array>();
const pooled = <T extends Int32Array | Int16Array | Uint8Array>(name: string, n: number, value: number | null, make: (n: number) => T): T => {
  let a = POOL.get(name) as T | undefined;
  if (!a || a.length < n) POOL.set(name, (a = make(n)));
  const out = a.subarray(0, n) as T;
  if (value !== null) out.fill(value);
  return out;
};
export const scratch = {
  u8: (name: string, n: number, value: number | null = 0): Uint8Array => pooled(name, n, value, (m) => new Uint8Array(m)),
  i16: (name: string, n: number, value: number | null = 0): Int16Array => pooled(name, n, value, (m) => new Int16Array(m)),
  i32: (name: string, n: number, value: number | null = 0): Int32Array => pooled(name, n, value, (m) => new Int32Array(m)),
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
  /** The rings that cover cells, with their boxes, by the cells of a grid (broad phase of `coversNear`). */
  /** Runs of cells the last `scan` found: from and past the last, a pair a run. */
  private runs = new Int32Array(256);
  /** The last `scan`'s crossings of the rows, and where each row's crossings begin in them. */
  private xs = new Float64Array(256);
  private rowAt = new Int32Array(256);
  private readonly covers = new SpatialHash<{ readonly ring: readonly Pt[]; readonly box: Rect }>(COVER_CELL);
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
    const runs = this.scan(ring);
    const r = this.runs;
    for (let k = 0; k < runs; k++) {
      this.label.fill(LABEL.covered, r[2 * k]!, r[2 * k + 1]!);
      if (road) this.road.fill(road, r[2 * k]!, r[2 * k + 1]!);
    }
    let [minX, minZ, maxX, maxZ] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of ring) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    this.covers.insert({ ring, box: { minX, minZ, maxX, maxZ } }, minX, minZ, maxX, maxZ);
  }
  /** The rings covering cells whose boxes meet `r`, with their boxes. */
  coversNear(r: Rect): { readonly ring: readonly Pt[]; readonly box: Rect }[] {
    return this.covers.query(r.minX, r.minZ, r.maxX, r.maxZ).filter((c) => c.box.minX < r.maxX && r.minX < c.box.maxX && c.box.minZ < r.maxZ && r.minZ < c.box.maxZ);
  }
  /** Marks the cells whose centres lie in the ring part of a town's paved place. */
  zoneIn(ring: readonly Pt[]): void {
    const runs = this.scan(ring);
    for (let k = 0; k < runs; k++) this.zone.fill(1, this.runs[2 * k]!, this.runs[2 * k + 1]!);
  }
  /** Marks the cells within `d` of the ring (a point is a ring of one), or in it, part of a town's paved place. */
  zoneNear(ring: readonly Pt[], d: number): void {
    this.near(ring, d, this.zone, 1, -1);
  }
  /**
   * Grows the town's paved places by `d` (m) every way (a square round each cell): each run of a
   * place along a row, `d` longer at both ends, is laid on the rows within `d` of it. The runs are
   * read first, so the grown ones are not grown again.
   */
  growZone(d: number): void {
    const { nx, nz, zone } = this;
    const r = Math.round(d / STEP);
    // Grown runs, a triple a run: its row, from, past its last.
    const runs: number[] = [];
    for (let j = 0, from = zone.indexOf(1); from >= 0; ) {
      while (from >= (j + 1) * nx) j++;
      const end = (j + 1) * nx;
      let past = zone.indexOf(0, from);
      if (past < 0 || past > end) past = end;
      const [a, b] = [Math.max(j * nx, from - r), Math.min(end, past + r)];
      // Runs closer than 2 r merge.
      const n = runs.length;
      if (n > 0 && runs[n - 3] === j && runs[n - 1]! >= a) runs[n - 1] = b;
      else runs.push(j, a, b);
      from = zone.indexOf(1, past);
    }
    for (let k = 0; k < runs.length; k += 3) {
      const [j, a, b] = [runs[k]!, runs[k + 1]!, runs[k + 2]!];
      for (let t = Math.max(0, j - r); t <= Math.min(nz - 1, j + r); t++) zone.fill(1, a + (t - j) * nx, b + (t - j) * nx);
    }
  }
  /** Marks the free cells within `d` of the ring, or in it, `BLOCKED`. */
  block(ring: readonly Pt[], d: number): void {
    this.near(ring, d, this.label, LABEL.blocked, LABEL.covered);
  }
  /**
   * The cells whose centres lie in the ring (even-odd, a scanline a row), a run of a row at a time
   * into `runs`; their number. Runs, not a callback a run: one call site a use keeps V8's code of
   * each monomorphic.
   */
  private scan(ring: readonly Pt[]): number {
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of ring) {
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    const j0 = Math.max(0, Math.ceil((minZ - this.rect.minZ) / STEP - 0.5));
    const j1 = Math.min(this.nz - 1, Math.floor((maxZ - this.rect.minZ) / STEP - 0.5));
    if (j1 < j0) return 0;
    // Each edge's crossings of the rows' centre lines, row by row: counted, then laid in one array
    // from each row's start (`at`, then past each row's last), no list a row.
    const rows = j1 - j0 + 1;
    if (this.rowAt.length < rows + 1) this.rowAt = new Int32Array(2 * (rows + 1));
    const at = this.rowAt;
    at.fill(0, 0, rows + 1);
    const { minZ: z0, minX: x0 } = this.rect;
    for (let k = 0, m = ring.length - 1; k < ring.length; m = k++) {
      const p = ring[m]!;
      const q = ring[k]!;
      const lo = Math.max(j0, Math.ceil((Math.min(p.z, q.z) - z0) / STEP - 0.5));
      const hi = Math.min(j1, Math.floor((Math.max(p.z, q.z) - z0) / STEP - 0.5));
      for (let j = lo; j <= hi; j++) {
        const z = z0 + (j + 0.5) * STEP;
        if (p.z > z !== q.z > z) at[j - j0 + 1]!++;
      }
    }
    for (let r = 1; r <= rows; r++) at[r]! += at[r - 1]!;
    if (this.xs.length < at[rows]!) this.xs = new Float64Array(2 * at[rows]!);
    const xs = this.xs;
    for (let k = 0, m = ring.length - 1; k < ring.length; m = k++) {
      const p = ring[m]!;
      const q = ring[k]!;
      const lo = Math.max(j0, Math.ceil((Math.min(p.z, q.z) - z0) / STEP - 0.5));
      const hi = Math.min(j1, Math.floor((Math.max(p.z, q.z) - z0) / STEP - 0.5));
      for (let j = lo; j <= hi; j++) {
        const z = z0 + (j + 0.5) * STEP;
        if (p.z > z !== q.z > z) xs[at[j - j0]!++] = p.x + ((z - p.z) * (q.x - p.x)) / (q.z - p.z);
      }
    }
    let n = 0;
    for (let j = j0; j <= j1; j++) {
      const a = j > j0 ? at[j - j0 - 1]! : 0;
      const b = at[j - j0]!;
      if (b - a < 2) continue;
      if (b - a > 2) xs.subarray(a, b).sort();
      else if (xs[a]! > xs[a + 1]!) {
        const x = xs[a]!;
        xs[a] = xs[a + 1]!;
        xs[a + 1] = x;
      }
      for (let k = a; k + 1 < b; k += 2) {
        const i0 = Math.max(0, Math.ceil((xs[k]! - x0) / STEP - 0.5));
        const i1 = Math.min(this.nx - 1, Math.floor((xs[k + 1]! - x0) / STEP - 0.5));
        if (i1 < i0) continue;
        if (2 * n + 2 > this.runs.length) {
          const more = new Int32Array(2 * this.runs.length);
          more.set(this.runs);
          this.runs = more;
        }
        this.runs[2 * n] = j * this.nx + i0;
        this.runs[2 * n + 1] = j * this.nx + i1 + 1;
        n++;
      }
    }
    return n;
  }
  /**
   * Sets `to[k]` to `value` in the cells within `d` of the ring's edges, or in it, but where it is
   * `keep`; a cell already so is not measured.
   */
  private near(ring: readonly Pt[], d: number, to: Uint8Array, value: number, keep: number): void {
    if (ring.length >= 3) {
      const runs = this.scan(ring);
      for (let r = 0; r < runs; r++) for (let k = this.runs[2 * r]!; k < this.runs[2 * r + 1]!; k++) if (to[k] !== keep) to[k] = value;
    }
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
      // The squared distance decides where it is clearly in or out (a margin far over its rounding), `Math.hypot` where it is close.
      const [inner, outer] = [d * d * (1 - 1e-9), d * d * (1 + 1e-9)];
      for (let j = j0; j <= j1; j++) {
        const pz = this.rect.minZ + (j + 0.5) * STEP;
        for (let i = i0; i <= i1; i++) {
          const k = j * this.nx + i;
          if (to[k] === value || to[k] === keep) continue;
          // As `segmentGap`, the cell's centre inline.
          const px = this.rect.minX + (i + 0.5) * STEP;
          const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / len2));
          const ex = a.x + dx * t - px;
          const ez = a.z + dz * t - pz;
          const e2 = ex * ex + ez * ez;
          if (e2 <= inner || (e2 < outer && Math.hypot(ex, ez) <= d)) to[k] = value;
        }
      }
    }
  }
}
