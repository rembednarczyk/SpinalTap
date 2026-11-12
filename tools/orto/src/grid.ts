/**
 * Binary masks on a world grid for the cell report's sections (`sections.ts`): rings rasterised at
 * the samples' middles, the overlap of two masks under a shift (image registration by IoU), the
 * morphological opening by a square, 4-connected components and the chessboard depth of a sample
 * in its mask. Pure functions on `Uint8Array`s, row 0 the north edge as the cover raster's.
 */
import { type Pt, type Rect } from "../../osm-import/src/geometry.ts";
import { samplesIn } from "./rings.ts";

/** A grid in world metres: west edge of column 0, north edge of row 0, the sample's side. */
export interface Grid {
  readonly x0: number;
  readonly z1: number;
  readonly step: number;
  readonly width: number;
  readonly height: number;
}

/** The grid over `rect` grown by `margin`, at `step`. */
export const gridOver = (rect: Rect, step: number, margin = 0): Grid => ({
  x0: rect.minX - margin,
  z1: rect.maxZ + margin,
  step,
  width: Math.round((rect.maxX - rect.minX + 2 * margin) / step),
  height: Math.round((rect.maxZ - rect.minZ + 2 * margin) / step),
});

export const centreOf = (g: Grid, k: number): Pt => ({ x: g.x0 + ((k % g.width) + 0.5) * g.step, z: g.z1 - (Math.floor(k / g.width) + 0.5) * g.step });

/** The sample holding (x, z), or -1 off the grid. */
export const sampleAt = (g: Grid, x: number, z: number): number => {
  const col = Math.floor((x - g.x0) / g.step);
  const row = Math.floor((g.z1 - z) / g.step);
  return col < 0 || row < 0 || col >= g.width || row >= g.height ? -1 : row * g.width + col;
};

/** 1 where a sample's middle lies in one of the rings. */
export const ringMask = (g: Grid, rings: readonly (readonly Pt[])[]): Uint8Array => {
  const m = new Uint8Array(g.width * g.height);
  for (const r of rings) for (const k of samplesIn(g, r)) m[k] = 1;
  return m;
};

/** 1 for the samples of `rect` (their middles in it). */
export const rectMask = (g: Grid, rect: Rect): Uint8Array => {
  const m = new Uint8Array(g.width * g.height);
  for (let row = 0; row < g.height; row++)
    for (let col = 0; col < g.width; col++) {
      const x = g.x0 + (col + 0.5) * g.step;
      const z = g.z1 - (row + 0.5) * g.step;
      if (x >= rect.minX && x < rect.maxX && z >= rect.minZ && z < rect.maxZ) m[row * g.width + col] = 1;
    }
  return m;
};

/** 1 within `half` samples (a square) of the rings' edges: the outlines drawn as lines. */
export const outlineMask = (g: Grid, rings: readonly (readonly Pt[])[], half = 1): Uint8Array => {
  const m = new Uint8Array(g.width * g.height);
  const along = g.step / 2;
  for (const r of rings)
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [a, b] = [r[j]!, r[i]!];
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / along));
      for (let s = 0; s <= n; s++) {
        const col = Math.floor((a.x + ((b.x - a.x) * s) / n - g.x0) / g.step);
        const row = Math.floor((g.z1 - (a.z + ((b.z - a.z) * s) / n)) / g.step);
        for (let dr = -half; dr <= half; dr++)
          for (let dc = -half; dc <= half; dc++) {
            const [rr, cc] = [row + dr, col + dc];
            if (rr >= 0 && cc >= 0 && rr < g.height && cc < g.width) m[rr * g.width + cc] = 1;
          }
      }
    }
  return m;
};

export interface Overlap {
  /** Shift of `b` in metres (east, north): `b` sampled at a + (dx, dz). */
  readonly dx: number;
  readonly dz: number;
  readonly iou: number;
}

/**
 * IoU of `a` and `b` shifted by (di, dj) samples (east, south) over the samples of `window`:
 * a's sample k against b's sample at k + (di, dj); off the grid counts as empty.
 */
export const iouAt = (g: Grid, a: Uint8Array, b: Uint8Array, window: Uint8Array, di: number, dj: number): number => {
  let inter = 0;
  let union = 0;
  for (let row = 0; row < g.height; row++) {
    const rb = row + dj;
    for (let col = 0; col < g.width; col++) {
      const k = row * g.width + col;
      if (!window[k]) continue;
      const cb = col + di;
      const vb = rb >= 0 && rb < g.height && cb >= 0 && cb < g.width ? b[rb * g.width + cb]! : 0;
      const va = a[k]!;
      inter += va & vb;
      union += va | vb;
    }
  }
  return union ? inter / union : 0;
};

/** The IoU at (0; 0) and the best one over shifts of `b` up to `range` metres each way. */
export const bestOverlap = (g: Grid, a: Uint8Array, b: Uint8Array, window: Uint8Array, range: number): { readonly zero: number; readonly best: Overlap } => {
  const n = Math.round(range / g.step);
  const zero = iouAt(g, a, b, window, 0, 0);
  let best: Overlap = { dx: 0, dz: 0, iou: zero };
  for (let dj = -n; dj <= n; dj++)
    for (let di = -n; di <= n; di++) {
      const v = iouAt(g, a, b, window, di, dj);
      // Ties keep the smaller shift: the (0; 0) of a cell that fits.
      if (v > best.iou + 1e-12) best = { dx: di * g.step + 0, dz: -dj * g.step + 0, iou: v };
    }
  return { zero, best };
};

/** Erosion (`erode`) or dilation by a square of `r` samples each way; off the grid is empty. */
const byWindow = (g: Grid, m: Uint8Array, r: number, erode: boolean): Uint8Array => {
  const [w, h] = [g.width, g.height];
  const pass = (src: Uint8Array, horizontal: boolean): Uint8Array => {
    const out = new Uint8Array(src.length);
    for (let row = 0; row < h; row++)
      for (let col = 0; col < w; col++) {
        let v = erode ? 1 : 0;
        for (let d = -r; d <= r && v === (erode ? 1 : 0); d++) {
          const [rr, cc] = horizontal ? [row, col + d] : [row + d, col];
          const s = rr >= 0 && cc >= 0 && rr < h && cc < w ? src[rr * w + cc]! : 0;
          v = erode ? v & s : v | s;
        }
        out[row * w + col] = v;
      }
    return out;
  };
  return pass(pass(m, true), false);
};

/** The opening by a square of `r` samples each way: erosion then dilation, strips narrower than the square drop out. */
export const opening = (g: Grid, m: Uint8Array, r: number): Uint8Array => (r > 0 ? byWindow(g, byWindow(g, m, r, true), r, false) : m.slice());

/** 4-connected components of a mask: the samples of each, in scan order. */
export const components = (g: Grid, m: Uint8Array): number[][] => {
  const seen = new Uint8Array(m.length);
  const out: number[][] = [];
  for (let k = 0; k < m.length; k++) {
    if (!m[k] || seen[k]) continue;
    const comp: number[] = [];
    const stack = [k];
    seen[k] = 1;
    while (stack.length) {
      const q = stack.pop()!;
      comp.push(q);
      for (const n of neighbours(g, q)) if (m[n] && !seen[n]) {
        seen[n] = 1;
        stack.push(n);
      }
    }
    out.push(comp);
  }
  return out;
};

/** The 4 neighbours of a sample on the grid. */
export const neighbours = (g: Grid, k: number): number[] => {
  const [col, row] = [k % g.width, Math.floor(k / g.width)];
  const out: number[] = [];
  if (col + 1 < g.width) out.push(k + 1);
  if (col > 0) out.push(k - 1);
  if (row + 1 < g.height) out.push(k + g.width);
  if (row > 0) out.push(k - g.width);
  return out;
};

/** The 4 steps (dcol, drow) in the order of `neighbours`. */
export const STEPS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** The deepest sample of a set: how many 4-steps from outside it (1 at its edge), by two chamfer passes. */
export const depthOf = (g: Grid, samples: readonly number[]): number => {
  if (!samples.length) return 0;
  const cols = samples.map((k) => k % g.width);
  const rows = samples.map((k) => Math.floor(k / g.width));
  const [c0, r0] = [Math.min(...cols), Math.min(...rows)];
  const [w, h] = [Math.max(...cols) - c0 + 3, Math.max(...rows) - r0 + 3];
  const d = new Int32Array(w * h);
  for (const k of samples) d[(Math.floor(k / g.width) - r0 + 1) * w + ((k % g.width) - c0 + 1)] = 1 << 20;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (d[y * w + x]) d[y * w + x] = Math.min(d[y * w + x]!, d[(y - 1) * w + x]! + 1, d[y * w + x - 1]! + 1);
  let deepest = 0;
  for (let y = h - 2; y > 0; y--)
    for (let x = w - 2; x > 0; x--) {
      if (!d[y * w + x]) continue;
      d[y * w + x] = Math.min(d[y * w + x]!, d[(y + 1) * w + x]! + 1, d[y * w + x + 1]! + 1);
      deepest = Math.max(deepest, d[y * w + x]!);
    }
  return deepest;
};
