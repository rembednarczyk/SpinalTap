/**
 * The kerb rows round the corners of the squares (G-820 P5, Plac Wolności, GSV 2025): by a square
 * the row of each street runs on to the other carriageway (`gapsOf` grows no `CORNER` there), and
 * the two rows meeting at the square's corner join along the curve of its kerb, posts evenly over it,
 * none in a zebra's band or a mouth. The curve: from the end of one row to the end of the other,
 * bent towards the point their lines meet (a quadratic Bézier), each point pushed off the carriageway
 * onto the paving and `KERB_SET` on.
 */
import type { Pt } from "./geometry.ts";
import { KERB_SET, type KerbLine, type KerbSample } from "./props-kerb-lines.ts";

/** The farthest apart two rows' ends join round a corner (m), and the sharpest and gentlest turn between them. */
export const CORNER_REACH = 15;
const TURN_MIN = Math.cos((150 * Math.PI) / 180);
const TURN_MAX = Math.cos((30 * Math.PI) / 180);
/** Samples back into a row its way out is read over (2 m). */
const TANGENT = 8;

/** An end of a row by a junction: its last sample, the way on out of the row, its line. */
export interface CornerEnd {
  readonly s: KerbSample;
  readonly dir: Pt;
  readonly line: string;
  /** By a square: the paving behind it one, or its street a square's frontage (`isSquareStreet`). */
  readonly square: boolean;
}

/**
 * A street that is a square's frontage: Lublin names them `Plac …` (Plac Wolności, Plac Łokietka),
 * where OSM draws the square itself as plain footway areas, not `place=square`.
 */
export const isSquareStreet = (line: Pick<KerbLine, "name">): boolean => /^Plac /.test(line.name);

/** What the corners read of the rule: the ground, whether a sample borders a square, and why no post stands somewhere. */
export interface CornerWorld {
  readonly isRoad: (p: Pt) => boolean;
  readonly bySquare: (s: KerbSample) => boolean;
  readonly blocked: (s: KerbSample, along: Pt) => boolean;
}

const unit = (v: Pt): Pt => {
  const l = Math.hypot(v.x, v.z) || 1;
  return { x: v.x / l, z: v.z / l };
};

/** The ends of a line's rows next to a junction (`road` or `corner` before or after). */
export const cornerEnds = (w: CornerWorld, line: KerbLine, gaps: readonly (string | null)[]): CornerEnd[] => {
  const { samples } = line;
  const junction = (g: string | null | undefined) => g === "road" || g === "corner" || g === "crossing";
  // The way out of the row, from `TANGENT` samples back in it: the kerb line wavers where the ground's edge does by a junction.
  const out: CornerEnd[] = [];
  const back = (i: number, step: -1 | 1): Pt => {
    let j = i;
    for (let k = 0; k < TANGENT && gaps[j - step] === null && samples[j - step]; k++) j -= step;
    return unit({ x: samples[i]!.p.x - samples[j]!.p.x, z: samples[i]!.p.z - samples[j]!.p.z });
  };
  samples.forEach((s, i) => {
    if (gaps[i] !== null) return;
    const square = isSquareStreet(line) || w.bySquare(s);
    if (i > 0 && junction(gaps[i - 1])) out.push({ s, dir: back(i, -1), line: line.id, square });
    if (i + 1 < samples.length && junction(gaps[i + 1])) out.push({ s, dir: back(i, 1), line: line.id, square });
  });
  return out.filter((e) => e.dir.x !== 0 || e.dir.z !== 0);
};

/** The ends paired round corners: the nearest first, of two lines, one by a square, each heading to the other, turning 30–150°. */
export const cornerPairs = (ends: readonly CornerEnd[]): [CornerEnd, CornerEnd][] => {
  const cands: [number, number, number][] = [];
  ends.forEach((a, i) =>
    ends.forEach((b, j) => {
      if (j <= i || a.line === b.line || !(a.square || b.square)) return;
      const d = Math.hypot(b.s.p.x - a.s.p.x, b.s.p.z - a.s.p.z);
      if (d < 1 || d > CORNER_REACH) return;
      const ab = unit({ x: b.s.p.x - a.s.p.x, z: b.s.p.z - a.s.p.z });
      const turn = a.dir.x * -b.dir.x + a.dir.z * -b.dir.z;
      if (a.dir.x * ab.x + a.dir.z * ab.z <= 0 || -(b.dir.x * ab.x + b.dir.z * ab.z) <= 0 || turn < TURN_MIN || turn > TURN_MAX) return;
      cands.push([d, i, j]);
    }),
  );
  cands.sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2]);
  const used = new Set<number>();
  const out: [CornerEnd, CornerEnd][] = [];
  for (const [, i, j] of cands) {
    if (used.has(i) || used.has(j)) continue;
    used.add(i);
    used.add(j);
    out.push([ends[i]!, ends[j]!]);
  }
  return out;
};

/** Where the rays from a and b along their ways meet, or null (parallel, or behind either). */
const meet = (a: CornerEnd, b: CornerEnd): Pt | null => {
  const den = a.dir.x * b.dir.z - a.dir.z * b.dir.x;
  if (Math.abs(den) < 1e-6) return null;
  const dx = b.s.p.x - a.s.p.x;
  const dz = b.s.p.z - a.s.p.z;
  const t = (dx * b.dir.z - dz * b.dir.x) / den;
  const u = (dx * a.dir.z - dz * a.dir.x) / den;
  return t > 0 && u > 0 && t < CORNER_REACH && u < CORNER_REACH ? { x: a.s.p.x + a.dir.x * t, z: a.s.p.z + a.dir.z * t } : null;
};

/** The curve of a corner's kerb row, `KERB_SET` on the paving, every 0.25 m or so; empty when the rows' lines do not meet. */
export const cornerCurve = (w: CornerWorld, a: CornerEnd, b: CornerEnd): KerbSample[] => {
  const c = meet(a, b);
  if (!c) return [];
  const mid = { x: (a.s.p.x + b.s.p.x) / 2, z: (a.s.p.z + b.s.p.z) / 2 };
  const inward = unit({ x: mid.x - c.x, z: mid.z - c.z });
  const rough = Math.hypot(c.x - a.s.p.x, c.z - a.s.p.z) + Math.hypot(b.s.p.x - c.x, b.s.p.z - c.z);
  const n = Math.max(2, Math.ceil(rough / 0.25));
  const out: KerbSample[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    let p = { x: (1 - t) ** 2 * a.s.p.x + 2 * t * (1 - t) * c.x + t * t * b.s.p.x, z: (1 - t) ** 2 * a.s.p.z + 2 * t * (1 - t) * c.z + t * t * b.s.p.z };
    // Off the carriageway onto the paving, the kerb line's `KERB_SET` past its edge.
    let moved = 0;
    while (w.isRoad(p) && moved < 6) {
      p = { x: p.x + inward.x * 0.1, z: p.z + inward.z * 0.1 };
      moved += 0.1;
    }
    if (moved > 0) p = { x: p.x + inward.x * KERB_SET, z: p.z + inward.z * KERB_SET };
    const last = out[out.length - 1];
    const kerb = { x: p.x - inward.x * KERB_SET, z: p.z - inward.z * KERB_SET };
    out.push({ p, kerb, out: inward, half: a.s.half, arc: last ? last.arc + Math.hypot(p.x - last.p.x, p.z - last.p.z) : 0 });
  }
  return out;
};

/**
 * The posts round a corner: evenly over the curve and the half metre either way to the rows' last
 * posts (`GAP_INSET` off their ends), about `spacing` apart, none where `blocked` (a zebra, a mouth).
 */
export const cornerPosts = (w: CornerWorld, curve: readonly KerbSample[], spacing: number, inset: number): Pt[] => {
  if (curve.length < 2) return [];
  const len = curve[curve.length - 1]!.arc;
  const n = Math.max(1, Math.round((len + 2 * inset) / spacing));
  const out: Pt[] = [];
  for (let k = 1; k < n; k++) {
    const arc = -inset + ((len + 2 * inset) * k) / n;
    if (arc < 0 || arc > len) continue;
    const i = curve.findIndex((s) => s.arc >= arc);
    const s = curve[Math.max(0, i)]!;
    const prev = curve[Math.max(0, i - 1)]!;
    const along = unit({ x: s.p.x - prev.p.x, z: s.p.z - prev.p.z });
    if (!w.blocked(s, along)) out.push(s.p);
  }
  return out;
};
