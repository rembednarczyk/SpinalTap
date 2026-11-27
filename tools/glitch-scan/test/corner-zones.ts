/**
 * The junctions' corners as the street graph lays them (ADR-0104, the user's decision of 26.11: the
 * sidewalks' uniformity counts a corner as the graph does). Each point where three arms of the
 * streets or more meet gets a disc of the graph's own reach (`cornerReach`: past where the rounding
 * of its sharpest corner touches the kerbs), in place of the scan's fixed `JUNCTION` past the other
 * street's carriageway: at an acute corner the sidewalk wraps a fillet reaching farther than that,
 * and its widening read as a jump in the sidewalk's width.
 *
 * Pattern: the same node model as `street-ground.ts` (a graph's nodes and arms), read back from the
 * game's streets: an axis's end on another's line is a node of the two, as a T junction is.
 */
import { kerbRadius } from "../../osm-import/src/streets/graph-bands.ts";
import { cornerReach } from "../../osm-import/src/streets/street-ground.ts";

type Pt = { readonly x: number; readonly z: number };

/** A street as the scan has it, with its type for the kerb's radius. */
export interface CornerStreet {
  readonly id: string;
  readonly kind: string;
  readonly points: readonly Pt[];
  /** Its carriageway's half width, the widest (m). */
  readonly reach: number;
}

/** How near another street's line an axis's end makes the two meet (m): the lines are simplified to 0.1 m and rounded to 0.1 m. */
const MEET = 0.3;
/** How far along an arm its direction is read (m). */
const ARM = 2;

export interface CornerZone {
  readonly x: number;
  readonly z: number;
  readonly r: number;
}

/** The point `len` m along a line from its start. */
const along = (line: readonly Pt[], len: number): Pt => {
  let left = len;
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i]!, line[i + 1]!];
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    if (l >= left) return { x: a.x + ((b.x - a.x) * left) / l, z: a.z + ((b.z - a.z) * left) / l };
    left -= l;
  }
  return line[line.length - 1]!;
};

/** The foot of `p` on a line: its distance, the segment and the segment's direction. */
const foot = (line: readonly Pt[], p: Pt): { d: number; tx: number; tz: number } => {
  let best = { d: Infinity, tx: 1, tz: 0 };
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i]!, line[i + 1]!];
    const [dx, dz] = [b.x - a.x, b.z - a.z];
    const l2 = dx * dx + dz * dz;
    if (l2 < 1e-12) continue;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
    const d = Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
    if (d < best.d) best = { d, tx: dx / Math.sqrt(l2), tz: dz / Math.sqrt(l2) };
  }
  return best;
};

/** The streets' junctions (three arms or more at a point) with the graph's reach of their corners. */
export const cornerZones = (streets: readonly CornerStreet[]): CornerZone[] => {
  const seen = new Set<string>();
  const out: CornerZone[] = [];
  for (const s of streets)
    for (const end of [s.points[0], s.points[s.points.length - 1]]) {
      if (!end) continue;
      const key = `${Math.round(end.x * 2)},${Math.round(end.z * 2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const arms: number[] = [];
      const meet = streets.filter((o) => foot(o.points, end).d <= MEET);
      for (const o of meet) {
        const [first, last] = [o.points[0]!, o.points[o.points.length - 1]!];
        const ends = [first, last].filter((p) => Math.hypot(p.x - end.x, p.z - end.z) <= MEET);
        if (ends.length > 0) {
          for (const e of ends) {
            const line = e === first ? o.points : [...o.points].reverse();
            const q = along(line, ARM);
            arms.push(Math.atan2(q.z - end.z, q.x - end.x));
          }
          continue;
        }
        const f = foot(o.points, end);
        arms.push(Math.atan2(f.tz, f.tx), Math.atan2(-f.tz, -f.tx));
      }
      if (arms.length < 3) continue;
      const wide = Math.max(...meet.map((o) => o.reach));
      const r = Math.max(...meet.map((o) => kerbRadius(o.kind)));
      out.push({ ...end, r: cornerReach(arms, wide, r) });
    }
  return out;
};
