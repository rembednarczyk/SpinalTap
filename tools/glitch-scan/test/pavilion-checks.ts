import { PAVILION_CENTRE, PAVILION_LADDER, PAVILION_OUTLINE, PAVILION_PROPS } from "../../../packages/sim/src/content/alchemia";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";

/**
 * The glitch scan's checks of ADR-0074 stage 3: the triangular pavilion on the corner of
 * Bajkowskiego and Lubartowska, between two sidewalks.
 */

type Finding = { readonly at: string; readonly what: string };
type GroundPoint = { readonly x: number; readonly z: number };
type P3 = { readonly x: number; readonly y: number; readonly z: number };

const near = (x: number, z: number) => `${x.toFixed(0)},${z.toFixed(0)}`;

/** A solid as a convex prism of world corners (counter-clockwise or not) between two heights. */
export interface WorldPrism {
  readonly points: readonly GroundPoint[];
  readonly bottom: number;
  readonly top: number;
}

/** The pavilion's solids (its triangle, annex, attic and sign) in world metres. */
export const pavilionPrisms = (): WorldPrism[] => {
  const solid = PAVILION_PROPS.find((p) => p.solid && p.prisms)!;
  return solid.prisms!.map((q) => ({ points: q.points.map((p) => ({ x: p.x + solid.center.x, z: p.z + solid.center.z })), bottom: q.bottom + solid.center.y, top: q.top + solid.center.y }));
};

/** Does the segment from a to b pass through the prism (Cyrus-Beck against its sides, then its heights)? */
export const segmentHitsPrism = (a: P3, b: P3, q: WorldPrism): boolean => {
  let lo = 0;
  let hi = 1;
  const pts = q.points;
  let area = 0;
  pts.forEach((p, i) => {
    const r = pts[(i + 1) % pts.length]!;
    area += p.x * r.z - r.x * p.z;
  });
  const sign = area >= 0 ? 1 : -1;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const r = pts[(i + 1) % pts.length]!;
    // Inside is left of every side of a counter-clockwise outline: f(t) = num + den * t >= 0.
    const side = (x: number, z: number) => sign * ((r.x - p.x) * (z - p.z) - (r.z - p.z) * (x - p.x));
    const num = side(a.x, a.z);
    const den = side(b.x, b.z) - num;
    if (Math.abs(den) < 1e-12) {
      if (num < 0) return false;
      continue;
    }
    const t = -num / den;
    if (den > 0) lo = Math.max(lo, t);
    else hi = Math.min(hi, t);
    if (lo > hi) return false;
  }
  const dy = b.y - a.y;
  if (Math.abs(dy) < 1e-12) return a.y >= q.bottom && a.y <= q.top;
  const t0 = (q.bottom - a.y) / dy;
  const t1 = (q.top - a.y) / dy;
  lo = Math.max(lo, Math.min(t0, t1));
  hi = Math.min(hi, Math.max(t0, t1));
  return lo <= hi;
};

/** What `pavilion-on-paving` looks at: the pavilion's outline and ladder foot, the map's sidewalks (axes and half widths), paved areas and streets' axes. */
export interface PavingInputs {
  readonly outline: readonly GroundPoint[];
  readonly foot: GroundPoint;
  readonly walks: readonly { readonly line: readonly GroundPoint[]; readonly half: number }[];
  readonly paved: readonly (readonly GroundPoint[])[];
  readonly streets: readonly (readonly GroundPoint[])[];
}

/** Clear of a sidewalk's paving, of a carriageway's axis (half its width and a hand's breadth). */
const MARGIN = 0.3;
const CARRIAGEWAY = 4;

const toSegment = (p: GroundPoint, a: GroundPoint, b: GroundPoint): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
};

const toLine = (p: GroundPoint, line: readonly GroundPoint[]): number => {
  let d = Infinity;
  for (let i = 0; i + 1 < line.length; i++) d = Math.min(d, toSegment(p, line[i]!, line[i + 1]!));
  return d;
};

const inRing = (p: GroundPoint, ring: readonly GroundPoint[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};

/** Points along the outline every 0.25 m. */
const along = (outline: readonly GroundPoint[]): GroundPoint[] =>
  outline.flatMap((a, i) => {
    const b = outline[(i + 1) % outline.length]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.25));
    return Array.from({ length: n }, (_, k) => ({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n }));
  });

/**
 * `pavilion-on-paving` (ADR-0074 stage 3): the pavilion between Bajkowskiego's and Lubartowska's
 * sidewalks stands off their paving by a hand's breadth (0.3 m), off every paved area of the map
 * (sidewalks, crossings) and off the carriageways, and the foot of its ladder is on open ground,
 * not on a sidewalk. One finding per way it reaches. Baseline 0.
 */
export const pavilionOnPaving = (k: PavingInputs): Finding[] => {
  const pts = along(k.outline);
  const out: Finding[] = [];
  k.walks.forEach((w, i) => {
    const hit = pts.find((p) => toLine(p, w.line) < w.half + MARGIN);
    if (hit) out.push({ at: near(hit.x, hit.z), what: `the pavilion ${(toLine(hit, w.line) - w.half).toFixed(2)} m off the paving of sidewalk ${i}` });
  });
  k.paved.forEach((ring, i) => {
    const hit = pts.find((p) => inRing(p, ring));
    if (hit) out.push({ at: near(hit.x, hit.z), what: `the pavilion's side on paved area ${i}` });
  });
  k.streets.forEach((line, i) => {
    const hit = pts.find((p) => toLine(p, line) < CARRIAGEWAY);
    if (hit) out.push({ at: near(hit.x, hit.z), what: `the pavilion ${toLine(hit, line).toFixed(1)} m off street axis ${i}` });
  });
  if (k.walks.some((w) => toLine(k.foot, w.line) < w.half) || k.paved.some((r) => inRing(k.foot, r))) out.push({ at: near(k.foot.x, k.foot.z), what: "the pavilion's ladder foot on a sidewalk" });
  return out;
};

const flat = (f: readonly number[]): GroundPoint[] => {
  const out: GroundPoint[] = [];
  for (let i = 0; i + 1 < f.length; i += 2) out.push({ x: f[i]!, z: f[i + 1]! });
  return out;
};

/** The map round the pavilion (60 m), as the game has it. */
export const pavingInGame = (): PavingInputs => {
  const c = PAVILION_CENTRE;
  const close = (pts: readonly GroundPoint[]) => pts.some((p) => Math.hypot(p.x - c.x, p.z - c.z) < 60);
  return {
    outline: PAVILION_OUTLINE,
    foot: PAVILION_LADDER,
    walks: MAP_CHUNKS.flatMap((ch) => (ch.footWays ?? []).map((w) => ({ line: flat(w.line), half: w.width / 2 }))).filter((w) => close(w.line)),
    paved: MAP_CHUNKS.flatMap((ch) => ch.ground.filter((g) => g.surface === "footway" || g.surface === "crossing").map((g) => flat(g.outline))).filter(close),
    streets: MAP_CHUNKS.flatMap((ch) => ch.streets.map((s) => flat(s.line))).filter(close),
  };
};
