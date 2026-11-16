/**
 * The tower crane by a listed building (G-894, ADR-0087 step 4): a site whose outline holds a
 * building OSM tags `historic` or `heritage` (half its corners or more in the outline: the palace
 * of a museum's yards) keeps its crane out of the space between the building's facade and the
 * square or street in front of it. Its mast stands in a courtyard of the building: off the
 * building, inside its convex hull and `COURTYARD` m or more from the hull's edge (a niche of a
 * facade is shallower). With no such ground it stands `HERITAGE_CLEAR` m or more off the building
 * with a jib of `HERITAGE_JIB` m at most, and else the site has no crane.
 */
import { segmentDistance } from "../../../packages/core/src/math/geometry2d.ts";
import { type SiteNeighbour } from "./construction-ground.ts";
import { type Pt, pointInRing } from "./geometry.ts";

/** How far a mast off the courtyard keeps from a listed building (m): the scan's `site-crane-heritage` measures the same. */
export const HERITAGE_CLEAR = 15;
/** The longest jib of a crane off the courtyard on a site with a listed building (m). */
export const HERITAGE_JIB = 50;
/** How deep in a listed building's convex hull a courtyard's mast stands (m). */
export const COURTYARD = 8;

/** The listed buildings a site's outline holds: `heritage` neighbours with half their corners or more in it. */
export const heritageIn = (outline: readonly Pt[], neighbours: readonly SiteNeighbour[]): (readonly Pt[])[] =>
  neighbours.filter((n) => n.heritage && 2 * n.ring.filter((p) => pointInRing(p, outline)).length >= n.ring.length).map((n) => n.ring);

/** Distance from p to a ring's edges. */
const edgeDistance = (p: Pt, ring: readonly Pt[]): number => {
  let d = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [a, b] = [ring[i]!, ring[(i + 1) % ring.length]!];
    d = Math.min(d, segmentDistance(p.x, p.z, a.x, a.z, b.x, b.z));
  }
  return d;
};

/** Distance from p to a ring, 0 inside it. */
export const ringDistance = (p: Pt, ring: readonly Pt[]): number => (pointInRing(p, ring) ? 0 : edgeDistance(p, ring));

/** The convex hull of points (monotone chain). */
export const convexHull = (pts: readonly Pt[]): Pt[] => {
  const s = [...pts].sort((a, b) => a.x - b.x || a.z - b.z);
  if (s.length < 3) return s;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const half = (list: readonly Pt[]): Pt[] => {
    const h: Pt[] = [];
    for (const p of list) {
      while (h.length >= 2 && cross(h[h.length - 2]!, h[h.length - 1]!, p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return [...half(s), ...half([...s].reverse())];
};

/** How deep p lies in a listed building's courtyard: its distance to the hull's edge, 0 outside the hull or in the building. */
export const courtyardDepth = (p: Pt, ring: readonly Pt[], hull: readonly Pt[] = convexHull(ring)): number =>
  pointInRing(p, ring) || !pointInRing(p, hull) ? 0 : edgeDistance(p, hull);

/**
 * Where a site's mast may stand by its listed buildings, by the spot and the jib it would need:
 * null for a site with none (any spot).
 */
export const heritageCraneRule = (outline: readonly Pt[], neighbours: readonly SiteNeighbour[]): ((at: Pt, jib: number) => boolean) | null => {
  const listed = heritageIn(outline, neighbours).map((ring) => ({ ring, hull: convexHull(ring) }));
  if (listed.length === 0) return null;
  return (at, jib) => {
    if (listed.some((l) => pointInRing(at, l.ring))) return false;
    if (listed.some((l) => courtyardDepth(at, l.ring, l.hull) >= COURTYARD)) return true;
    return jib <= HERITAGE_JIB && listed.every((l) => ringDistance(at, l.ring) >= HERITAGE_CLEAR);
  };
};
