/**
 * Bands along lines built with Clipper2 (ADR-0078, step 2): the buffer of a way's axis, as
 * `ST_Buffer` lays it, with round joins. The buffer is the union of the band (NonZero), so a way
 * that bends back over itself or loops round onto its own node gives an outline that never
 * crosses itself (G-658, G-659); a loop's inside is a hole, laid as one ring with a seam
 * (`cutHoles`), as the ground output has outlines only. A band's end is square; where the way
 * meets another way it is round (`roundJoints`), filling the corner two square ends leave bare
 * (G-658, G-671). Clipper works on integers: millimetres, so the same input gives the same rings.
 * The rings are simplified here, finer than a chunk simplifies the ground (`chunkGround`, 0.3 m),
 * and not again in a chunk (`holed`): simplified anew from wherever Clipper starts a ring, a
 * carriageway's edge and its sidewalk's edge round a bend would part.
 */
import { EndType, FillRule, JoinType, type Path64, type Paths64, difference, inflatePaths, intersect, isPositive, simplifyPaths, union } from "clipper2-ts";
import { SpatialHash } from "../../../packages/core/src/math/spatial-hash.ts";
import { type Pt, ccw, offsetLine, pointInRing, r1, ringBounds, selfIntersects, signedArea } from "./geometry.ts";
import { cutHoles } from "./ring-holes.ts";

/** Clipper's grid: millimetres. */
const SCALE = 1000;
/** The most a round join's or end's arc strays from the circle (m, ADR-0078). */
const ARC = 0.1;
/** The farthest a mitred corner reaches, in times the offset: as the importer's own `offsetLine`. */
const MITRE = 3;
/** The buffer's outline simplified to this (m, ADR-0078's variant B). */
const SIMPLIFY = 0.1;
/** Bits of a round end smaller than this are dropped (m²). */
const MIN_CAP = 0.3;
/** The shortest edge a bit of a round end shares with its band (m): one touching it at a point would pinch the band's outline. */
const TOUCH = 0.5;
/** Holes in a band smaller than this are filled (m²). */
const MIN_HOLE = 1;
/** Half the width of the narrowest bit of a round end kept (m): narrower, it is a sliver along an edge, and the rounding to 0.1 m would cross it over. */
const SLIVER = 0.1;

/** Where a band's end is to be round: its way's end on another way's node, and the band's half width. */
export interface RoundEnd {
  readonly at: Pt;
  readonly half: number;
  /** An end that stays square (steps, a zebra): it only bounds the round ends of the others there. */
  readonly square?: true;
}

const toPath = (line: readonly Pt[]): Path64 => line.map((p) => ({ x: Math.round(p.x * SCALE), y: Math.round(p.z * SCALE) }));
const toPts = (path: Path64): Pt[] => path.map((p) => ({ x: p.x / SCALE, z: p.y / SCALE }));
const outlines = (paths: Paths64): number => paths.filter((p) => isPositive(p)).length;

/** A path's area in Clipper's units (positive counter-clockwise). */
const areaOf = (p: Path64): number => {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
};

/** Whether a line comes back to its first point: a loop, buffered on both sides of its ring. */
const closed = (line: readonly Pt[]): boolean => line.length >= 4 && line[0]!.x === line[line.length - 1]!.x && line[0]!.z === line[line.length - 1]!.z;

/** Clipper's paths (a union already) as rings: each outline with the holes inside it cut in. */
const asRings = (paths: Paths64): Pt[][] => {
  const outers = paths.filter((p) => isPositive(p)).map(toPts);
  // A hole smaller than `MIN_HOLE` is filled: a speck the round ends close round, its seam crossed over by the rounding to 0.1 m.
  const holes = paths.filter((p) => !isPositive(p) && -areaOf(p) >= MIN_HOLE * SCALE * SCALE).map(toPts);
  // A hole is the smallest outline's round it (a ring round a loop's hole lies in another ring's hole).
  const size = outers.map((o) => Math.abs(signedArea(o)));
  const owner = holes.map((h) => outers.reduce((best, o, i) => (pointInRing(h[0]!, o) && (best < 0 || size[i]! < size[best]!) ? i : best), -1));
  return outers
    .map((o, i) => {
      const inside = holes.filter((_, k) => owner[k] === i);
      return inside.length > 0 ? cutHoles(o, inside) : ccw(o);
    })
    .filter((r) => r.length >= 3 && Math.abs(signedArea(r)) > 1e-6);
};

/** Simplified, then mended: simplifying may let a narrow neck touch, the union mends it. */
const simplified = (paths: Paths64): Paths64 => union(simplifyPaths(paths, SIMPLIFY * SCALE, true), FillRule.NonZero);

/** The buffer of `line` `half` metres each side, round joins (or mitred, up to `MITRE` times `half`), square ends (a loop: all the way round). */
const buffer = (line: readonly Pt[], half: number, end = EndType.Butt, join = JoinType.Round): Paths64 => {
  const loop = closed(line);
  const path = toPath(loop ? line.slice(0, -1) : line);
  return inflatePaths([path], half * SCALE, join, loop ? EndType.Joined : end, MITRE, ARC * SCALE);
};

/** A band `width` wide centred on `line`, its ends square: its rings. */
export const bufferBand = (line: readonly Pt[], width: number): Pt[][] => (line.length < 2 || width <= 0 ? [] : asRings(simplified(buffer(line, width / 2))));

/**
 * A strip `width` wide along `line`, from `from` metres off it to its left (negative: right): a
 * sidewalk. It is what lies between the buffers of the line `from` and `from + width` wide on
 * that side, so its inner edge runs round a bend on the same arc as the band of the line's own
 * carriageway (`bufferBand`), with no gap between; its outer edge keeps its corner (mitred, as
 * the building line a sidewalk runs along does at a street's corner); its ends are square, as a
 * sidewalk stops at the kerb it meets. A strip centred on the line is its buffer.
 */
export const stripBand = (line: readonly Pt[], from: number, width: number): Pt[][] => {
  if (line.length < 2 || width <= 0) return [];
  if (from < 0 && from + width > 0) return Math.abs(from + width / 2) < 1e-9 ? bufferBand(line, width) : bufferBand(offsetLine(line, from + width / 2), width);
  const [near, far] = [Math.min(Math.abs(from), Math.abs(from + width)), Math.max(Math.abs(from), Math.abs(from + width))];
  // The inner buffer runs on past the line's ends: ending on the outer one's end, it would join the two sides' strips along it.
  const both = difference(buffer(line, far, EndType.Butt, JoinType.Miter), buffer(line, near, EndType.Square), FillRule.NonZero);
  // The side's pieces: those its middle line, offset off the middle of each segment, runs through.
  const mid = offsetLine(line, from + width / 2);
  const probes = mid.slice(1).map((p, i) => ({ x: (p.x + mid[i]!.x) / 2, z: (p.z + mid[i]!.z) / 2 }));
  return asRings(simplified(both)).filter((r) => probes.some((p) => pointInRing(p, r)));
};

/** A band `roundJoints` reads and rounds: its ring, the ends to round, and whether it lies on a bridge. */
export interface JointBand {
  /** What it is paved with: a gap between two bands is patched where they are of one (`gapFills`). */
  readonly surface?: string;
  readonly ring: readonly Pt[];
  readonly bridge: boolean;
  readonly roundEnds?: readonly RoundEnd[];
}

/** Whether a band's outline crosses itself once rounded to the tables' 0.1 m (`r1`): a bit pinched on at a point does. */
const crossesOnGrid = (paths: Paths64): boolean => asRings(paths).some((r) => selfIntersects(r.map((p) => ({ x: r1(p.x), z: r1(p.z) }))));

/** A round end's disc. */
const disc = (end: RoundEnd): Paths64 => inflatePaths([toPath([end.at])], end.half * SCALE, JoinType.Round, EndType.Round, 2, ARC * SCALE);

/** Under this a round end's bare ground is no bit (m²): far under `MIN_CAP`, so a bit `bareBits` keeps is never skipped. */
const SPECK = 0.01;

/** The area of `paths` less `clip` (m²). */
const bareArea = (paths: Paths64, clip: Paths64): number => difference(paths, clip, FillRule.NonZero).reduce((s, p) => s + areaOf(p), 0) / (SCALE * SCALE);

/** The bare bits of a round end: its disc less what is covered, opened (shrunk and grown back) so no sliver along the edges it meets is left. */
const bareBits = (end: RoundEnd, covered: Paths64): Paths64 => {
  const open = (paths: Paths64, d: number) => inflatePaths(paths, d * SCALE, JoinType.Round, EndType.Polygon, 2, ARC * SCALE);
  const bare = difference(disc(end), covered, FillRule.NonZero);
  // Clipped back to the bare ground, so a bit shares its edges with the band it joins.
  return intersect(open(open(bare, -SLIVER), SLIVER + 0.005), bare, FillRule.NonZero).filter((p) => isPositive(p) && areaOf(p) >= MIN_CAP * SCALE * SCALE);
};

/** A path's points rounded to the tables' 0.1 m (`r1`), as the ground is drawn. */
const onGrid = (p: Path64): Path64 => p.map((q) => ({ x: Math.round(r1(q.x / SCALE) * SCALE), y: Math.round(r1(q.y / SCALE) * SCALE) }));

/**
 * The gaps a round end leaves between the bands meeting at its point, on the 0.1 m grid the tables
 * round them to (G-760): a crack between the bands of its surface (`same`), as two streets' square
 * ends a degree or two apart, or one cut across the node rounded apart for each band, leave, over
 * a footway crossing there or a square's area under the street too; and the bare ground no band
 * near covers (`all`) the round end's
 * bit did not take, a wedge `bareBits` drops (narrower than `SLIVER`, under `MIN_CAP`) or one whose
 * bit would split its band's outline. Each is grown by `SLIVER` within the disc (and as far past
 * it, which a polygon's chords cut short), so it laps over the bands round it by more than the
 * rounding moves their edges: an overlay in the joint, not a bit edge to edge.
 */
const gapFills = (end: RoundEnd, same: Paths64, all: Paths64): Paths64 => {
  const grow = (paths: Paths64, d: number) => inflatePaths(paths, d * SCALE, JoinType.Round, EndType.Polygon, 2, ARC * SCALE);
  const round = disc(end);
  const small = (paths: Paths64) => paths.reduce((s, p) => s + areaOf(p), 0) < MIN_CAP * SCALE * SCALE;
  // A crack: its part wider than `2 * SLIVER` is smaller than `MIN_CAP`.
  const crack = (p: Path64) => small([p]) || small(grow(grow([p], -SLIVER), SLIVER));
  const cracks = difference(round, same, FillRule.NonZero).filter((p) => isPositive(p) && crack(p));
  const wedges = difference(round, all, FillRule.NonZero).filter((p) => isPositive(p) && !crack(p));
  if (cracks.length + wedges.length === 0) return [];
  // Mitred, not round: fewer points, and the disc clips the corners.
  const lap = inflatePaths([...cracks, ...wedges], SLIVER * SCALE, JoinType.Miter, EndType.Polygon, 2);
  return intersect(lap, disc({ at: end.at, half: end.half + SLIVER }), FillRule.NonZero).filter((p) => isPositive(p));
};

/** Whether `bit` joins `ring` along an edge (`TOUCH` long at least), not at a point. */
const touches = (bit: Path64, ring: Paths64): boolean =>
  intersect(inflatePaths([bit], 0.02 * SCALE, JoinType.Miter, EndType.Polygon), ring, FillRule.NonZero).reduce((s, p) => s + Math.abs(areaOf(p)), 0) >= 0.02 * TOUCH * SCALE * SCALE;

/** A band laid over a gap in a joint (`gapFills`), of the band `of` whose end it joins (its surface). */
export type Patch<B> = (of: B, ring: Pt[]) => B;

/**
 * The bands' ends at other ways made round, as far as nothing else covers the round end: the
 * corner two square ends leave bare on the outer side of a bend is filled, and the round end
 * laid over the band it meets adds no second layer there (the ground is still drawn in layers
 * until ADR-0078's step 3). The ends at a point are rounded in the bands' order, each round
 * what the bands and the ends before it cover; a bit not touching its own band is dropped (the
 * far side of a round end across a narrower street). Returns the bands, a rounded one with its
 * new ring (`holed`, as the rings of `bufferBand`); with `patch`, the gaps' patches too, each
 * after the band whose end it joins. A patch is a band of its own, so a carriageway's outline,
 * its kerb and the markings cut at the next street read no lap over that street (G-760).
 */
export const roundJoints = <B extends JointBand>(bands: readonly B[], patch?: Patch<B>): B[] => {
  // A bridge's deck covers too: a round end is not laid under it. Its own ends stay square.
  const all = bands.map((_, i) => i);
  const grid = new SpatialHash<number>(16);
  for (const i of all) {
    const r = ringBounds(bands[i]!.ring);
    grid.insert(i, r.minX, r.minZ, r.maxX, r.maxZ);
  }
  const rings = new Map<number, Paths64>(all.map((i) => [i, [toPath(bands[i]!.ring)]]));
  const ends = new Map<string, { i: number; end: RoundEnd }[]>();
  for (const i of all.filter((k) => !bands[k]!.bridge)) {
    for (const end of bands[i]!.roundEnds ?? []) {
      const key = `${end.at.x},${end.at.z}`;
      ends.set(key, [...(ends.get(key) ?? []), { i, end }]);
    }
  }
  // No wider than the widest other way ending there: a broad street ending at a narrow path's end
  // (a flight of steps up from it) is not to spread past the path's sides.
  const roundEnd = (list: readonly { i: number; end: RoundEnd }[], i: number, end: RoundEnd): RoundEnd => {
    const others = list.filter((e) => e.i !== i).map((e) => e.end.half);
    return { at: end.at, half: others.length > 0 ? Math.min(end.half, Math.max(...others)) : end.half };
  };
  const changed = new Set<number>();
  for (const list of ends.values()) {
    const reach = Math.max(...list.map((e) => e.end.half));
    const { x, z } = list[0]!.end.at;
    const near = grid.query(x - reach, z - reach, x + reach, z + reach).sort((p, q) => p - q);
    // Most round ends lie whole on the bands they meet (a way going on straight): the widest end's
    // disc less the bands near, as they come (no union first), and nothing to do if it leaves not a speck.
    if (bareArea(disc({ at: { x, z }, half: reach }), near.flatMap((i) => rings.get(i)!)) < SPECK) continue;
    let covered = union(near.flatMap((i) => rings.get(i)!), FillRule.NonZero);
    for (const { i, end } of list) {
      if (end.square) continue;
      for (const bit of bareBits(roundEnd(list, i, end), covered)) {
        // Only a bit that joins the band along an edge, not at a point: its outlines are no more than before.
        if (!touches(bit, rings.get(i)!)) continue;
        const own = union(rings.get(i)!, [bit], FillRule.NonZero);
        if (outlines(own) !== outlines(rings.get(i)!) || crossesOnGrid(own)) continue;
        rings.set(i, own);
        changed.add(i);
        covered = union(covered, [bit], FillRule.NonZero);
      }
    }
  }
  const patches = new Map<number, Pt[][]>();
  const laidOf = (ks: readonly number[]) => union(ks.flatMap((k) => rings.get(k)!.map(onGrid)), FillRule.NonZero);
  for (const list of patch ? ends.values() : []) {
    const meeting = [...new Set(list.map((e) => e.i))];
    if (meeting.length < 2) continue;
    // As the tables round them: the bands meeting here of each surface, every band near (a sidewalk,
    // a square's area: a wedge under it is no gap), and the patches laid on them before.
    const reach = Math.max(...list.map((e) => e.end.half)) + SLIVER;
    const { x, z } = list[0]!.end.at;
    let all = laidOf(grid.query(x - reach, z - reach, x + reach, z + reach).sort((p, q) => p - q));
    const same = new Map<string | undefined, Paths64>();
    for (const { i, end } of list) {
      if (end.square) continue;
      const surface = bands[i]!.surface;
      const own = same.get(surface) ?? laidOf(meeting.filter((k) => bands[k]!.surface === surface));
      const fills = gapFills(roundEnd(list, i, end), own, all).filter((f) => touches(f, rings.get(i)!));
      // On the grid before the union: a thin patch rounded after it would cross itself.
      const kept = asRings(union(fills.map(onGrid), FillRule.NonZero)).filter((r) => !selfIntersects(r.map((p) => ({ x: r1(p.x), z: r1(p.z) }))));
      const on = kept.map((r) => onGrid(toPath(r)));
      same.set(surface, union(own, on, FillRule.NonZero));
      all = union(all, on, FillRule.NonZero);
      if (kept.length > 0) patches.set(i, [...(patches.get(i) ?? []), ...kept]);
    }
  }
  return bands.flatMap((b, i) => {
    const [ring] = changed.has(i) ? asRings(rings.get(i)!) : [];
    const own = ring ? { ...b, ring, holed: true as const } : b;
    return [own, ...(patches.get(i) ?? []).map((r) => patch!(own, r))];
  });
};
