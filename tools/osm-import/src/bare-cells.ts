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
    // Each edge's crossings of the rows' centre lines, row by row: counted, then laid out a row after another.
    const rows = j1 - j0 + 1;
    const at = grown(SCAN, "at", rows + 1, Int32Array);
    at.fill(0, 0, rows + 1);
    const { minX: x0, minZ: z0 } = this.rect;
    for (let pass = 0; pass < 2; pass++) {
      const xs = pass === 0 ? null : grown(SCAN, "xs", at[rows]!, Float64Array);
      for (let k = 0, m = ring.length - 1; k < ring.length; m = k++) {
        const p = ring[m]!;
        const q = ring[k]!;
        const lo = Math.max(j0, Math.ceil((Math.min(p.z, q.z) - z0) / STEP - 0.5));
        const hi = Math.min(j1, Math.floor((Math.max(p.z, q.z) - z0) / STEP - 0.5));
        for (let j = lo; j <= hi; j++) {
          const z = z0 + (j + 0.5) * STEP;
          if (p.z > z === q.z > z) continue;
          if (xs) xs[at[j - j0]!++] = p.x + ((z - p.z) * (q.x - p.x)) / (q.z - p.z);
          else at[j - j0 + 1]!++;
        }
      }
      // Counts to where each row begins; the second pass leaves each where the next row begins.
      if (pass === 0) for (let r = 0; r < rows; r++) at[r + 1]! += at[r]!;
      else for (let r = rows; r > 0; r--) at[r] = at[r - 1]!;
      if (pass === 1) at[0] = 0;
    }
    const xs = SCAN.xs;
    let n = 0;
    for (let j = j0; j <= j1; j++) {
      const [from, to] = [at[j - j0]!, at[j - j0 + 1]!];
      if (to - from < 2) continue;
      sortRun(xs, from, to);
      for (let k = from; k + 1 < to; k += 2) {
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
      const [a, c] = [ring[e]!, ring[(e + 1) % ring.length]!];
      nearEdge(to, value, keep, this.nx, this.nz, this.rect, a.x, a.z, c.x, c.z, d);
    }
  }
}

/** Buffers of `scan`, reused from ring to ring. */
const SCAN = { at: new Int32Array(64), xs: new Float64Array(256) };

/** `pool[key]`, grown to `n` and more when short. */
const grown = <K extends keyof typeof SCAN>(pool: typeof SCAN, key: K, n: number, make: new (n: number) => (typeof SCAN)[K]): (typeof SCAN)[K] => {
  if (pool[key].length < n) pool[key] = new make(Math.max(n, 2 * pool[key].length));
  return pool[key];
};

/** Sorts `xs` from `from` to past `to` ascending: a row's crossings, mostly two. */
const sortRun = (xs: Float64Array, from: number, to: number): void => {
  for (let k = from + 1; k < to; k++) {
    const x = xs[k]!;
    let m = k - 1;
    for (; m >= from && xs[m]! > x; m--) xs[m + 1] = xs[m]!;
    xs[m + 1] = x;
  }
};

/**
 * Sets `to[k]` to `value` in the cells of the raster (`nx` by `nz` on `rect`) within `d` of the edge
 * from (ax, az) to (cx, cz), but where it is `keep` or `value` already (those are not measured).
 */
const nearEdge = (to: Uint8Array, value: number, keep: number, nx: number, nz: number, rect: Rect, ax: number, az: number, cx: number, cz: number, d: number): void => {
  const i0 = Math.max(0, Math.floor((Math.min(ax, cx) - d - rect.minX) / STEP));
  const i1 = Math.min(nx - 1, Math.ceil((Math.max(ax, cx) + d - rect.minX) / STEP));
  const j0 = Math.max(0, Math.floor((Math.min(az, cz) - d - rect.minZ) / STEP));
  const j1 = Math.min(nz - 1, Math.ceil((Math.max(az, cz) + d - rect.minZ) / STEP));
  const dx = cx - ax;
  const dz = cz - az;
  const len2 = dx * dx + dz * dz || 1;
  for (let j = j0; j <= j1; j++) {
    const pz = rect.minZ + (j + 0.5) * STEP;
    for (let i = i0; i <= i1; i++) {
      const k = j * nx + i;
      if (to[k] === value || to[k] === keep) continue;
      // As `segmentGap`, the cell's centre inline.
      const px = rect.minX + (i + 0.5) * STEP;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
      if (Math.hypot(ax + dx * t - px, az + dz * t - pz) <= d) to[k] = value;
    }
  }
};
