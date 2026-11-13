/**
 * How far a street's carriageway reaches left and right of its axis (ADR-0080 decision 4, PR 3),
 * from the width the import gives it, not from the asphalt as drawn: the width by tags or type,
 * narrowed to the mapped sidewalks (`fitToKerb`, T-046), fitted side by side (`fitLanes`, G-655),
 * and widened to the paving (`kerbFills`, G-570). The traffic's lanes and the kerbs' parked cars
 * read it (`StreetOut.half`), so moving the drawn edge of the asphalt by a few centimetres (round
 * joins, ADR-0078) moves no lane (G-744).
 */
import { type Pt } from "./geometry.ts";
import { type Band } from "./ground.ts";

type Sample = { readonly at: Pt; readonly reach: number };

/** One laid piece of a carriageway: its axis (moved aside where `fitLanes` fitted it), half its width and its widening's samples on its edges, by 2 m cells. */
interface Piece {
  readonly line: readonly Pt[];
  readonly half: number;
  readonly widen: ReadonlyMap<string, readonly Sample[]>;
}

/** A widening's sample this near a piece's edge point is that point's (m): `kerbFills` samples the edge every 0.5 m. */
const NEAR_SAMPLE = 0.5;
/** The cells the widening's samples are kept in (m), wider than `NEAR_SAMPLE`. */
const CELL = 2;
/** A point of the axis further off a piece's carriageway than this is on none of it: a tunnel's stretch under the street (m). */
const OFF_PIECE = 0.5;
/** The step the halves are written in (m), as the width the ADR keeps. */
const STEP = 0.05;
/** How often the reach is read along a street (m). */
const PROBE = 1;
/**
 * The share of a point's stretch its reach is under (a lower quartile): a widening counts at a
 * point when it runs along three quarters of the stretch the point stands for, so a lane keeps
 * off a bay's ends. Measured on the glitch scan against the median: with the median, one more
 * `lane-off-ground` and two `lane-dead-end` keys moved; with this, none new.
 */
const QUANTILE = 0.25;

const written = (v: number): number => Number((Math.round(v / STEP) * STEP).toFixed(2)) + 0;
const cell = (x: number, z: number): string => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;

/** The nearest point of the piece's axis to `p`: its distance, how far `p` lies to the axis' left (negative: right), the segment's direction and foot. */
const nearestOn = (line: readonly Pt[], p: Pt): { d: number; left: number; ux: number; uz: number; q: Pt } | null => {
  let best: { d: number; left: number; ux: number; uz: number; q: Pt } | null = null;
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i]!, line[i + 1]!];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-9) continue;
    const [ux, uz] = [(b.x - a.x) / len, (b.z - a.z) / len];
    const t = Math.max(0, Math.min(len, (p.x - a.x) * ux + (p.z - a.z) * uz));
    const q = { x: a.x + ux * t, z: a.z + uz * t };
    const d = Math.hypot(p.x - q.x, p.z - q.z);
    if (!best || d < best.d - 1e-9) best = { d, left: ux * (p.z - a.z) - uz * (p.x - a.x), ux, uz, q };
  }
  return best;
};

/** How far the asphalt is widened past the edge point `e` (m): its nearest widening sample's, 0 with none near. */
const widenAt = (piece: Piece, e: Pt): number => {
  let best = { d: NEAR_SAMPLE, reach: 0 };
  const [cx, cz] = [Math.floor(e.x / CELL), Math.floor(e.z / CELL)];
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++)
      for (const w of piece.widen.get(`${cx + dx},${cz + dz}`) ?? []) {
        const d = Math.hypot(w.at.x - e.x, w.at.z - e.z);
        if (d < best.d || (d === best.d && w.reach > best.reach)) best = { d, reach: w.reach };
      }
  return best.reach;
};

/** The reach `[left, right]` at `p` of a street heading (tx, tz) there, unrounded; `[0, 0]` off every piece. */
const reachAt = (pieces: readonly Piece[], p: Pt, tx: number, tz: number): [number, number] => {
  let at: { piece: Piece; n: NonNullable<ReturnType<typeof nearestOn>> } | null = null;
  for (const piece of pieces) {
    const n = nearestOn(piece.line, p);
    if (n && (!at || n.d < at.n.d - 1e-9)) at = { piece, n };
  }
  if (!at || at.n.d > at.piece.half + OFF_PIECE) return [0, 0];
  const { piece, n } = at;
  // The piece's left normal, its edges' points by the foot of `p`.
  const [nx, nz] = [-n.uz, n.ux];
  const left = piece.half - n.left + widenAt(piece, { x: n.q.x + nx * piece.half, z: n.q.z + nz * piece.half });
  const right = piece.half + n.left + widenAt(piece, { x: n.q.x - nx * piece.half, z: n.q.z - nz * piece.half });
  // The street may run against the piece (`oneway=-1` turned round): its left is the piece's right.
  const [l, r] = tx * n.ux + tz * n.uz >= 0 ? [left, right] : [right, left];
  return [Math.max(0, l), Math.max(0, r)];
};

/** The `QUANTILE` of the readings on the carriageway; 0 when most of them are off it. */
const lower = (vs: readonly number[]): number => {
  const on = vs.filter((v) => v > 0).sort((a, b) => a - b);
  return on.length === 0 || on.length * 2 < vs.length ? 0 : on[Math.floor((on.length - 1) * QUANTILE)]!;
};

/**
 * The carriageway's reach `[left, right]` of a street's `line` (its direction) at each of its points,
 * flattened, to `STEP`: at a point, the `QUANTILE` of the reach read every `PROBE` metres over the
 * stretch it stands for, from halfway to the point before to halfway to the next, where the traffic
 * reads it (`traffic-reach.ts`). Read linearly between the points, a bay of 36 m by Dolna Panny
 * Marii's middle point widened the street up to its ends 21 and 70 m off, and its lane ran by a
 * cabinet on the footway. 0 where the stretch lies mostly off every piece. Undefined for a way
 * without a carriageway of its own.
 */
export type StreetHalves = (way: string, line: readonly Pt[]) => number[] | undefined;

/** The halves of the ways' carriageways as `bands` lay them, after `kerbFills` widened them. */
export const streetHalves = (bands: readonly Band[]): StreetHalves => {
  const byWay = new Map<string, Map<readonly Pt[], { half: number; widen: Map<string, Sample[]> }>>();
  for (const b of bands) {
    if (!b.carriageway || !b.kerb) continue;
    const pieces = byWay.get(b.source) ?? new Map();
    byWay.set(b.source, pieces);
    // A buffer of several rings is several bands of one piece: their widenings are the piece's.
    const piece = pieces.get(b.kerb.line) ?? { half: b.kerb.half, widen: new Map() };
    pieces.set(b.kerb.line, piece);
    for (const r of b.widen ?? [])
      r.outer.forEach((o, i) => {
        const at = r.inner[i]!;
        const list = piece.widen.get(cell(at.x, at.z)) ?? [];
        list.push({ at, reach: Math.hypot(o.x - at.x, o.z - at.z) });
        piece.widen.set(cell(at.x, at.z), list);
      });
  }
  return (way, line) => {
    const own = byWay.get(way);
    if (!own || line.length < 2) return undefined;
    const pieces: Piece[] = [...own].map(([l, p]) => ({ line: l, ...p }));
    // Each point's stretch: the reach read at its own place, and every `PROBE` m along the halves of its segments.
    const stretches: [number, number][][] = line.map(() => []);
    for (let i = 0; i + 1 < line.length; i++) {
      const [a, b] = [line[i]!, line[i + 1]!];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const [tx, tz] = len > 1e-9 ? [(b.x - a.x) / len, (b.z - a.z) / len] : [0, 0];
      if (i === 0) stretches[0]!.push(reachAt(pieces, a, tx, tz));
      for (let k = 1; k * PROBE < len; k++) stretches[k * PROBE * 2 < len ? i : i + 1]!.push(reachAt(pieces, { x: a.x + tx * k * PROBE, z: a.z + tz * k * PROBE }, tx, tz));
      stretches[i + 1]!.push(reachAt(pieces, b, tx, tz));
    }
    return stretches.flatMap((st) => [written(lower(st.map((r) => r[0]))), written(lower(st.map((r) => r[1])))]);
  };
};
