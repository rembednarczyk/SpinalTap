/**
 * A road marking that jumps sideways where two stretches of one street's carriageway meet
 * (`marking-step`, G-675, from the curator's review of #437): a centre or lane line ends and the
 * line of the same kind going on from it starts `MIN_STEP` and more to the side, within a metre
 * along. A painted line shifts over a taper, it does not step. "One street" is read off the map:
 * the nearest carriageway axis at both ends has the same name (or is the same way when unnamed).
 * The markings are the game's tables; the check reads no field of the import's fit.
 */

type Pt = { readonly x: number; readonly z: number };
type Finding = { readonly at: string; readonly what: string };

export interface StepMarking {
  readonly kind: string;
  /** World polyline, flat [x, z, x, z, ...], as the chunk tables hold it. */
  readonly line: readonly number[];
}

/** A sideways jump this large and larger counts (m). */
export const MIN_STEP = 0.3;
/** A jump wider than this is the next lane's line, not this one going on (m): under the narrowest lane, 2.25 m. */
const MAX_STEP = 1.5;
/** How far along the street the next line may start past the end of one (m), or overlap it. */
const MAX_GAP = 1;
const OVERLAP = 0.5;
/** The lines that run along the lanes. */
const LANE_LINES = new Set(["centre-dash", "centre-double", "lane-dash"]);

interface End {
  readonly p: Pt;
  /** The direction out of the line through this end. */
  readonly ux: number;
  readonly uz: number;
  readonly line: number;
  readonly kind: string;
}

const endsOf = (m: StepMarking, line: number): End[] => {
  const n = m.line.length / 2;
  if (n < 2) return [];
  const at = (i: number): Pt => ({ x: m.line[2 * i]!, z: m.line[2 * i + 1]! });
  const end = (i: number, j: number): End | null => {
    const [p, q] = [at(i), at(j)];
    const l = Math.hypot(p.x - q.x, p.z - q.z);
    return l < 1e-6 ? null : { p, ux: (p.x - q.x) / l, uz: (p.z - q.z) / l, line, kind: m.kind };
  };
  return [end(0, 1), end(n - 1, n - 2)].filter((e): e is End => e !== null);
};

/**
 * The steps of the lane lines in `markings`: each pair of ends (one line's end, the other's start,
 * going on the same way) `MIN_STEP`–`MAX_STEP` apart across and at most `MAX_GAP` apart along, on
 * one street by `street` (null off any street). One finding a pair.
 */
export const markingSteps = (markings: readonly StepMarking[], street: (p: Pt) => string | null): Finding[] => {
  const cell = 4;
  const grid = new Map<string, End[]>();
  const key = (x: number, z: number) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
  markings.forEach((m, i) => {
    if (!LANE_LINES.has(m.kind)) return;
    for (const e of endsOf(m, i)) grid.set(key(e.p.x, e.p.z), [...(grid.get(key(e.p.x, e.p.z)) ?? []), e]);
  });
  const out: Finding[] = [];
  for (const ends of grid.values())
    for (const a of ends) {
      const [cx, cz] = [Math.floor(a.p.x / cell), Math.floor(a.p.z / cell)];
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++)
          for (const b of grid.get(`${cx + dx},${cz + dz}`) ?? []) {
            // Each pair once, of one kind, the two lines going on from each other.
            if (b.line <= a.line || b.kind !== a.kind || a.ux * b.ux + a.uz * b.uz > -0.95) continue;
            const [vx, vz] = [b.p.x - a.p.x, b.p.z - a.p.z];
            const along = vx * a.ux + vz * a.uz;
            const across = Math.abs(vx * a.uz - vz * a.ux);
            if (along < -OVERLAP || along > MAX_GAP || across < MIN_STEP || across > MAX_STEP) continue;
            const s = street(a.p);
            if (s === null || s !== street(b.p)) continue;
            out.push({ at: `${a.p.x.toFixed(0)},${a.p.z.toFixed(0)}`, what: `${s}: ${a.kind} steps ${across.toFixed(2)} m across` });
          }
    }
  return out;
};
