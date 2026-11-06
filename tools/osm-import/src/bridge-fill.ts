/**
 * One deck across a bridge (G-340): the map draws a bridge's carriageway and its sidewalk as ways
 * of their own, each laid as wide as its tags say, and on Mełgiewska's two bridges over the
 * Bystrzyca they leave 1.5–2.5 m between them with the valley 2.5–5 m below. The bridge's outline
 * (`man_made=bridge`) holds both: the structure is one deck, its sidewalk running on to the kerb.
 */
import { type Area } from "./features.ts";
import { type Pt, ccw, pointInRing } from "./geometry.ts";
import { type Band } from "./ground.ts";

/** The widest gap a bridge's outline fills between its sidewalk and its carriageway (m): wider, a deck of its own. */
const MAX_GAP = 4;
/** How far the two ways may turn from each other and still run side by side across the bridge (cosine of 15°). */
const SIDE_BY_SIDE = Math.cos((15 * Math.PI) / 180);

const lineDistance = (p: Pt, a: Pt, b: Pt): number => {
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return Math.abs((p.x - a.x) * (b.z - a.z) - (p.z - a.z) * (b.x - a.x)) / len;
};

const side = (p: Pt, a: Pt, b: Pt): number => Math.sign((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x));

/** The two corners of a straight band's ring (its axis from `a` to `b`) on the side of `toward`: its edge facing there. */
const edgeFacing = (ring: readonly Pt[], a: Pt, b: Pt, toward: Pt): Pt[] => ring.filter((p) => side(p, a, b) === side(toward, a, b));

/**
 * The piece between a sidewalk's band `walk` and a carriageway's band `road` on one bridge: from
 * the sidewalk's edge to the carriageway's, their own corners, so the three pieces share their
 * edges exactly; at the sidewalk's deck, so the kerb is where the carriageway ends. Null when the
 * two do not run side by side, overlap, or lie further apart than `MAX_GAP`.
 */
const gapPiece = (walk: Band, road: Band): readonly Pt[] | null => {
  const [wa, wb] = walk.deck!;
  const [ra, rb] = road.deck!;
  const [wl, rl] = [Math.hypot(wb.x - wa.x, wb.z - wa.z), Math.hypot(rb.x - ra.x, rb.z - ra.z)];
  const cos = ((wb.x - wa.x) * (rb.x - ra.x) + (wb.z - wa.z) * (rb.z - ra.z)) / (wl * rl || 1);
  if (Math.abs(cos) < SIDE_BY_SIDE) return null;
  const [w0, w1, ...moreWalk] = edgeFacing(walk.ring, wa, wb, ra);
  const [r0, r1, ...moreRoad] = edgeFacing(road.ring, ra, rb, wa);
  if (!w0 || !w1 || !r0 || !r1 || moreWalk.length > 0 || moreRoad.length > 0) return null;
  const half = lineDistance(r0, ra, rb);
  if ([w0, w1].some((p) => lineDistance(p, ra, rb) - half <= 0.05 || lineDistance(p, ra, rb) - half > MAX_GAP)) return null;
  // Each corner of the sidewalk's edge faces the nearer corner of the carriageway's.
  const facing = (p: Pt) => (Math.hypot(r0.x - p.x, r0.z - p.z) <= Math.hypot(r1.x - p.x, r1.z - p.z) ? r0 : r1);
  const [fa, fb] = [facing(w0), facing(w1)];
  return fa === fb ? null : ccw([w0, w1, fb, fa]);
};

/**
 * The pieces filling each bridge's outline of the map between a sidewalk on the bridge and the
 * carriageway beside it, of the sidewalk's surface and on its deck. Only straight bands (a
 * bridge's way of two nodes, its ring four corners): a deck's axis is its way's two ends.
 */
export const bridgeFills = (areas: readonly Area[], bands: readonly Band[]): Band[] => {
  const out: Band[] = [];
  for (const a of areas) {
    if (a.tags.man_made !== "bridge") continue;
    const on = bands.filter((b) => {
      if (!b.deck || b.ring.length !== 4) return false;
      const [p, q] = b.deck;
      return pointInRing({ x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 }, a.ring);
    });
    const roads = on.filter((b) => b.carriageway);
    for (const walk of on.filter((b) => !b.carriageway && (b.surface === "sidewalk" || b.surface === "footway" || b.surface === "cobble"))) {
      const pieces = roads.flatMap((r) => {
        const ring = gapPiece(walk, r);
        return ring ? [ring] : [];
      });
      for (const ring of pieces) out.push({ surface: walk.surface, ring, bridge: true, deck: walk.deck!, source: a.id });
    }
  }
  return out;
};
