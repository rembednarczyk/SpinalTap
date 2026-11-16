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
/** What a landing more, or a stride off the norm's own, weighs against a tread's standing over the ground (m). */
const PREFER = 0.01;
/** The least riser a run's mapped `step_count` is laid by (m): lower, a row of dark lines on the slope (G-018, `steps-micro-riser`). */
const MIN_COUNTED = 0.045;
/** The strides tried (m), the bounds' a few millimetres in: a riser's place is read to the millimetre. */
const STRIDES = [STEP_NORM.stride, STEP_NORM.strideMax - 0.005, (STEP_NORM.stride + STEP_NORM.strideMax) / 2, (STEP_NORM.stride + STEP_NORM.strideMin) / 2, STEP_NORM.strideMin + 0.005];
/**
 * How far a tread may lie under the ground along the band's axis (m), less its lift: the ground
 * may rise this past a level before the riser up from it is due.
 */
const EPS = 0.02;

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

/**
 * How far the flight `at` (risers `r`) stands over the ground `g` (sampled every `dt` from the
 * foot) at most, or null where a tread lies more than `EPS` under it: the terrain would show
 * through the treads.
 */
const offGround = (at: readonly number[], r: number, g: readonly number[], dt: number): number | null => {
  let worst = 0;
  let j = 0;
  let lag = 0;
  for (let i = 0; i < g.length; i++) {
    while (j < at.length && (at[j] as number) <= i * dt + 1e-9) j++;
    // Under: against the level a sample before, so the ground between two samples stays under the tread too.
    while (lag < at.length && (at[lag] as number) <= (i - 1) * dt + 1e-9) lag++;
    if (lag * r - (g[i] as number) < -EPS - 1e-9) return null;
    worst = Math.max(worst, j * r - (g[i] as number));
  }
  return worst;
};

/** Where the ground `g` (every `dt`) rises past each of `n` levels `r` apart: the riser up from it is due there. */
const dueAt = (g: readonly number[], dt: number, n: number, r: number, length: number): number[] => {
  const due: number[] = [];
  for (let j = 0, i = 0; j < n; j++) {
    while (i < g.length && (g[i] as number) <= j * r + EPS) i++;
    // At the last sample still under the level: between it and the next the ground may pass it.
    due.push(Math.max(0, Math.min(length, (i - 1) * dt)));
  }
  return due;
};

type Laid = { readonly at: number[]; readonly r: number; readonly off: number };

/** The closest over the ground of the flights of `counts` by the norm's strides, split into runs of at most `maxRun` a landing apart, or one run of them all (`oneRun`). */
const byNorm = (counts: readonly { n: number; r: number }[], g: readonly number[], dt: number, length: number, oneRun = false): Laid | null => {
  let best: Laid | null = null;
  // A longer tread follows a run that climbs gently closer, a shorter one fits a steep run.
  for (const stride of STRIDES) {
    for (const { n, r } of counts) {
      const s = stride - 2 * r;
      const due = dueAt(g, dt, n, r, length);
      // A landing takes the room of more than a tread: so many runs fit at most.
      const most = Math.min(n, Math.floor((length - n * s + STEP_NORM.landingMin) / (STEP_NORM.landingMin - s) + 1e-9));
      for (let m = oneRun ? 1 : Math.ceil(n / STEP_NORM.maxRun); m <= (oneRun ? Math.min(1, most) : most); m++) {
        const at = place(runSizes(n, m), s, length, due);
        const over = at && offGround(at, r, g, dt);
        if (!at || over === null) continue;
        const off = over + PREFER * (m - 1 + (stride === STEP_NORM.stride ? 0 : 1));
        if (!best || off < best.off - 1e-9) best = { at, r, off };
      }
    }
  }
  return best;
};

/**
 * The `n` risers of a run whose map counts them (`step_count`, G-840), all its treads alike
 * `length / n` deep, the flight shifted along it as far as the ground lets it, closest over it; null where it sinks into the ground wherever it stands.
 */
const evenly = (n: number, r: number, g: readonly number[], dt: number, length: number): Laid | null => {
  const s = length / n;
  let best: Laid | null = null;
  for (let k = 0; k <= 10; k++) {
    const at = Array.from({ length: n }, (_, j) => (j + k / 10) * s);
    const off = offGround(at, r, g, dt);
    if (off !== null && (!best || off < best.off - 1e-9)) best = { at, r, off };
  }
  return best;
};

/**
 * The flight a run gets on a rise `rise` from the steps its map counts (`osm`, G-840): all of
 * them in one flight, no landing every `maxRun`; treads alike over the whole run where that keeps
 * the norm's stride, else the norm's treads with level stretches at its foot and top, else
 * landings, else treads alike all the same. Null where that many would be risers past the norm's
 * highest (the map undercounts the rise) or of a few centimetres on the smoothed terrain (G-018).
 */
const counted = (osm: number, rise: number, g: readonly number[], dt: number, length: number): Laid | null => {
  const r = rise / osm;
  if (r < MIN_COUNTED || r > STEP_NORM.riserMax + 1e-9) return null;
  const stride = 2 * r + length / osm;
  const fills = stride >= STEP_NORM.strideMin - 1e-9 && stride <= STEP_NORM.strideMax + 1e-9;
  return (fills ? evenly(osm, r, g, dt, length) : null) ?? byNorm([{ n: osm, r }], g, dt, length, true) ?? byNorm([{ n: osm, r }], g, dt, length) ?? evenly(osm, r, g, dt, length);
};

/**
 * The flight by the norm on a run `length` m long whose ground (`ground`, from the low end, along
 * the band's axis) rises from its foot to its top; null where it rises less than the norm's
 * lowest riser (the run lies as paving). A run its map counts the steps of (`osm`) gets that
 * many (`counted`). Else of every riser count, stride and split into runs of at most `maxRun` the
 * norm allows, the one whose treads stand closest over the ground, a landing or a stride off the
 * norm's own weighed as `PREFER` of it. No tread lies more than `EPS` under the ground: where no
 * such flight keeps over it, its risers (the mapped count, else the norm's) stand where the
 * ground rises past each level.
 */
export const layFlight = (length: number, ground: (t: number) => number, osm?: number): Flight | null => {
  const steps = Math.max(1, Math.ceil(length / SAMPLE));
  const dt = length / steps;
  const g0 = ground(0);
  const g = Array.from({ length: steps + 1 }, (_, i) => ground(i * dt) - g0);
  const rise = g[steps] as number;
  if (rise < STEP_NORM.riserMin) return null;
  const counts = riserCounts(rise);
  const mapped = osm !== undefined && rise / osm >= MIN_COUNTED && rise / osm <= STEP_NORM.riserMax + 1e-9;
  const best = mapped ? counted(osm, rise, g, dt, length) : byNorm(counts, g, dt, length);
  if (best) return { at: best.at, riser: best.r };
  const { n, r } = mapped ? { n: osm, r: rise / osm } : (counts[0] as { n: number; r: number });
  return { at: dueAt(g, dt, n, r, length), riser: r };
};

/**
 * Whether the ground along a run (`ground`, from 0 to `length`) rises over its higher end or
 * falls under its lower one by more than `EPS`: over a crest or a hollow no level tread keeps on
 * the ground, and the run lies on it as paving.
 */
export const humped = (length: number, ground: (t: number) => number): boolean => {
  const steps = Math.max(1, Math.ceil(length / SAMPLE));
  const g = Array.from({ length: steps + 1 }, (_, i) => ground((i * length) / steps));
  const [lo, hi] = [Math.min(g[0] as number, g[steps] as number), Math.max(g[0] as number, g[steps] as number)];
  return g.some((y) => y > hi + EPS || y < lo - EPS);
};
