/**
 * A street of mapped `lanes` fitted to its separately mapped sidewalks (G-655): `lanes × 3.25 m`
 * lays the asphalt of Radziwiłłowska by Plac Litewski over the footway along its south kerb. Its
 * axis in OSM is off the middle of the real carriageway, so a fit to the nearer side on both
 * (T-046's) bares the other: the carriageway ends at the sidewalk on the side it runs along and
 * stays at half the width by `lanes` on the other, and only on the stretch it runs along.
 */
import { parseLength } from "./building-tags.ts";
import { type Line } from "./features.ts";
import { lineLength, offsetLine, sliceLine } from "./geometry.ts";
import { MIN_FITTED, isCarriageway, roadWidth } from "./ground.ts";
import { oneway } from "./markings.ts";

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
