/**
 * A chunk's ground as a partition of the plane (ADR-0078 step 3, ADR-0080 PR 6): the pieces of
 * different surfaces, and of one surface, no longer lie over each other in draw order; each is
 * what of it the pieces ranked over it leave, so a point of the ground lies in one piece. Not yet
 * laid by `generate`: wired in, it changes what the simulation's readers of the ground see (the
 * crowd's routes round the squares and along the alleys, the parked cars' bays, the lanes under
 * a sidewalk's lap), and which piece wins at a carriageway's edge is still to be decided (`Rank`).
 *
 * The rank, either way:
 * - steps first: a flight cuts every piece it lies on, as `offSteps` does today (G-781);
 * - then the higher `SURFACE_LIFT`, what the picture draws on top: a sidewalk (0.16 m) over a zebra
 *   (0.13 m) and the asphalt (0.10 m), the asphalt over a footway mapped across it (0.09 m) or a
 *   square (0.08 m), a lawn (0.04 m) over the water;
 * - with `carriageway`, the zebras and the asphalt before all but the steps: a sidewalk's lap over
 *   the carriageway is cut instead of the carriageway under it;
 * - of one lift a cobbled way over a plain square, as the renderer ranks them (`cell-ground.ts`);
 * - of one surface the smaller piece, then the one further south-west, as the renderer does too.
 * ADR-0078 ranks by the importer's `ORDER`; it disagrees with the lift on some 7% of the overlap
 * (a footway over asphalt 2 736 m², a footway over a sidewalk 1 913, cobbles over asphalt 874),
 * where it would cut the asphalt the lanes run on under a footway the picture draws below it.
 *
 * A zebra is a piece of the carriageway of its own: it cuts the asphalt under it, so the renderer
 * is to lay the asphalt under its stripes and the readers to take it for road (`onRoad`). Out of the
 * partition, as they are: the pieces on a bridge's deck (a layer of their own, ADR-0053). A piece
 * nothing cuts keeps its outline to the digit; a cut one is the difference in Clipper2's millimetres
 * (`clipper2-ts`), its new corners in millimetres too: rounded to 0.01 m (ADR-0078), a corner on
 * the edge of the piece it was cut along swings off it by up to 7 mm, and the two lap or part
 * along it (32 m² of the city's overlap left on the scan's raster, 9 m² in millimetres, for 2% more
 * of the tables). What laps still, about 1 m² in the city, are slivers along the 0.1 m steps of the
 * uncut pieces' slanting edges (`chunkGround` rounds them, until ADR-0078 step 4). Holes are cut in
 * by a seam (`cutHoles`), as the ground has outlines only.
 */
import { EndType, FillRule, JoinType, type Path64, type Paths64, difference, inflatePaths, intersect, isPositive } from "clipper2-ts";
import { SURFACE_LIFT, type GroundSurface } from "../../../packages/core/src/world/city-geo.ts";
import { SpatialHash } from "../../../packages/core/src/math/spatial-hash.ts";
import { type Pt, type Rect, ccw, pointInRing, removeCollinear, ringBounds, selfIntersects, signedArea } from "./geometry.ts";
import { type GroundOut } from "./model.ts";
import { cutHoles } from "./ring-holes.ts";

/** Clipper's grid, and the cut pieces' new corners: millimetres. */
const SCALE = 1000;
/** Less than this lost (m², 10 mm²), a piece is left whole: an edge on its neighbour's, off by the millimetres. */
const SPECK = 0.00001;
/** A cut piece's bit under this is dropped (m²): a crumb the cut leaves, under the scan's 0.25 m raster. */
const CRUMB = 0.05;
/** Half the widest spike or neck opened out of a cut piece whose outline would cross itself (m). */
const NECK = 0.005;
/** How far a corner of a cut piece may lie off its neighbours' line and be dropped (m): at 5 mm the edges it straightens lap over their neighbours by 1.6 m² in the city. */
const STRAIGHT = 0.0005;

/** Which piece wins at a carriageway's edge: the one drawn on top (`drawn`), or the carriageway (`carriageway`). */
export type Rank = "drawn" | "carriageway";

/** Of one lift, which surface's piece is cut by the other's: a cobbled way keeps its setts across a plain square (`RANK` of `cell-ground.ts`). */
const OF_ONE_LIFT: Readonly<Partial<Record<GroundSurface, number>>> = { cobble: 1 };
/** With `carriageway`: a zebra over its asphalt, both over all but the steps. */
const CARRIAGEWAY: Readonly<Partial<Record<GroundSurface, number>>> = { crossing: 2, road: 1 };

const ringOf = (flat: readonly number[]): Pt[] => Array.from({ length: flat.length >> 1 }, (_, i) => ({ x: flat[2 * i]!, z: flat[2 * i + 1]! }));
const toPath = (r: readonly Pt[]): Path64 => r.map((p) => ({ x: Math.round(p.x * SCALE), y: Math.round(p.z * SCALE) }));
const toPts = (p: Path64): Pt[] => p.map((q) => ({ x: q.x / SCALE, z: q.y / SCALE }));
const areaOf = (paths: Paths64): number => paths.reduce((s, p) => s + signedArea(toPts(p)), 0);
const overlaps = (a: Rect, b: Rect): boolean => a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;

interface Ranked {
  readonly i: number;
  readonly g: GroundOut;
  readonly path: Path64;
  readonly box: Rect;
  readonly area: number;
}

/** The order the pieces are laid in, first over all after it (see the head of the file). */
const before =
  (rank: Rank) =>
  (a: Ranked, b: Ranked): number => {
    const steps = Number(b.g.surface === "steps") - Number(a.g.surface === "steps");
    if (steps !== 0) return steps;
    const way = rank === "carriageway" ? (CARRIAGEWAY[b.g.surface] ?? 0) - (CARRIAGEWAY[a.g.surface] ?? 0) : 0;
    if (way !== 0) return way;
    const lift = SURFACE_LIFT[b.g.surface] - SURFACE_LIFT[a.g.surface];
    if (lift !== 0) return lift;
    const one = (OF_ONE_LIFT[b.g.surface] ?? 0) - (OF_ONE_LIFT[a.g.surface] ?? 0);
    if (one !== 0) return one;
    if (Math.abs(a.area - b.area) > 1e-6) return a.area - b.area;
    return a.box.minX - b.box.minX || a.box.minZ - b.box.minZ || a.i - b.i;
  };

/** A ring as Clipper gives it, its repeated points dropped. */
const distinct = (ring: readonly Pt[]): Pt[] => {
  const out: Pt[] = [];
  for (const p of ring) {
    const last = out[out.length - 1];
    if (!last || last.x !== p.x || last.z !== p.z) out.push(p);
  }
  if (out.length > 1 && out[0]!.x === out[out.length - 1]!.x && out[0]!.z === out[out.length - 1]!.z) out.pop();
  return out;
};

/**
 * An outer ring of a difference with its holes as one outline, straightened; where that would make
 * it cross itself, not straightened. Null when it crosses itself even so: a spike or a neck a
 * millimetre or two wide, between a cut edge and the 0.1 m steps of an uncut one.
 */
const outline = (outer: Path64, holes: readonly Path64[]): Pt[] | null => {
  for (const straight of [STRAIGHT, 0]) {
    const o = removeCollinear(toPts(outer), straight);
    const r = distinct(holes.length > 0 ? cutHoles(o, holes.map((h) => removeCollinear(toPts(h), straight))) : ccw(o));
    if (!selfIntersects(r)) return r;
  }
  return null;
};

/** A difference's paths as the ground's outlines: each outer ring with the holes inside it cut in (`outline`), crumbs dropped. */
const outlines = (paths: Paths64, opened = false): number[][] => {
  const outers = paths.filter((p) => isPositive(p));
  const holes = paths.filter((p) => !isPositive(p));
  // A hole is the smallest outer ring's round it.
  const size = outers.map((o) => Math.abs(signedArea(toPts(o))));
  const owner = holes.map((h) => outers.reduce((best, o, k) => (pointInRing(toPts(h)[0]!, toPts(o)) && (best < 0 || size[k]! < size[best]!) ? k : best), -1));
  return outers.flatMap((o, k) => {
    if (size[k]! < CRUMB) return [];
    const own = holes.filter((_, n) => owner[n] === k);
    const r = outline(o, own);
    // Its spikes and necks narrower than `NECK` opened (shrunk and grown back): gaps of a centimetre at most.
    const open = (d: number, p: Paths64) => inflatePaths(p, d * SCALE, JoinType.Miter, EndType.Polygon, 2);
    if (!r) return opened ? [] : outlines(intersect(open(NECK, open(-NECK, [o, ...own])), [o, ...own], FillRule.NonZero), true);
    return Math.abs(signedArea(r)) >= CRUMB ? [r.flatMap((p) => [p.x, p.z])] : [];
  });
};

/**
 * The chunk's ground (`chunkGround`, with the cover's fills) as disjoint pieces: each piece less
 * the pieces ranked over it (`before`) as they are laid, cut and with their crumbs dropped, so it
 * keeps what of it they dropped; in the order and with the properties it came in. One a piece over
 * it splits comes out as its parts, one wholly under others not at all.
 */
export const partitionGround = (ground: readonly GroundOut[], rank: Rank = "drawn"): GroundOut[] => {
  const ranked: Ranked[] = ground.flatMap((g, i) => {
    const ring = ccw(ringOf(g.outline));
    return g.bridge || ring.length < 3 ? [] : [{ i, g, path: toPath(ring), box: ringBounds(ring), area: Math.abs(signedArea(ring)) }];
  });
  ranked.sort(before(rank));
  const laid = new SpatialHash<{ readonly box: Rect; readonly path: Path64 }>(16);
  const lay = (box: Rect, path: Path64) => laid.insert({ box, path }, box.minX, box.minZ, box.maxX, box.maxZ);
  const cut = new Map<number, number[][]>();
  for (const r of ranked) {
    const near = laid.query(r.box.minX, r.box.minZ, r.box.maxX, r.box.maxZ).filter((o) => overlaps(o.box, r.box));
    const left = near.length > 0 ? difference([r.path], near.map((o) => o.path), FillRule.NonZero) : [];
    if (near.length === 0 || r.area - areaOf(left) < SPECK) {
      lay(r.box, r.path);
      continue;
    }
    const parts = outlines(left);
    cut.set(r.i, parts);
    for (const o of parts) lay(ringBounds(ringOf(o)), toPath(ringOf(o)));
  }
  return ground.flatMap((g, i) => {
    const parts = cut.get(i);
    return parts ? parts.map((outline) => ({ ...g, outline })) : [g];
  });
};
