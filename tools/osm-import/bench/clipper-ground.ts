/**
 * Measurement prototype (ADR-0078), not on the production path: a chunk's ground built with
 * Clipper2 (Vatti clipping, integer coordinates) instead of the importer's own strips and draw
 * order. Three steps, as the ADR's migration plan stages them:
 *  1. line buffers with round joins (`JoinType.Round`); ends round where the way meets another
 *     way's end or vertex, butt elsewhere (a dead end or the map's edge stays square);
 *  2. a planar partition: every surface's union minus the union of all surfaces drawn above it,
 *     so the pieces are disjoint and no gap or overlap depends on the draw order;
 *  3. the result clipped to the chunk's rect (`rectClip`).
 * Steps and zebras keep their rings (the renderer reads a flight's run and a zebra's stripes
 * off them); areas keep theirs, repaired by the union (NonZero).
 */
import { performance } from "node:perf_hooks";
import { EndType, FillRule, JoinType, type Path64, type Paths64, PointInPolygonResult, type Rect64, difference, getBounds, inflatePaths, intersect, isPositive, pointInPolygon, rectClip, reversePath, simplifyPaths, union } from "clipper2-ts";
import { type GroundSurface } from "../../../packages/core/src/world/city-geo.ts";
import { type Band } from "../src/ground.ts";
import { type Pt, type Rect, bufferLine, ccw, clipRingToRect, r1, removeCollinear, simplifyRing } from "../src/geometry.ts";
import { widenPieces } from "../src/kerb-widen.ts";

/** Clipper works on integers: millimetres (`PROTO_SCALE` to measure another grid; 100, centimetres, leaves 7x the overlap). */
export const SCALE = Number(process.env.PROTO_SCALE ?? 1000);
export interface ProtoOptions {
  /** The most a round join's arc strays from the true circle (m). */
  readonly arc: number;
  /** Morphological closing radius (m): gaps narrower than twice it are filled; 0 for none. */
  readonly close: number;
  /** Simplification of each band's shape before the partition (m), so the pieces stay disjoint; 0 for none. */
  readonly simplify?: number;
}
export const DEFAULTS: ProtoOptions = { arc: 0.05, close: 0 };
/** Milliseconds spent in each step, summed over calls. */
export const timings = { shapes: 0, partition: 0, close: 0 };

/** The importer's draw order (`ground.ts`, not exported there): higher draws over lower. */
export const ORDER: Record<GroundSurface, number> = { water: 0, grass: 1, square: 2, road: 3, cobble: 4, crossing: 5, sidewalk: 6, footway: 7, steps: 8, rail: 9, basin: 10 };
/** Surfaces whose ring the renderer reads as more than an outline. */
const KEEP = new Set<GroundSurface>(["steps", "crossing"]);

export const toPath = (ring: readonly Pt[]): Path64 => ring.map((p) => ({ x: Math.round(p.x * SCALE), y: Math.round(p.z * SCALE) }));
export const toPts = (path: Path64): Pt[] => path.map((p) => ({ x: p.x / SCALE, z: p.y / SCALE }));
const positive = (p: Path64): Path64 => (isPositive(p) ? p : reversePath(p));

/**
 * The axis and width of a ring `stripAlong` built (`bufferLine`, a laid sidewalk): its points
 * pair up end to end, the pairs' midpoints are the axis. Null when the ring is not such a strip.
 */
export const stripAxis = (ring: readonly Pt[]): { line: Pt[]; width: number } | null => {
  const n = ring.length;
  if (n < 4 || n % 2 !== 0) return null;
  const line: Pt[] = [];
  for (let i = 0; i < n / 2; i++) line.push({ x: (ring[i]!.x + ring[n - 1 - i]!.x) / 2, z: (ring[i]!.z + ring[n - 1 - i]!.z) / 2 });
  const gap = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.z - b.z);
  const width = gap(ring[0]!, ring[n - 1]!);
  if (width < 0.1 || Math.abs(width - gap(ring[n / 2 - 1]!, ring[n / 2]!)) > 0.02) return null;
  const back = bufferLine(line, width);
  return ring.every((p) => back.some((q) => gap(p, q) < 0.02)) ? { line, width } : null;
};

const key = (p: Pt) => `${Math.round(p.x * 10)},${Math.round(p.z * 10)}`;

/** A band's shape before the partition: a buffer of its axis where it has one, else its ring. */
export const bandShape = (b: Band, joined: ReadonlySet<string>, arc = DEFAULTS.arc): Paths64 => {
  const ring = [positive(toPath(b.ring))];
  if (KEEP.has(b.surface) || b.holed) return ring;
  const axis = b.kerb ? { line: [...b.kerb.line], width: 2 * b.kerb.half } : stripAxis(b.ring);
  if (!axis || axis.line.length < 2) return ring;
  const half = (axis.width / 2) * SCALE;
  const body = inflatePaths([toPath(axis.line)], half, JoinType.Round, EndType.Butt, 2, arc * SCALE);
  // A laid sidewalk ends square at the kerb it meets; a way's end at another way is round.
  if (b.surface === "sidewalk") return body;
  const ends = [axis.line[0]!, axis.line[axis.line.length - 1]!].filter((p) => joined.has(key(p)));
  const caps = ends.length > 0 ? inflatePaths(ends.map((p) => toPath([p])), half, JoinType.Round, EndType.Round, 2, arc * SCALE) : [];
  return [...body, ...caps];
};

/** Keys of the points where a way's end meets another way: every axis vertex seen on two axes. */
export const joinedEnds = (bands: readonly Band[]): Set<string> => {
  const seen = new Map<string, Set<string>>();
  for (const b of bands) {
    const line = b.kerb?.line ?? (KEEP.has(b.surface) || b.holed ? null : stripAxis(b.ring)?.line);
    for (const p of line ?? []) {
      const s = seen.get(key(p)) ?? new Set<string>();
      s.add(b.source);
      seen.set(key(p), s);
    }
  }
  return new Set([...seen].filter(([, s]) => s.size > 1).map(([k]) => k));
};

export interface LayerPiece {
  readonly surface: GroundSurface;
  readonly bridge: boolean;
  /** Outer rings and holes as Clipper returns them (holes negative). */
  readonly paths: Paths64;
}

/** A carriageway's widening in the chunk, as `chunkGround` lays it (G-570). */
const widenings = (b: Band, rect: Rect): Pt[][] => {
  if (!b.widen) return [];
  const clipped = clipRingToRect(ccw(b.ring), rect);
  const round = (ring: readonly Pt[]) => removeCollinear(ring.map((p) => ({ x: r1(p.x), z: r1(p.z) })), 0.02);
  const piece = clipped.length >= 3 ? ccw(round(simplifyRing(clipped, 0.3))) : null;
  return widenPieces(piece, b.widen, rect);
};

/**
 * Gaps narrower than `2 r` between the pieces, filled (a morphological closing of their union,
 * the GIS way of removing slivers): each gap goes whole to the lowest surface it touches, so a
 * strip between a carriageway and its sidewalk becomes carriageway, as `kerbFills` does (G-522).
 */
const closeGaps = (out: LayerPiece[], all: Paths64, r: number, box: Rect64): void => {
  const arc = 0.05 * SCALE;
  const grown = inflatePaths(all, r * SCALE, JoinType.Round, EndType.Polygon, 2, arc);
  // Clipped to the chunk: the closing does not reach past its edge, where the next chunk's ground is not known.
  const fill = rectClip(box, difference(inflatePaths(grown, -r * SCALE, JoinType.Round, EndType.Polygon, 2, arc), all, FillRule.NonZero));
  const ground = out.filter((l) => !l.bridge).sort((a, b) => ORDER[a.surface] - ORDER[b.surface]);
  const gaps = fill.filter((p) => isPositive(p)).map((p) => ({ p, b: getBounds(p) }));
  const free = new Set(gaps);
  const added = ground.map(() => [] as Paths64);
  ground.forEach((l, k) => {
    // The bits of the gaps along this surface, traced back to the gaps they are bits of.
    const touch = intersect(fill, inflatePaths(l.paths, 0.05 * SCALE, JoinType.Miter, EndType.Polygon), FillRule.NonZero);
    for (const bit of touch) {
      const at = bit[0]!;
      for (const g of free) {
        if (at.x < g.b.left || at.x > g.b.right || at.y < g.b.top || at.y > g.b.bottom || pointInPolygon(at, g.p) === PointInPolygonResult.IsOutside) continue;
        added[k]!.push(g.p);
        free.delete(g);
        break;
      }
    }
  });
  ground.forEach((l, k) => {
    if (added[k]!.length > 0) out[out.indexOf(l)] = { ...l, paths: union(l.paths, added[k]!, FillRule.NonZero) };
  });
};

/** The chunk's ground as disjoint pieces, one Clipper polygon set per surface (and per bridge). */
export const clipperChunk = (bands: readonly Band[], rect: Rect, opts: ProtoOptions = DEFAULTS): LayerPiece[] => {
  let t = performance.now();
  const box = { left: Math.round(rect.minX * SCALE), top: Math.round(rect.minZ * SCALE), right: Math.round(rect.maxX * SCALE), bottom: Math.round(rect.maxZ * SCALE) };
  const joined = joinedEnds(bands);
  const shapes = new Map<string, Paths64>();
  for (const b of bands) {
    const k = `${b.bridge ? "b" : "g"}:${b.surface}`;
    const list = shapes.get(k) ?? [];
    const shape = [...bandShape(b, joined, opts.arc), ...widenings(b, rect).map((r) => positive(toPath(r)))];
    list.push(...(opts.simplify ? simplifyPaths(shape, opts.simplify * SCALE, true) : shape));
    shapes.set(k, list);
  }
  timings.shapes += performance.now() - t;
  t = performance.now();
  const out: LayerPiece[] = [];
  const surfaces = [...shapes.keys()].sort((a, b) => ORDER[b.slice(2) as GroundSurface] - ORDER[a.slice(2) as GroundSurface]);
  let above: Paths64 = [];
  for (const k of surfaces) {
    const surface = k.slice(2) as GroundSurface;
    const bridge = k.startsWith("b");
    const own = rectClip(box, union(shapes.get(k)!, FillRule.NonZero));
    // A bridge's deck lies over the ground under it: it neither cuts it nor is cut.
    if (bridge) {
      out.push({ surface, bridge, paths: own });
      continue;
    }
    const paths = above.length > 0 ? difference(own, above, FillRule.NonZero) : own;
    above = union(above, own, FillRule.NonZero);
    if (paths.length > 0) out.push({ surface, bridge, paths });
  }
  timings.partition += performance.now() - t;
  t = performance.now();
  if (opts.close > 0) closeGaps(out, above, opts.close, box);
  timings.close += performance.now() - t;
  return out;
};
