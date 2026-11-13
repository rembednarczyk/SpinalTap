import { segmentDistance } from "../../../packages/core/src";
import { MAX_WALK_SLOPE } from "../../../packages/sim/src/world/ground";
import { walkBoth } from "../../../packages/sim/src/world/walk";

/**
 * The ways of the map data along which `walk-blocked` counts a way through (ADR-0080, point 5):
 * a walker goes along a street or a path, not across the bank beside it within its strip. A
 * blocked pair of the raster is a finding only within its reach of a stretch of a way's axis
 * that is itself blocked along the way: a ledge between two samples 0.25 m apart (`walkBoth`), or
 * a grade over `MAX_WALK_SLOPE` (tg 35°) over `AXIS_RUN` (2 m) of it. Not the ways closed to the
 * walkers (`access=no`), nor the flights of steps (`highway=steps`, their own checks), nor the
 * ways under the ground (`groundY` is not their floor).
 */

type Pt = { readonly x: number; readonly z: number };

/** A way of the map data: its tags and its axis in the world's metres. */
export interface WalkWay {
  readonly tags: Readonly<Record<string, string>>;
  readonly line: readonly Pt[];
}

/** A blocked stretch of an axis: between two samples, and how far off it a blocked pair is its finding. */
export interface Stretch {
  readonly a: Pt;
  readonly b: Pt;
  readonly reach: number;
}

/** The axis's samples (m). */
export const AXIS_STEP = 0.25;
/** How far off a blocked stretch of a path's axis a blocked pair is a finding (m): the curator's 0.6 m. */
export const AXIS_REACH = 0.6;
/** The run of the axis its grade is taken over (m). */
export const AXIS_RUN = 2;

/** Under the ground, where `groundY` is not its floor: a tunnel, a culvert, below layer 0, indoors. */
const underground = (t: WalkWay["tags"]) => t.tunnel === "yes" || t.tunnel === "culvert" || t.indoor === "yes" || Number(t.layer ?? 0) < 0 || t.location === "underground";

/** A way a walker goes along: a `highway` line, not an area, not closed to them, not steps, not under the ground. */
export const walkedWay = (t: WalkWay["tags"]): boolean => t.highway !== undefined && t.highway !== "steps" && t.area !== "yes" && t.access !== "no" && !underground(t);

/** A way's axis every `AXIS_STEP` metres or closer, its points kept, with the distance along it. */
const samples = (line: readonly Pt[]): { p: Pt; s: number }[] => {
  const out: { p: Pt; s: number }[] = line.length ? [{ p: line[0]!, s: 0 }] : [];
  let s = 0;
  for (let k = 1; k < line.length; k++) {
    const [a, b] = [line[k - 1]!, line[k]!];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(len / AXIS_STEP));
    for (let i = 1; i <= n; i++) out.push({ p: { x: a.x + ((b.x - a.x) * i) / n, z: a.z + ((b.z - a.z) * i) / n }, s: s + (len * i) / n });
    s += len;
  }
  return out;
};

/**
 * The stretches of the ways' axes a walker does not get along, as pieces between two samples.
 * `height` is the ground the game walks, NaN off the map: a stretch with a sample off it is none.
 * `reach` is how far off its axis a way's own ground goes, at least `AXIS_REACH`.
 */
export const blockedStretches = (ways: readonly WalkWay[], height: (x: number, z: number) => number, reach: (t: WalkWay["tags"]) => number = () => AXIS_REACH): Stretch[] => {
  const out: Stretch[] = [];
  for (const w of ways) {
    if (!walkedWay(w.tags)) continue;
    const pts = samples(w.line);
    const ys = pts.map(({ p }) => height(p.x, p.z));
    const blocked = new Uint8Array(Math.max(0, pts.length - 1));
    let m = 0;
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = ys[k]!;
      if (walkBoth({ y: a, slope: 0, flight: false }, { y: ys[k + 1]!, slope: 0, flight: false })) blocked[k] = 1;
      // The grade over the next `AXIS_RUN` metres: to the first sample that far on.
      m = Math.max(m, k + 1);
      while (m < pts.length - 1 && pts[m]!.s - pts[k]!.s < AXIS_RUN - 1e-9) m++;
      const run = pts[m]!.s - pts[k]!.s;
      if (run >= AXIS_RUN - 1e-9 && Math.abs(ys[m]! - a) / run > MAX_WALK_SLOPE) blocked.fill(1, k, m);
    }
    const r = Math.max(AXIS_REACH, reach(w.tags));
    for (let k = 0; k < blocked.length; k++) if (blocked[k]) out.push({ a: pts[k]!.p, b: pts[k + 1]!.p, reach: r });
  }
  return out;
};

/** Is (x, z) within its reach of one of the stretches? Indexed by 1 m squares. */
export const nearStretches = (stretches: readonly Stretch[]): ((x: number, z: number) => boolean) => {
  const index = new Map<string, Stretch[]>();
  for (const st of stretches) {
    const { a, b, reach } = st;
    for (let i = Math.floor(Math.min(a.x, b.x) - reach); i <= Math.floor(Math.max(a.x, b.x) + reach); i++) {
      for (let k = Math.floor(Math.min(a.z, b.z) - reach); k <= Math.floor(Math.max(a.z, b.z) + reach); k++) {
        const key = `${i}:${k}`;
        const list = index.get(key);
        if (list) list.push(st);
        else index.set(key, [st]);
      }
    }
  }
  return (x, z) => (index.get(`${Math.floor(x)}:${Math.floor(z)}`) ?? []).some(({ a, b, reach }) => segmentDistance(x, z, a.x, a.z, b.x, b.z) <= reach);
};
