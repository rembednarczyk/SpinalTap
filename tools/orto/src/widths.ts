/**
 * A carriageway's width measured on the orthophoto (ADR-0080 decision 2, source 2; PR 10): the
 * asphalt either side of the street's axis, read across it every `STATION` m.
 *
 * The cover's classes (ADR-0077) tell green, shade and crowns well, but not asphalt from paving:
 * their split is one brightness for the whole city (`pavingL`), and the sunlit asphalt of April
 * lies over it (of the measured streets' axes 84% are `paving`, 16% `asphalt`). So a station
 * takes its street's own asphalt for the reference: the median brightness and saturation of the
 * current image over `REF_HALF` m either side of the axis. A ray runs out from the axis each way;
 * a sample is the carriageway's while its colour stays within `TOL_L` and `TOL_S` of the
 * reference, and the kerb's side where it leaves them or the cover says green. The kerb is where
 * the kerb's side begins and goes on `CONFIRM` m; shorter, with the carriageway's colour past it,
 * it is a marking or a car and is crossed. A sample is dropped when:
 * - shade, crowns (`canopy`) or no image lie before the kerb is confirmed (the edge is not seen);
 * - no kerb lies within `reach` (a junction, a car park, a square);
 * - the reference itself is not one colour (`REF_SHARE`: a car or a shadow on the axis).
 * Stations near a junction (`JUNCTION_GAP`) or an end of the way are not read: there the asphalt
 * runs on round the corner. A side's kerb is the consensus of its stations: the most samples
 * within `CONSENSUS` m of each other, at least `MIN_SAMPLES` and `MIN_SHARE` of the stations (a
 * bay, a car or a pavement the colour of the asphalt scatters the rest). A side without one keeps
 * half the width the import estimates (its source stays `default`), so a street measured on one
 * side only is measured there. The way's width is the sum of its sides, kept only within `RATIO`
 * of the estimate. Pure and deterministic: the same image, cover and axes give the same table.
 */
import { type Pt, lineLength, pointAlong } from "../../osm-import/src/geometry.ts";
import { COVER } from "./classify.ts";

/** Distance between two stations along the axis (m), as the ADR's stations. */
export const STATION = 5;
/** Step of a ray across the street (m). */
export const RAY_STEP = 0.1;
/** The reference colour is read this far either side of the axis (m). */
export const REF_HALF = 1.5;
/** The share of the reference's samples within the tolerances: under it the axis is no one colour. */
export const REF_SHARE = 0.6;
/** A sample is the carriageway's within this brightness (0-255) and saturation of the reference. */
export const TOL_L = 22;
export const TOL_S = 0.08;
/** The kerb's side this long and more past the carriageway is its kerb (m): a car is under 2 m wide. */
export const CONFIRM = 2;
/** Or this long and more up to shade or crowns: the shade of the wall or the tree behind the pavement (m). */
export const CONFIRM_SHADED = 1;
/** No station this near a junction with another carriageway (m): the asphalt turns the corner there. */
export const JUNCTION_GAP = 8;
/** Nor this near a dead end of the way (m). */
export const END_GAP = 3;
export const MIN_SAMPLES = 3;
/** The kerb of a side: the most samples within a window this wide (m), the consensus of its stations. */
export const CONSENSUS = 1;
/** The consensus counts with this share of the side's stations and more: under it the side is a mix of things. */
export const MIN_SHARE = 0.4;
/** The measured width kept within these shares of the estimate. */
export const RATIO = { min: 0.5, max: 1.8 } as const;
/** How far past half the estimate a ray looks for the kerb (m). */
export const REACH_PAST = 6;

/** What the photograph shows at a point: the cover's class (`COVER`) and the current image's brightness and saturation; null without an image. */
export interface Look {
  readonly cls: number;
  readonly l: number;
  readonly s: number;
}
export type Probe = (x: number, z: number) => Look | null;

/** Where a ray found the kerb (m off the axis), or why it did not. */
export type RaySample = number | "uncertain" | "no-kerb";

/** The street's asphalt at a station: the median brightness and saturation on its axis. */
export interface Reference {
  readonly l: number;
  readonly s: number;
}

/** What a sample is: the carriageway's (`road`), the kerb's side (`kerb`), or not seen (`unseen`). */
type Kind = "road" | "kerb" | "unseen";

const GREEN = new Set<number>([COVER.green]);
const UNSEEN = new Set<number>([COVER.none, COVER.shadow, COVER.canopy]);

export const kindOf = (look: Look | null, ref: Reference): Kind => {
  if (!look || UNSEEN.has(look.cls)) return "unseen";
  if (GREEN.has(look.cls)) return "kerb";
  return Math.abs(look.l - ref.l) <= TOL_L && Math.abs(look.s - ref.s) <= TOL_S ? "road" : "kerb";
};

const median = (xs: number[]): number => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

/** The reference at `p` across `n` (unit), or null when the axis is not one colour or not seen. */
export const referenceAt = (probe: Probe, p: Pt, n: Pt): Reference | null => {
  const looks: Look[] = [];
  const k = Math.round(REF_HALF / RAY_STEP);
  for (let i = -k; i <= k; i++) {
    const look = probe(p.x + n.x * i * RAY_STEP, p.z + n.z * i * RAY_STEP);
    if (look && !UNSEEN.has(look.cls) && !GREEN.has(look.cls)) looks.push(look);
  }
  if (looks.length < REF_SHARE * (2 * k + 1)) return null;
  const ref = { l: median(looks.map((x) => x.l)), s: median(looks.map((x) => x.s)) };
  return looks.filter((x) => kindOf(x, ref) === "road").length >= REF_SHARE * (2 * k + 1) ? ref : null;
};

/**
 * The asphalt's reach from `p` along the unit vector `n` (`RaySample`): where the kerb's side begins
 * and goes on `CONFIRM` m (between its first sample and the last of the asphalt), within `reach`.
 */
export const rayKerb = (probe: Probe, ref: Reference, p: Pt, n: Pt, reach: number): RaySample => {
  const steps = Math.round(reach / RAY_STEP);
  const confirm = Math.round(CONFIRM / RAY_STEP);
  const edge = (k: number) => Math.round(Math.max(0, k - 0.5) * RAY_STEP * 100) / 100;
  const kind = (k: number) => kindOf(probe(p.x + n.x * k * RAY_STEP, p.z + n.z * k * RAY_STEP), ref);
  for (let k = 0; k <= steps; k++) {
    const c = kind(k);
    if (c === "road") continue;
    if (c === "unseen") return "uncertain";
    // The kerb's side from k on: the kerb if it goes on `CONFIRM`, a marking or a car if the carriageway comes back sooner.
    let run = 1;
    let back = false;
    for (; run < confirm; run++) {
      const d = kind(k + run);
      if (d === "unseen") return run >= Math.round(CONFIRM_SHADED / RAY_STEP) ? edge(k) : "uncertain";
      if (d === "road") {
        back = true;
        break;
      }
    }
    if (!back) return edge(k);
    k += run - 1;
  }
  return "no-kerb";
};

/** One side's samples and their summary: the median of the consensus (`agree` samples), null without one. */
export interface SideMeasure {
  readonly stations: number;
  readonly kept: number;
  readonly uncertain: number;
  readonly noKerb: number;
  readonly agree: number;
  readonly median: number | null;
}

/**
 * A way's measure: both sides (left of the axis' direction first) and the width, null when not
 * kept, with why: `ok` both sides measured, `one-side` one (the other half the estimate).
 */
export interface WayMeasure {
  readonly left: SideMeasure;
  readonly right: SideMeasure;
  readonly width: number | null;
  readonly reason: "ok" | "one-side" | "few-stations" | "no-consensus" | "off-estimate";
}

/** The samples (sorted) in the window `CONSENSUS` wide holding the most of them, the lowest such window on a tie. */
export const consensusOf = (sorted: readonly number[]): readonly number[] => {
  let [best, from] = [0, 0];
  for (let i = 0, j = 0; i < sorted.length; i++) {
    while (j < sorted.length && sorted[j]! <= sorted[i]! + CONSENSUS + 1e-9) j++;
    if (j - i > best) [best, from] = [j - i, i];
  }
  return sorted.slice(from, from + best);
};

export const sideOf = (samples: readonly RaySample[]): SideMeasure => {
  const kept = samples.filter((s): s is number => typeof s === "number").sort((a, b) => a - b);
  const agree = consensusOf(kept);
  const enough = agree.length >= MIN_SAMPLES && agree.length >= MIN_SHARE * samples.length;
  return {
    stations: samples.length,
    kept: kept.length,
    uncertain: samples.filter((s) => s === "uncertain").length,
    noKerb: samples.filter((s) => s === "no-kerb").length,
    agree: agree.length,
    median: enough ? agree[Math.floor((agree.length - 1) / 2)]! : null,
  };
};

/** The arc lengths of the stations of an axis `length` m long: every `STATION` m from half a station in, clear of the ends and of the junctions (`blocked`). */
export const stationsOf = (length: number, blocked: (s: number) => boolean): number[] => {
  const out: number[] = [];
  for (let s = STATION / 2; s <= length - STATION / 2 + 1e-9; s += STATION) if (s >= END_GAP && s <= length - END_GAP && !blocked(s)) out.push(Math.round(s * 100) / 100);
  return out;
};

/**
 * The width of the carriageway along `axis` on the photograph (`probe`), against the `estimate` the
 * import would lay (m), clear of the `junctions` (points where another carriageway meets it), and
 * no narrower than `least` (m: the lanes the street keeps, as `fitLanes`'s).
 */
export const measureWay = (probe: Probe, axis: readonly Pt[], estimate: number, junctions: readonly Pt[], least = 0): WayMeasure => {
  const length = lineLength(axis);
  const near = (s: number) => {
    const p = pointAlong(axis, s);
    return junctions.some((j) => Math.hypot(j.x - p.x, j.z - p.z) < JUNCTION_GAP);
  };
  const reach = estimate / 2 + REACH_PAST;
  const left: RaySample[] = [];
  const right: RaySample[] = [];
  for (const s of stationsOf(length, near)) {
    const p = pointAlong(axis, s);
    // Off the photograph (past the map's cells): no station.
    if (!probe(p.x, p.z)) continue;
    const [a, b] = [pointAlong(axis, Math.max(0, s - 0.5)), pointAlong(axis, Math.min(length, s + 0.5))];
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const n = { x: -(b.z - a.z) / l, z: (b.x - a.x) / l };
    const ref = referenceAt(probe, p, n);
    left.push(ref ? rayKerb(probe, ref, p, n, reach) : "uncertain");
    right.push(ref ? rayKerb(probe, ref, p, { x: -n.x, z: -n.z }, reach) : "uncertain");
  }
  const [L, R] = [sideOf(left), sideOf(right)];
  const out = (reason: WayMeasure["reason"], width: number | null = null): WayMeasure => ({ left: L, right: R, width, reason });
  if (left.length < MIN_SAMPLES) return out("few-stations");
  if (L.median === null && R.median === null) return out("no-consensus");
  const width = Math.round(((L.median ?? estimate / 2) + (R.median ?? estimate / 2)) * 10) / 10;
  if (width < Math.max(least, RATIO.min * estimate) || width > RATIO.max * estimate) return out("off-estimate");
  return out(L.median !== null && R.median !== null ? "ok" : "one-side", width);
};
