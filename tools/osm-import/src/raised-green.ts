/**
 * Lawns mapped above the ground (G-647): `layer` > 0 or on a roof, the green of a roof or of a
 * deck (VIVO's, r11978659, `layer=4`). Laid on the ground whole, such a lawn ran under the building
 * whose roof it is and past the deck's edge onto the street. Where it reaches over a structure
 * under the ground (a garage, whose roof is the ground's level) it lies on that roof only; nowhere
 * where a building stands or a carriageway runs on the ground under it. The cutting is done in
 * convex pieces (`convexParts`): the lawn's, the decks' and the buildings' parts, a carriageway's
 * quads segment by segment.
 */
import { convexParts } from "./convex.ts";
import { type Pt, type Rect, bufferLine, ccw, r1, rectsOverlap, removeCollinear, ringBounds, signedArea } from "./geometry.ts";
import { type Band } from "./ground.ts";
import { type Tags } from "./osm.ts";

/** A lawn mapped above the ground: on a layer over it, or on a roof. */
export const raisedGreen = (t: Tags): boolean => Number(t.layer ?? 0) > 0 || t.location === "roof" || t.location === "rooftop";

/** Pieces smaller than this are dropped (m²): slivers along a cut edge. */
const MIN_PIECE = 0.05;

const cross = (a: Pt, b: Pt, p: Pt): number => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);

/** The part of the convex `poly` on the left of the line a-b (`left`), or on its right. */
const half = (poly: readonly Pt[], a: Pt, b: Pt, left: boolean): Pt[] => {
  const s = (p: Pt) => (left ? 1 : -1) * cross(a, b, p);
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const [p, q] = [poly[i]!, poly[(i + 1) % poly.length]!];
    const [sp, sq] = [s(p), s(q)];
    if (sp >= 0) out.push(p);
    if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) {
      const k = sp / (sp - sq);
      out.push({ x: p.x + (q.x - p.x) * k, z: p.z + (q.z - p.z) * k });
    }
  }
  return out;
};

const solid = (poly: readonly Pt[]): boolean => poly.length >= 3 && signedArea(poly) > MIN_PIECE;
const edgesOf = (poly: readonly Pt[]): [Pt, Pt][] => poly.map((p, i) => [p, poly[(i + 1) % poly.length]!]);

/** Convex `p` within convex `c` (both counter-clockwise). */
const within = (p: readonly Pt[], c: readonly Pt[]): Pt[] => edgesOf(c).reduce<Pt[]>((rest, [a, b]) => (rest.length < 3 ? [] : half(rest, a, b, true)), [...p]);

/** Convex `p` less convex `c` (both counter-clockwise): the pieces of `p` off each of `c`'s edges in turn. */
const less = (p: readonly Pt[], c: readonly Pt[]): Pt[][] => {
  const out: Pt[][] = [];
  let rest: Pt[] = [...p];
  for (const [a, b] of edgesOf(c)) {
    const off = half(rest, a, b, false);
    if (solid(off)) out.push(off);
    rest = half(rest, a, b, true);
    if (!solid(rest)) return out;
  }
  return out;
};

const boxed = (ring: readonly Pt[]): { readonly ring: Pt[]; readonly box: Rect } => ({ ring: ccw(ring), box: ringBounds(ring) });

/**
 * The ground a raised lawn's `ring` lies on: on the `decks` under it if any (outlines of
 * structures under the ground), less the outlines `over` it (buildings, a carriageway's pieces).
 * Null when a ring cannot be cut into convex parts (a self-crossing one): the lawn is left whole.
 */
export const raisedGround = (ring: readonly Pt[], decks: readonly (readonly Pt[])[], over: readonly (readonly Pt[])[]): Pt[][] | null => {
  const box = ringBounds(ring);
  const partsOf = (rings: readonly (readonly Pt[])[]) => rings.filter((r) => rectsOverlap(ringBounds(r), box)).flatMap((r) => (convexParts(r) ?? []).map(boxed));
  const lawn = convexParts(ring);
  if (!lawn) return null;
  let pieces = lawn.map(boxed);
  const onDecks = partsOf(decks).flatMap((d) => pieces.flatMap((p) => (rectsOverlap(p.box, d.box) ? [within(p.ring, d.ring)] : []))).filter(solid);
  if (onDecks.length > 0) pieces = onDecks.map(boxed);
  for (const o of partsOf(over)) pieces = pieces.flatMap((p) => (rectsOverlap(p.box, o.box) ? less(p.ring, o.ring).map(boxed) : [p]));
  return pieces.map((p) => p.ring);
};

/** A carriageway's band on the ground as quads, a segment each: convex, unlike its whole ring at a bend. */
const carriagewayQuads = (b: Band): Pt[][] => {
  if (!b.carriageway || b.bridge || !b.kerb) return [];
  const { line, half: w } = b.kerb;
  return line.slice(1).map((p, i) => bufferLine([line[i]!, p], 2 * w));
};

/**
 * The bands with each raised lawn's (`raised`, by source) replaced by its pieces on the ground
 * (`raisedGround`): on the `decks` under it, off the `buildings` standing on the ground and the
 * carriageways among `bands`. The pieces are rounded here and not simplified again in a chunk
 * (`holed`), so two that share a cut edge keep sharing it.
 */
export const groundRaisedGreen = <B extends Band & { readonly box: Rect }>(bands: readonly B[], raised: ReadonlySet<string>, decks: readonly (readonly Pt[])[], buildings: readonly (readonly Pt[])[]): B[] => {
  const lawns = bands.filter((b) => b.surface === "grass" && raised.has(b.source));
  if (lawns.length === 0) return [...bands];
  const roads = bands.filter((b) => b.carriageway && lawns.some((l) => rectsOverlap(l.box, b.box))).flatMap(carriagewayQuads);
  const grid = (ring: readonly Pt[]) => removeCollinear(ring.map((p) => ({ x: r1(p.x), z: r1(p.z) })), 0.02);
  return bands.flatMap((b) => {
    if (!lawns.includes(b)) return [b];
    const pieces = raisedGround(b.ring, decks, [...buildings, ...roads]);
    if (!pieces) return [b];
    return pieces.map(grid).filter(solid).map((ring) => ({ ...b, ring, box: ringBounds(ring), holed: true as const }));
  });
};
