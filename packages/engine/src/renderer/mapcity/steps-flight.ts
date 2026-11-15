import { STEP_NORM } from "@seki/core";

/**
 * A flight of steps by the norm (`STEP_NORM`, G-840), laid along a run from its low end: the
 * risers' places along the run and their one height. Treads between two risers of a run are all
 * the norm's tread for that riser; what the run is longer goes into its landings and the level
 * stretches at its foot and top, never into a tread.
 */
export interface Flight {
  /** Where each riser stands along the run from its low end (m), from the lowest up. */
  readonly at: readonly number[];
  /** The height of every riser (m). */
  readonly riser: number;
}

/** The ground is read every this along the run (m). */
const SAMPLE = 0.1;
/** How far a tread may stand over the ground and the flight still be taken without another landing (m). */
const FLOAT_OK = 0.3;
/** The strides tried, the norm's own first (m). */
const STRIDES = [STEP_NORM.stride, STEP_NORM.strideMax, (STEP_NORM.stride + STEP_NORM.strideMax) / 2, (STEP_NORM.stride + STEP_NORM.strideMin) / 2, STEP_NORM.strideMin];
/** The ground may rise this past a level before the riser up from it is due (m). */
const EPS = 0.005;

/** The risers to try for a rise `rise` (m): counts whose riser keeps the norm, the norm's own first; else the lowest riser of the norm, which ends a little over the top. */
const riserCounts = (rise: number): { n: number; r: number }[] => {
  const lo = Math.ceil(rise / STEP_NORM.riserMax - 1e-9);
  const hi = Math.floor(rise / STEP_NORM.riserMin + 1e-9);
  if (lo > hi) return [{ n: lo, r: STEP_NORM.riserMin }];
  const out: { n: number; r: number }[] = [];
  for (let n = Math.max(1, lo); n <= hi; n++) out.push({ n, r: rise / n });
  return out.sort((a, b) => Math.abs(a.r - STEP_NORM.riser) - Math.abs(b.r - STEP_NORM.riser));
};

/** `n` risers in `m` runs as even as they go, the longer ones lowest. */
const runSizes = (n: number, m: number): number[] => Array.from({ length: m }, (_, i) => Math.floor(n / m) + (i < n % m ? 1 : 0));

/**
 * The risers of `sizes` runs placed as late along the run as the ground lets them, so the treads
 * stand on or over it: the riser up from a level comes before the ground rises past that level
 * (`due`), the runs keep their treads and are a landing apart. Where the ground climbs too
 * steeply at the foot for that, the runs start at the foot and keep their spacing. Null when the
 * run is too short.
 */
const place = (sizes: readonly number[], s: number, length: number, due: readonly number[]): number[] | null => {
  const starts = new Array<number>(sizes.length);
  let first = 0;
  const firsts = sizes.map((k) => ((first += k), first - k));
  let limit = length;
  for (let g = sizes.length - 1; g >= 0; g--) {
    const k = sizes[g] as number;
    const a = firsts[g] as number;
    let start = limit - (k - 1) * s;
    for (let i = 0; i < k; i++) start = Math.min(start, (due[a + i] as number) - i * s);
    starts[g] = start;
    limit = start - STEP_NORM.landingMin;
  }
  if ((starts[0] as number) < 0) {
    let end = -Infinity;
    for (let g = 0; g < sizes.length; g++) {
      const start = Math.max(starts[g] as number, g === 0 ? 0 : end + STEP_NORM.landingMin);
      starts[g] = start;
      end = start + ((sizes[g] as number) - 1) * s;
    }
    if (end > length + 1e-9) return null;
  }
  return sizes.flatMap((k, g) => Array.from({ length: k }, (_, i) => (starts[g] as number) + i * s));
};

/** How far the flight `at` (risers `r`) stands off the ground `g` (sampled every `dt` from the foot): over it, or twice as much under it. */
const offGround = (at: readonly number[], r: number, g: readonly number[], dt: number): number => {
  let worst = 0;
  let j = 0;
  for (let i = 0; i < g.length; i++) {
    while (j < at.length && (at[j] as number) <= i * dt + 1e-9) j++;
    const d = j * r - (g[i] as number);
    worst = Math.max(worst, d, -2 * d);
  }
  return worst;
};

/**
 * The flight by the norm on a run `length` m long whose ground (`ground`, from the low end, along
 * the band's axis) rises from its foot to its top; null where it rises less than the norm's
 * lowest riser (the run lies as paving). Of the riser counts the norm allows, the one nearest its
 * riser first; of the ways to split them into runs of at most `maxRun`, the fewest landings whose
 * treads stand at most `FLOAT_OK` off the ground, else the closest; the treads by the norm's
 * stride, else by another the norm allows. A run too short for any gets its risers evenly.
 */
export const layFlight = (length: number, ground: (t: number) => number): Flight | null => {
  const steps = Math.max(1, Math.ceil(length / SAMPLE));
  const dt = length / steps;
  const g0 = ground(0);
  const g = Array.from({ length: steps + 1 }, (_, i) => ground(i * dt) - g0);
  const rise = g[steps] as number;
  if (rise < STEP_NORM.riserMin) return null;
  const counts = riserCounts(rise);
  let best: { at: number[]; r: number; off: number } | null = null;
  // The norm's stride first, then the others it allows: a longer tread on a run that climbs
  // gently follows it closer, a shorter one fits a steep run.
  for (const stride of STRIDES) {
    for (const { n, r } of counts) {
      const s = stride - 2 * r;
      // Where the ground rises past each level: the riser up from it is due there.
      const due: number[] = [];
      for (let j = 0, i = 0; j < n; j++) {
        while (i <= steps && (g[i] as number) <= j * r + EPS) i++;
        due.push(Math.min(length, i * dt));
      }
      // A landing takes the room of more than a tread: so many runs fit at most.
      const most = Math.min(n, Math.floor((length - n * s + STEP_NORM.landingMin) / (STEP_NORM.landingMin - s) + 1e-9));
      for (let m = Math.ceil(n / STEP_NORM.maxRun); m <= most; m++) {
        const at = place(runSizes(n, m), s, length, due);
        if (!at) continue;
        const off = offGround(at, r, g, dt);
        if (off <= FLOAT_OK) return { at, riser: r };
        if (!best || off < best.off - 1e-9) best = { at, r, off };
      }
    }
  }
  if (best) return { at: best.at, riser: best.r };
  const { n, r } = counts.reduce((a, b) => (b.n < a.n ? b : a));
  return { at: Array.from({ length: n }, (_, j) => ((j + 1) * length) / (n + 1)), riser: r };
};
