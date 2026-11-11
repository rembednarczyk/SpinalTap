/**
 * Buildings across the map's edge (G-556). A building goes to the chunk of its centroid; one whose
 * centroid lies off the map went to none and was dropped whole, the part on the map too (Cicha 3,
 * 5, 6 and 8 at x = -200, Pałac Ordynacki and the Curia of T-058 at z = -240). Such a building is
 * cut at the edge of the district holding most of it: its outline closes along the edge, so it is
 * drawn and solid as a whole building with a wall there, and its centroid falls in one chunk.
 */
import { type Pt, type Rect, ccw, centroid, inRect, openRing, signedArea } from "./geometry.ts";

/** One side of a rectangle: what lies inside it, where a segment crosses it and how far along it a point on it is. */
interface Side {
  readonly inside: (p: Pt) => boolean;
  readonly cut: (a: Pt, b: Pt) => Pt;
  readonly along: (p: Pt) => number;
}

const sides = (r: Rect): Side[] => {
  const atX = (x: number) => (a: Pt, b: Pt): Pt => ({ x, z: a.z + ((b.z - a.z) * (x - a.x)) / (b.x - a.x) });
  const atZ = (z: number) => (a: Pt, b: Pt): Pt => ({ x: a.x + ((b.x - a.x) * (z - a.z)) / (b.z - a.z), z });
  return [
    { inside: (p) => p.x >= r.minX, cut: atX(r.minX), along: (p) => p.z },
    { inside: (p) => p.x <= r.maxX, cut: atX(r.maxX), along: (p) => p.z },
    { inside: (p) => p.z >= r.minZ, cut: atZ(r.minZ), along: (p) => p.x },
    { inside: (p) => p.z <= r.maxZ, cut: atZ(r.maxZ), along: (p) => p.x },
  ];
};

/**
 * A counter-clockwise ring cut by one side into its separate pieces inside it. Sutherland-Hodgman
 * (`clipRingToRect`) joins the pieces of a ring leaving and entering again over the same side by a
 * corridor of no width along it, which the walls would draw; here each piece closes on its own:
 * the side's stretches inside the ring run from an exit of it to the next entry along the side.
 */
const cutBy = (ring: readonly Pt[], s: Side): Pt[][] => {
  const start = ring.findIndex((p) => !s.inside(p));
  if (start < 0) return [[...ring]];
  const chains: Pt[][] = [];
  let cur: Pt[] | null = null;
  for (let k = 1; k <= ring.length; k++) {
    const prev = ring[(start + k - 1) % ring.length]!;
    const p = ring[(start + k) % ring.length]!;
    if (s.inside(p)) {
      if (!cur) cur = [s.cut(prev, p)];
      cur.push(p);
    } else if (cur) {
      cur.push(s.cut(prev, p));
      chains.push(cur);
      cur = null;
    }
  }
  // Ends of the chains along the side; the ring's inside lies between an exit and the entry after it.
  const ends = chains.flatMap((c, i) => [{ i, entry: true, t: s.along(c[0]!) }, { i, entry: false, t: s.along(c[c.length - 1]!) }]);
  ends.sort((a, b) => a.t - b.t || Number(a.entry) - Number(b.entry));
  const used = new Set<number>();
  const out: Pt[][] = [];
  for (let first = 0; first < chains.length; first++) {
    if (used.has(first)) continue;
    const piece: Pt[] = [];
    for (let i = first; !used.has(i); ) {
      used.add(i);
      piece.push(...chains[i]!);
      const k = ends.findIndex((e) => e.i === i && !e.entry);
      const next = ends[k % 2 === 0 ? k + 1 : k - 1];
      if (!next?.entry) break;
      i = next.i;
    }
    const ring = openRing(piece);
    if (ring.length >= 3 && signedArea(ring) > 1e-6) out.push(ring);
  }
  return out;
};

/** A ring's pieces in a rectangle, each closed along the rectangle's sides. */
export const piecesInRect = (ring: readonly Pt[], r: Rect): Pt[][] => sides(r).reduce<Pt[][]>((rings, s) => rings.flatMap((p) => cutBy(p, s)), [ccw(openRing(ring))]);

/** A ring's largest piece in any of the rectangles, with that rectangle; null with none. */
const largestPiece = (ring: readonly Pt[], rects: readonly Rect[]): { ring: Pt[]; rect: Rect } | null => {
  let best: { ring: Pt[]; rect: Rect } | null = null;
  for (const rect of rects) for (const piece of piecesInRect(ring, rect)) if (!best || signedArea(piece) > signedArea(best.ring)) best = { ring: piece, rect };
  return best;
};

/** A building cut at the map's edge: its outline there and the district it stands in. */
export interface EdgeCut {
  readonly ring: readonly Pt[];
  readonly rect: Rect;
}

/**
 * A piece on the map shallower than this (m) from the edge cutting it is a slab, not a building:
 * one room deep at least, or it stays off the map with the rest of its building, for the map's
 * widening (user's decision 8.11: Probostwo 7 1 m, Pałac Morskich 2 m deep).
 */
export const MIN_EDGE_DEPTH = 3;

/** How deep a piece of `ring` in `rect` reaches in from the sides of `rect` the ring crosses (m): the least of them. */
export const edgeDepth = (ring: readonly Pt[], piece: readonly Pt[], rect: Rect): number => {
  const sides = [
    { past: (p: Pt) => p.x < rect.minX, from: (p: Pt) => p.x - rect.minX },
    { past: (p: Pt) => p.x > rect.maxX, from: (p: Pt) => rect.maxX - p.x },
    { past: (p: Pt) => p.z < rect.minZ, from: (p: Pt) => p.z - rect.minZ },
    { past: (p: Pt) => p.z > rect.maxZ, from: (p: Pt) => rect.maxZ - p.z },
  ];
  return Math.min(...sides.filter((s) => ring.some(s.past)).map((s) => Math.max(...piece.map(s.from))));
};

/** Buildings centred off every district, by id: their largest piece in a district, if `MIN_EDGE_DEPTH` deep. */
export const edgeOutlines = (buildings: readonly { readonly id: string; readonly ring: readonly Pt[] }[], districts: readonly Rect[]): ReadonlyMap<string, EdgeCut> => {
  const out = new Map<string, EdgeCut>();
  for (const b of buildings) {
    if (districts.some((r) => inRect(centroid(b.ring), r))) continue;
    const best = largestPiece(b.ring, districts);
    if (best && edgeDepth(b.ring, best.ring, best.rect) >= MIN_EDGE_DEPTH) out.set(b.id, best);
  }
  return out;
};

/** The parts (`building:part`) of a building cut at the map's edge, cut there too: none of them reaches off the map. */
export const partsWithin = <T extends { readonly ring: readonly Pt[] }>(parts: readonly T[], rect: Rect): T[] =>
  parts.flatMap((p) => {
    const piece = largestPiece(p.ring, [rect]);
    return piece ? [{ ...p, ring: piece.ring }] : [];
  });
