import { BARRIER_OPENINGS, segmentDistance } from "@seki/core";
import { MAP_CHUNKS } from "./lublin/sites";
import { SegmentGrid, sineOf } from "./segment-grid";
import { BODY_RADIUS, WALKER_SIDE } from "./walker-size";

/**
 * The squares' and the alleys' loops off the map's barriers running along them (G-613). An
 * alley's loop is its footway's band edge, and a band 2.5 m wide drawn round a path mapped 1.7 m
 * from a wall (Podwale's w56965511 under the Archikatedra's retaining wall w67626198) has its
 * edge 0.45 m from the wall: the barriers' cuts (`barrier-room.ts`) then take the wall away
 * along the route. The loop is moved in, towards the band's middle, to `ALONG_ROOM` off a solid
 * barrier's line; a barrier crossing the loop is cut where it crosses, as before.
 */

type Pt = readonly [number, number];

/** A loop keeps this far from a barrier along it (m): a walker's side and its body, and a margin over the cuts' room for a route along a barrier (0.7 m). */
const ALONG_ROOM = WALKER_SIDE + BODY_RADIUS + 0.34;
/** A barrier this far into the loop still counts (m): half a footway's band, the band drawn across a wall mapped nearer its axis. */
const INSIDE_REACH = 1.25;
/**
 * Along: a barrier at under 45 degrees to the loop. Wider than the cuts' 30 degrees for a crossing,
 * so a loop turning a corner by a wall (the band's end at the map's edge, T-049) moves in too.
 */
const ALONG_SINE = 0.71;

const solid = new SegmentGrid();
for (const c of MAP_CHUNKS) {
  for (const b of c.barriers ?? []) {
    if (BARRIER_OPENINGS.has(b.kind)) continue;
    for (let i = 2; i + 1 < b.line.length; i += 2) {
      const a = { x: b.line[i - 2] as number, z: b.line[i - 1] as number };
      const q = { x: b.line[i] as number, z: b.line[i + 1] as number };
      solid.add(a, q);
    }
  }
}

/**
 * How far to move (x, z) along the loop's inward normal (nx, nz) so that every barrier along the
 * loop within reach lies `ALONG_ROOM` behind it; 0 when none needs it.
 */
const shiftAt = (x: number, z: number, nx: number, nz: number): number => {
  let need = 0;
  const reach = INSIDE_REACH + ALONG_ROOM;
  solid.eachNear(x, z, (a, b) => {
    if (x < Math.min(a.x, b.x) - reach || x > Math.max(a.x, b.x) + reach || z < Math.min(a.z, b.z) - reach || z > Math.max(a.z, b.z) + reach) return;
    // The loop runs at right angles to its normal.
    if (Math.abs(sineOf({ x: -nz, z: nx }, { x: b.x - a.x, z: b.z - a.z })) >= ALONG_SINE) return;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    // Where the barrier is: ahead of the point into the loop (+) or behind it, out of the loop (-).
    const s = Math.sign((a.x + dx * t - x) * nx + (a.z + dz * t - z) * nz) * segmentDistance(x, z, a.x, a.z, b.x, b.z);
    if (s > -ALONG_ROOM && s < INSIDE_REACH) need = Math.max(need, s + ALONG_ROOM);
  });
  return need;
};

/** A closed loop resampled at most a metre apart. */
const resample = (loop: readonly Pt[]): Pt[] => {
  const dense: Pt[] = [];
  for (let i = 0; i < loop.length; i++) {
    const [ax, az] = loop[i] as Pt;
    const [bx, bz] = loop[(i + 1) % loop.length] as Pt;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az)));
    for (let k = 0; k < n; k++) dense.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  return dense;
};

/** Each point of a loop moved in off the barriers along it, its normal from its neighbours; `ccw` for a counter-clockwise loop. */
const pushIn = (pts: readonly Pt[], ccw: boolean): Pt[] =>
  pts.map(([x, z], i) => {
    const [px, pz] = pts[(i + pts.length - 1) % pts.length] as Pt;
    const [qx, qz] = pts[(i + 1) % pts.length] as Pt;
    const len = Math.hypot(qx - px, qz - pz) || 1;
    // Left of the way round (+X east, +Z north) is (-dz, dx): the inside of a counter-clockwise loop.
    const nx = ((ccw ? -1 : 1) * (qz - pz)) / len;
    const nz = ((ccw ? 1 : -1) * (qx - px)) / len;
    const k = shiftAt(x, z, nx, nz);
    return [Math.round((x + nx * k) * 100) / 100, Math.round((z + nz * k) * 100) / 100] as const;
  });

/** Where the segments a..b and c..d cross, strictly inside both; null when they do not. */
const crossing = (a: Pt, b: Pt, c: Pt, d: Pt): Pt | null => {
  const rx = b[0] - a[0];
  const rz = b[1] - a[1];
  const sx = d[0] - c[0];
  const sz = d[1] - c[1];
  const den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * sz - (c[1] - a[1]) * sx) / den;
  const u = ((c[0] - a[0]) * rz - (c[1] - a[1]) * rx) / den;
  return t > 0 && t < 1 && u > 0 && u < 1 ? [Math.round((a[0] + rx * t) * 100) / 100, Math.round((a[1] + rz * t) * 100) / 100] : null;
};

/**
 * A moved loop without the little loops of its own the moving makes (G-613): at a sharp bend, or
 * where both sides of a narrow band's end move in past each other, two stretches cross; the
 * shorter way round between the crossing goes, the crossing point stays. Only segments with a
 * moved end are tried, so an untouched loop costs nothing.
 */
/** Cells of this size (m) bucket a loop's segments for the crossing test. */
const LOOP_CELL = 4;

/** The cells a segment's box touches. */
const cellsOf = (a: Pt, b: Pt): string[] => {
  const out: string[] = [];
  for (let i = Math.floor(Math.min(a[0], b[0]) / LOOP_CELL); i <= Math.floor(Math.max(a[0], b[0]) / LOOP_CELL); i++) {
    for (let k = Math.floor(Math.min(a[1], b[1]) / LOOP_CELL); k <= Math.floor(Math.max(a[1], b[1]) / LOOP_CELL); k++) out.push(`${i}:${k}`);
  }
  return out;
};

/** The first crossing of a segment with a moved end and another segment of the loop, not its neighbour. */
const firstCrossing = (pts: readonly Pt[], flags: readonly boolean[]): { i: number; j: number; at: Pt } | null => {
  const n = pts.length;
  const cells = new Map<string, number[]>();
  for (let j = 0; j < n; j++) {
    for (const key of cellsOf(pts[j] as Pt, pts[(j + 1) % n] as Pt)) {
      const list = cells.get(key);
      if (list) list.push(j);
      else cells.set(key, [j]);
    }
  }
  for (let i = 0; i < n; i++) {
    if (!flags[i] && !flags[(i + 1) % n]) continue;
    const [a, b] = [pts[i] as Pt, pts[(i + 1) % n] as Pt];
    for (const key of cellsOf(a, b)) {
      for (const j of cells.get(key) ?? []) {
        if (Math.abs(i - j) < 2 || Math.abs(i - j) === n - 1) continue;
        const at = crossing(a, b, pts[j] as Pt, pts[(j + 1) % n] as Pt);
        if (at) return { i: Math.min(i, j), j: Math.max(i, j), at };
      }
    }
  }
  return null;
};

/**
 * A moved loop without the little loops of its own the moving makes (G-613): at a sharp bend, or
 * where both sides of a narrow band's end move in past each other, two stretches cross; the
 * shorter way round between the crossing goes, the crossing point stays. Only segments with a
 * moved end are tried, so an untouched loop costs nothing.
 */
const unloop = (loop: readonly Pt[], moved: readonly boolean[]): Pt[] => {
  if (!moved.some(Boolean)) return [...loop];
  let pts = [...loop];
  let flags = [...moved];
  for (let guard = 0; guard < 64; guard++) {
    const cut = firstCrossing(pts, flags);
    if (!cut) return pts;
    const { i, j, at } = cut;
    const n = pts.length;
    // Points i+1..j make one way round between the two segments, the rest the other.
    if (j - i <= n - (j - i)) {
      pts = [...pts.slice(0, i + 1), at, ...pts.slice(j + 1)];
      flags = [...flags.slice(0, i + 1), true, ...flags.slice(j + 1)];
    } else {
      pts = [at, ...pts.slice(i + 1, j + 1)];
      flags = [true, ...flags.slice(i + 1, j + 1)];
    }
  }
  return pts;
};

/**
 * A square's or an alley's loop moved in off the barriers along it: resampled every metre, each
 * sample moved in, then smoothed once and moved again, so the walk bends in where a wall begins
 * instead of stepping; the loop as it was where no sample needs it.
 */
export const offBarriers = (loop: readonly Pt[]): Pt[] => {
  const dense = resample(loop);
  const area = dense.reduce((s, p, i) => {
    const q = dense[(i + 1) % dense.length] as Pt;
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0);
  const ccw = area > 0;
  const once = pushIn(dense, ccw);
  if (!once.some((p, i) => Math.hypot(p[0] - (dense[i] as Pt)[0], p[1] - (dense[i] as Pt)[1]) > 0.01)) return [...loop];
  const smooth = once.map((p, i) => {
    const a = once[(i + once.length - 1) % once.length] as Pt;
    const b = once[(i + 1) % once.length] as Pt;
    return [(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4] as const;
  });
  const twice = pushIn(smooth, ccw);
  return unloop(
    twice,
    twice.map((p, i) => Math.hypot(p[0] - (dense[i] as Pt)[0], p[1] - (dense[i] as Pt)[1]) > 0.01),
  );
};
