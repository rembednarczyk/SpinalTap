import { MAP_CHUNKS } from "./lublin/sites";

/**
 * The crowd off the kerbs' parking strips (`amenity=parking`, `parking=lane|street_side`, G-177).
 * A footway's band drawn beside a strip ends on the strip's outer edge, the kerb the cars park
 * by, and a square's or an alley's loop is that band's edge: its walkers would walk the cars'
 * strip. The loop is moved onto the pavement instead, `KERB_PARK_REACH` off the strip's outline.
 */

type Pt = readonly [number, number];

/**
 * How far off a kerb car park's outline a loop is drawn (m): a walker keeps `LANE_HALF_GAP`
 * (0.28 m) to its side of the line, so the two ways walk 0.7–1.3 m off the kerb, about the axis
 * of a 2.5 m footway beside it (Kowalska's w173566577, 1.25 m off the strip).
 */
const KERB_PARK_REACH = 1;
/** A loop's point this much nearer the outline than `KERB_PARK_REACH` is on the strip (m): what pushing it out leaves of rounding. */
const SLACK = 0.1;

const KERB_STRIPS = [...new Map(MAP_CHUNKS.flatMap((c) => c.carParks ?? []).map((p) => [p.id, p])).values()]
  .filter((p) => p.kind === "lane" || p.kind === "street_side")
  .map((p) => {
    const ring = Array.from({ length: p.outline.length / 2 }, (_, i): Pt => [p.outline[2 * i]!, p.outline[2 * i + 1]!]);
    const xs = ring.map((q) => q[0]);
    const zs = ring.map((q) => q[1]);
    const m = KERB_PARK_REACH + 1;
    return { ring, minX: Math.min(...xs) - m, maxX: Math.max(...xs) + m, minZ: Math.min(...zs) - m, maxZ: Math.max(...zs) + m };
  });

const inRing = (x: number, z: number, ring: readonly Pt[]): boolean => {
  let on = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i]!;
    const [bx, bz] = ring[j]!;
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) on = !on;
  }
  return on;
};

/** The point of a ring's outline nearest (x, z), how far it is, and the outline's way there. */
const nearestOnRing = (x: number, z: number, ring: readonly Pt[]) => {
  let best = { x: 0, z: 0, d: Infinity, tx: 1, tz: 0 };
  ring.forEach(([ax, az], i) => {
    const [bx, bz] = ring[(i + 1) % ring.length]!;
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / (len * len)));
    const q = { x: ax + (bx - ax) * t, z: az + (bz - az) * t };
    const d = Math.hypot(q.x - x, q.z - z);
    if (d < best.d) best = { ...q, d, tx: (bx - ax) / len, tz: (bz - az) / len };
  });
  return best;
};

const near = (s: (typeof KERB_STRIPS)[number], x: number, z: number) => x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ;

/** Is (x, z) in a kerb car park, or nearer its outline than a loop is drawn? */
export const onKerbPark = (x: number, z: number): boolean =>
  KERB_STRIPS.some((s) => near(s, x, z) && (inRing(x, z, s.ring) || nearestOnRing(x, z, s.ring).d < KERB_PARK_REACH - SLACK));

/** A point pushed out of every kerb car park it is in or too near, straight away from the nearest stretch of its outline. */
const pushOff = (p: Pt): Pt => {
  let [x, z] = p;
  for (const s of KERB_STRIPS) {
    if (!near(s, x, z)) continue;
    const inside = inRing(x, z, s.ring);
    const q = nearestOnRing(x, z, s.ring);
    if (!inside && q.d >= KERB_PARK_REACH) continue;
    // Outside, straight away from its nearest point (round a corner too); inside, out across the nearest stretch, on the side of its normal off the ring.
    const [nx, nz] =
      !inside && q.d > 1e-3 ? [(x - q.x) / q.d, (z - q.z) / q.d] : inRing(q.x - q.tz * 0.05, q.z + q.tx * 0.05, s.ring) ? [q.tz, -q.tx] : [-q.tz, q.tx];
    x = q.x + nx * KERB_PARK_REACH;
    z = q.z + nz * KERB_PARK_REACH;
  }
  return [Math.round(x * 100) / 100, Math.round(z * 100) / 100];
};

/** A closed loop resampled at most `step` apart. */
const resample = (loop: readonly Pt[], step: number): Pt[] => {
  const dense: Pt[] = [];
  for (let i = 0; i < loop.length; i++) {
    const [ax, az] = loop[i]!;
    const [bx, bz] = loop[(i + 1) % loop.length]!;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 0; k < n; k++) dense.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  return dense;
};

/**
 * A loop moved off the kerb car parks: resampled every half metre, each sample pushed out to
 * `KERB_PARK_REACH`, twice, as samples pushed round a strip's corner spread apart and the chord
 * between two cuts the corner; the loop as it was where no sample needs it.
 */
export const offKerbParks = (loop: readonly Pt[]): Pt[] => {
  const dense = resample(loop, 0.5);
  const once = dense.map(pushOff);
  if (!once.some((p, i) => Math.hypot(p[0] - dense[i]![0], p[1] - dense[i]![1]) > 0.01)) return [...loop];
  return resample(once, 0.5).map(pushOff);
};
