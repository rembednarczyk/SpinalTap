import { type Pt } from "../geometry.ts";
import { type Area, areaOfRing, join } from "./clip.ts";
import { type StreetEdge } from "./street-ground.ts";

/**
 * The joints of the street graph's carriageways with the bridges' decks (ADR-0104 E4). A deck is
 * off the graph, laid as before about its way's line, square at its abutment; the graph's street
 * on from it is BDOT10k's carriageway, moved off that line (Mełgiewska's 2.1 m) and square across
 * its own axis. Between the two square ends lay slivers of no ground and the lanes off the deck ran
 * onto the graph's sidewalk (`ground-readers`, `deck-abutment-step`). As one street's two pieces in
 * a row (`sideRamps`): the asphalt from the deck's end corners to the graph's kerbs `RAMP_LEN` on,
 * each kerb straight between them.
 */

/** How far on along the graph's street the joint reaches (m), as `RAMP_MAX`. */
export const JOINT_LEN = 10;
/** How near a deck's end corner lies to its half width off the end (m). */
const CORNER = 0.3;

/** A deck's carriageway: its band's outline, its way's line and half its width. */
export interface DeckEnd {
  readonly ring: readonly Pt[];
  readonly line: readonly Pt[];
  readonly half: number;
}

const near = (p: Pt, q: Pt) => Math.abs(p.x - q.x) < 5e-3 && Math.abs(p.z - q.z) < 5e-3;

/** The point `len` m along `axis` from its end at `p`. */
const along = (axis: readonly Pt[], p: Pt, len: number): Pt => {
  const line = near(axis[0]!, p) ? axis : [...axis].reverse();
  let left = len;
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i]!, line[i + 1]!];
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    if (l >= left) return { x: a.x + ((b.x - a.x) * left) / l, z: a.z + ((b.z - a.z) * left) / l };
    left -= l;
  }
  return line[line.length - 1]!;
};

/** The joints of `edges` with `decks` at the ends they share. */
export const abutmentJoints = (edges: readonly StreetEdge[], decks: readonly DeckEnd[]): { edge: number; area: Area }[] =>
  decks.flatMap((d) =>
    [d.line[0]!, d.line[d.line.length - 1]!].flatMap((p) => {
      // The deck's two corners at this end: its outline's points half its width off the end.
      const corners = d.ring.filter((q) => Math.abs(Math.hypot(q.x - p.x, q.z - p.z) - d.half) < CORNER);
      if (corners.length < 2) return [];
      return edges.flatMap((e, i) => {
        const starts = near(e.axis[0]!, p);
        if (!starts && !near(e.axis[e.axis.length - 1]!, p)) return [];
        const q = along(e.axis, p, JOINT_LEN);
        const len = Math.hypot(q.x - p.x, q.z - p.z);
        if (len < 1) return [];
        // The walk off the deck into the street: its left by `offsetLine`'s normal (-dz, dx).
        const u = { x: (q.x - p.x) / len, z: (q.z - p.z) / len };
        const n = { x: -u.z, z: u.x };
        const [left, right] = starts ? [e.left, e.right] : [e.right, e.left];
        const side = (c: Pt) => (c.x - p.x) * n.x + (c.z - p.z) * n.z;
        const sorted = [...corners].sort((a, b) => side(b) - side(a));
        const [cl, cr] = [sorted[0]!, sorted[sorted.length - 1]!];
        if (side(cl) <= 0 || side(cr) >= 0) return [];
        const ql = { x: q.x + n.x * left, z: q.z + n.z * left };
        const qr = { x: q.x - n.x * right, z: q.z - n.z * right };
        return [{ edge: i, area: join(areaOfRing([cl, cr, qr, ql])) }];
      });
    }),
  );
