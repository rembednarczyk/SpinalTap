/**
 * Two checks from the curator's review of G-755 (#515), on where the game's terrain is shaped
 * below the map:
 * - `ground-under-plinth`: a point of a building's outline (its corners and every metre of its
 *   sides) where the game's ground lies more than `PLINTH_GAP` under the building's foot `y`
 *   (the lowest NMT point under it): the foot floats over a gap there;
 * - `steep-way-cut`: a point of a stretch of `steepWays` laid at an even grade (G-755) more than
 *   `CUT_LIMIT` under the NMT: a cut into the bank deeper than the review allows.
 * One finding a point, at its metre (the scan keys both by 10 m square, `SAMPLED_KINDS`). A
 * point where `ground` is NaN (off the map) is none.
 */

type Pt = { readonly x: number; readonly z: number };
type Finding = { readonly at: string; readonly what: string };

/** How far under a building's foot the ground may lie at its outline (m). */
export const PLINTH_GAP = 0.05;
/** How deep under the NMT a steep way's stretch may be cut (m). */
export const CUT_LIMIT = 2;
/** The samples along a side or a stretch (m). */
const STEP = 1;

const key = (p: Pt) => `${p.x.toFixed(0)},${p.z.toFixed(0)}`;

/** The points of a closed or open polyline: its corners and every `STEP` metres between them. */
const along = (pts: readonly Pt[], closed: boolean): Pt[] => {
  const out: Pt[] = [];
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const [a, b] = [pts[i]!, pts[(i + 1) % pts.length]!];
    const k = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / STEP));
    for (let j = 0; j < k; j++) out.push({ x: a.x + ((b.x - a.x) * j) / k, z: a.z + ((b.z - a.z) * j) / k });
  }
  if (!closed && pts.length > 0) out.push(pts[pts.length - 1]!);
  return out;
};

const points = (flat: readonly number[], ox = 0, oz = 0): Pt[] => Array.from({ length: flat.length >> 1 }, (_, k) => ({ x: flat[2 * k]! + ox, z: flat[2 * k + 1]! + oz }));

/** A building as the check reads it: its id, centre, foot and outline about the centre. */
export interface PlinthBuilding {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly y: number;
  readonly outline: readonly number[];
}

/** The outline points of `buildings` where `ground` lies more than `PLINTH_GAP` under the foot. */
export const groundUnderPlinth = (buildings: readonly PlinthBuilding[], ground: (x: number, z: number) => number): Finding[] =>
  buildings.flatMap((b) =>
    along(points(b.outline, b.x, b.z), true).flatMap((p) => {
      const gap = b.y - ground(p.x, p.z);
      return gap > PLINTH_GAP ? [{ at: key(p), what: `${b.id}: ground ${gap.toFixed(2)} m under the foot at ${p.x.toFixed(1)},${p.z.toFixed(1)}` }] : [];
    }),
  );

/** The axis of a stretch and its lines `offsets` metres to either side, as points. */
const band = (line: readonly Pt[], offsets: readonly number[]): Pt[] =>
  offsets.flatMap((o) =>
    along(line, false).map((p, k, all) => {
      const [a, b] = [all[Math.max(0, k - 1)]!, all[Math.min(all.length - 1, k + 1)]!];
      const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      return { x: p.x - ((b.z - a.z) / l) * o, z: p.z + ((b.x - a.x) / l) * o };
    }),
  );

/**
 * The points of the `stretches` (flat polylines), on the axis and `offsets` metres to either side
 * (the band laid), where `ground` lies more than `CUT_LIMIT` under `nmt`.
 */
export const steepWayCut = (
  stretches: readonly { readonly id: string; readonly line: readonly number[] }[],
  ground: (x: number, z: number) => number,
  nmt: (x: number, z: number) => number,
  offsets: readonly number[] = [0],
): Finding[] =>
  stretches.flatMap((w) =>
    band(points(w.line), offsets).flatMap((p) => {
      const cut = nmt(p.x, p.z) - ground(p.x, p.z);
      return cut > CUT_LIMIT ? [{ at: key(p), what: `${w.id}: cut ${cut.toFixed(2)} m under the NMT at ${p.x.toFixed(1)},${p.z.toFixed(1)}` }] : [];
    }),
  );
