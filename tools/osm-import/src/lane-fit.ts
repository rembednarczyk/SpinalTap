/**
 * A street of mapped `lanes` fitted to its separately mapped sidewalks (G-655): `lanes × 3.25 m`
 * lays the asphalt of Radziwiłłowska by Plac Litewski over the footway along its south kerb. Its
 * axis in OSM is off the middle of the real carriageway, so a fit to the nearer side on both
 * (T-046's) bares the other: the carriageway ends at the sidewalk on the side it runs along and
 * stays at half the width by `lanes` on the other, and only on the stretch it runs along.
 */
import { parseLength } from "./building-tags.ts";
import { type Line } from "./features.ts";
import { type Pt, lineLength, offsetLine, pointAlong, sliceLine } from "./geometry.ts";
import { MIN_FITTED, isCarriageway, roadWidth } from "./ground.ts";
import { type Marking, oneway } from "./markings.ts";

/** The lines that run along the lanes, which a fitted street's pieces carry on from each other. */
const LANE_LINES = new Set(["centre-dash", "centre-double", "lane-dash"]);

/** A sample along a street: its arc length, and how far off the axis the asphalt may reach on its left and right (Infinity: as far as it likes). */
export interface KerbSample {
  readonly at: number;
  readonly kerb: readonly [number, number];
}

/** The narrowest lane a fitted street keeps, metres: as the two of a two-way street (T-063), so the markings paint them all. */
const MIN_LANE = 2.25;

/** A stretch of one side along which a sidewalk runs: its arc lengths and the median reach. */
interface Run {
  readonly side: number;
  readonly from: number;
  readonly to: number;
  readonly reach: number;
}

/**
 * The runs of `min` samples and more in a row with a sidewalk on `side`, each from its first sample
 * to its last (the street's end where it reaches it): past them the sidewalk turns off, and the
 * kerb's fill (G-570) closes what lies between. None unless it runs along half the street and more,
 * as `sidewalkIndex.kerb` reads it: a sidewalk turning in to a crossing at a junction says nothing
 * of the rest of the street (T-062).
 */
const runsOf = (samples: readonly KerbSample[], side: number, length: number, min: number): Run[] => {
  const out: Run[] = [];
  if (samples.filter((s) => Number.isFinite(s.kerb[side])).length * 2 < samples.length) return out;
  for (let i = 0; i < samples.length; ) {
    if (!Number.isFinite(samples[i]!.kerb[side])) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < samples.length && Number.isFinite(samples[j + 1]!.kerb[side])) j++;
    if (j - i + 1 >= min) {
      const reach = samples.slice(i, j + 1).map((s) => s.kerb[side]!).sort((a, b) => a - b)[Math.floor((j - i + 1) / 2)]!;
      const from = i === 0 ? 0 : samples[i]!.at;
      const to = j + 1 === samples.length ? length : samples[j]!.at;
      out.push({ side, from, to, reach });
    }
    i = j + 1;
  }
  return out;
};

/**
 * The carriageway of a street of mapped `lanes`, cut where a sidewalk begins or ends along a side
 * (`min` samples in a row and more, as `sidewalkIndex.kerb`'s): a piece with a sidewalk ends at
 * it on that side and at half the width by `lanes` on a side without; its axis moves to the
 * middle of the two, its width goes to `width:carriageway` (so its bands, markings and zebras read
 * it) and its `lanes` keep `MIN_LANE` each. A piece without one is the street as the map has it.
 * Null when no sidewalk runs along it, on a bridge, or when the map gives its width.
 */
export const fitLanes = (road: Line, samples: readonly KerbSample[], min: number): Line[] | null => {
  const t = road.tags;
  const lanes = Math.round(Number(t.lanes));
  // A bridge's deck reaches its abutment as one (G-344).
  if (!(lanes > 0) || !isCarriageway(t) || (t.bridge !== undefined && t.bridge !== "no") || parseLength(t.width ?? t["width:carriageway"]) !== null) return null;
  const length = lineLength(road.line);
  const runs = [0, 1].flatMap((side) => runsOf(samples, side, length, min));
  if (runs.length === 0) return null;
  const half = roadWidth(t) / 2;
  const least = Math.max(oneway(t) ? MIN_FITTED.oneway : MIN_FITTED.twoWay, lanes * MIN_LANE);
  const cuts = [...new Set([0, length, ...runs.flatMap((r) => [r.from, r.to])])].sort((a, b) => a - b);
  const pieces: Line[] = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const [from, to] = [cuts[k]!, cuts[k + 1]!];
    if (to - from < 0.05) continue;
    const reach = [0, 1].map((side) => Math.min(half, runs.find((r) => r.side === side && r.from <= from && r.to >= to)?.reach ?? half));
    const line = sliceLine(road.line, from, to);
    if (reach[0] === half && reach[1] === half) {
      pieces.push({ ...road, line });
      continue;
    }
    // Too narrow for its lanes: widened evenly on both sides.
    const short = Math.max(0, least - reach[0]! - reach[1]!) / 2;
    const [left, right] = [reach[0]! + short, reach[1]! + short];
    const w = Math.round((left + right) * 10) / 10;
    // The rounding of the width goes to the fitted side: the other stays where the map's width has it.
    const offset = reach[0] === half ? left - w / 2 : reach[1] === half ? w / 2 - right : (left - right) / 2;
    pieces.push({ ...road, tags: { ...t, "width:carriageway": String(w) }, line: offsetLine(line, Math.round(offset * 100) / 100) });
  }
  return pieces;
};


/**
 * The length over which a lane line shifts where a fitted street's piece meets the next, metres
 * (G-675): 0.8 m over 10 m, as the shifting taper of a lane on a town street, not a step.
 */
const TAPER = 10;
/** A line of the same kind starting this near the end of one, going on the same way, is that line going on (m): under the narrowest lane. */
const SAME_LINE = 1.5;

/** An end of a marking's line: which marking, which end, where, and the direction out of the line through it. */
interface LineEnd {
  readonly m: number;
  readonly atEnd: boolean;
  readonly p: Pt;
  readonly ux: number;
  readonly uz: number;
}

const endsOf = (line: readonly Pt[], m: number): LineEnd[] =>
  [false, true].flatMap((atEnd) => {
    const [p, q] = atEnd ? [line[line.length - 1]!, line[line.length - 2]!] : [line[0]!, line[1]!];
    const l = Math.hypot(p.x - q.x, p.z - q.z);
    return l < 1e-6 ? [] : [{ m, atEnd, p, ux: (p.x - q.x) / l, uz: (p.z - q.z) / l }];
  });

/** `line` with one end shifted by `v`, the shift running out linearly over `h` metres back along it. */
const shiftEnd = (line: readonly Pt[], v: Pt, h: number, atEnd: boolean): Pt[] => {
  const ordered = atEnd ? [...line].reverse() : [...line];
  const out: Pt[] = [];
  let s = 0;
  for (let i = 0; i < ordered.length; i++) {
    if (i > 0) s += Math.hypot(ordered[i]!.x - ordered[i - 1]!.x, ordered[i]!.z - ordered[i - 1]!.z);
    if (s >= h) {
      if (s > h) out.push(pointAlong(ordered, h));
      out.push(...ordered.slice(i));
      break;
    }
    out.push({ x: ordered[i]!.x + v.x * (1 - s / h), z: ordered[i]!.z + v.z * (1 - s / h) });
  }
  return atEnd ? out.reverse() : out;
};

/**
 * The carriageways' markings (G-675) with each centre and lane line of a fitted street's piece
 * (`fitted`: the streets' ids) meeting the line of its kind going on from it, the next piece's or
 * the next way's, at the middle of the two: each shifts there over half a `TAPER` (half of either
 * line at most), as the paint does where a street narrows, and not in the step of the pieces' axes
 * `fitLanes` moves. The rest as they are, in their order.
 */
export const taperedJoins = (markings: readonly Marking[], fitted: ReadonlySet<string>): Marking[] => {
  const out = [...markings];
  const ends = markings.flatMap((m, i) => (LANE_LINES.has(m.kind) && m.line.length >= 2 ? endsOf(m.line, i) : []));
  const pairs: { a: LineEnd; b: LineEnd; d: number }[] = [];
  for (const a of ends) {
    if (!fitted.has(markings[a.m]!.source)) continue;
    for (const b of ends) {
      if (b.m === a.m || markings[b.m]!.kind !== markings[a.m]!.kind || a.ux * b.ux + a.uz * b.uz > -0.9) continue;
      const d = Math.hypot(b.p.x - a.p.x, b.p.z - a.p.z);
      if (d > 0.01 && d < SAME_LINE) pairs.push({ a, b, d });
    }
  }
  const used = new Set<string>();
  const key = (e: LineEnd) => `${e.m}:${e.atEnd}`;
  for (const { a, b } of pairs.sort((p, q) => p.d - q.d)) {
    if (used.has(key(a)) || used.has(key(b))) continue;
    used.add(key(a)).add(key(b));
    const h = Math.min(TAPER / 2, lineLength(markings[a.m]!.line) / 2, lineLength(markings[b.m]!.line) / 2);
    const v = { x: (b.p.x - a.p.x) / 2, z: (b.p.z - a.p.z) / 2 };
    out[a.m] = { ...out[a.m]!, line: shiftEnd(out[a.m]!.line, v, h, a.atEnd) };
    out[b.m] = { ...out[b.m]!, line: shiftEnd(out[b.m]!.line, { x: -v.x, z: -v.z }, h, b.atEnd) };
  }
  return out;
};
