/**
 * Samples of a line anchored in the world (G-756): the scan's sampled kinds are keyed by their
 * 10 m square (`scan-keys.ts`), so where a sample falls must not hang on anything but the map
 * round it. A sample every `step` metres from a lane's start, or from an edge's first corner,
 * moves all along the lane when one of its points moves, and squares far from the change gain
 * or lose their finding. Here a line is cut where it crosses the world's grid lines x = k·step
 * and z = k·step, and each piece is sampled at its middle: a piece lies in one cell of the grid,
 * so its sample hangs only on the line within that cell.
 */

type Pt = { readonly x: number; readonly z: number };

/** A piece of a line between the world's grid lines: its middle, its length, and its middle's arc length along the line. */
export interface LinePiece {
  readonly x: number;
  readonly z: number;
  readonly len: number;
  readonly s: number;
}

/** Where (0..1 along the segment from `p` by `d`) it crosses the grid lines `k·step`, its ends left out. */
const crossings = (p: number, d: number, step: number, out: number[]) => {
  if (Math.abs(d) < 1e-12) return;
  const [lo, hi] = [Math.min(p, p + d), Math.max(p, p + d)];
  for (let k = Math.floor(lo / step) + 1; k * step < hi; k++) out.push((k * step - p) / d);
};

/** The pieces of the segment a→b between the grid lines; `s0` the arc length at `a`. */
export const segmentPieces = (a: Pt, b: Pt, step: number, s0 = 0): LinePiece[] => {
  const [dx, dz] = [b.x - a.x, b.z - a.z];
  const len = Math.hypot(dx, dz);
  if (len < 1e-9) return [];
  const ts = [0, 1];
  crossings(a.x, dx, step, ts);
  crossings(a.z, dz, step, ts);
  ts.sort((p, q) => p - q);
  const out: LinePiece[] = [];
  for (let i = 0; i + 1 < ts.length; i++) {
    const [t0, t1] = [ts[i]!, ts[i + 1]!];
    if ((t1 - t0) * len < 1e-9) continue;
    const m = (t0 + t1) / 2;
    out.push({ x: a.x + dx * m, z: a.z + dz * m, len: (t1 - t0) * len, s: s0 + m * len });
  }
  return out;
};

/** The pieces of a polyline (a ring with `closed`) between the grid lines, in order along it. */
export const pathPieces = (pts: readonly Pt[], step: number, closed = false): LinePiece[] => {
  const out: LinePiece[] = [];
  let s = 0;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const [a, b] = [pts[i]!, pts[(i + 1) % pts.length]!];
    out.push(...segmentPieces(a, b, step, s));
    s += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return out;
};

/** A lane's pieces (its points as `[x, z]`), as `pathPieces`. */
export const lanePieces = (pts: readonly (readonly [number, number])[], step: number): LinePiece[] =>
  pathPieces(
    pts.map(([x, z]) => ({ x, z })),
    step,
  );
