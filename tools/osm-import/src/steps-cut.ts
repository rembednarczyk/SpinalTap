/**
 * The ground lifted higher than steps (`SURFACE_LIFT`) cut off a flight's outline in a chunk
 * (G-781): a footway (0.09 m) or a square (0.08 m) on a flight (0.05 m) breaks through its lowest
 * tread, a dark wedge with an ink edge where the flight meets the paving, and on its top tread lies
 * paving over the stone. Cut once the chunk has rounded both: the flight's pieces are what the
 * renderer draws, so the hole they leave is theirs. The corners the cut adds stay where the edges
 * cross, to the millimetre, off the 0.1 m grid: rounded to it, a corner on a long slanting edge of
 * a flight swings the edge over the treads by a few centimetres, a sliver up to 0.3 m² (Krakowskie's
 * square, 17.9; 1.9). The decks lie apart from the ground, so a bridge's pieces neither cut nor are cut.
 */
import { FillRule, type Path64, type Paths64, difference, intersect, isPositive, union } from "clipper2-ts";
import { SURFACE_LIFT } from "../../../packages/core/src/world/city-geo.ts";
import { type Pt, type Rect, ccw, pointInRing, removeCollinear, ringBounds, signedArea } from "./geometry.ts";
import { type GroundOut } from "./model.ts";
import { cutHoles } from "./ring-holes.ts";

/** Clipper's grid: millimetres. */
const SCALE = 1000;
/** The least piece kept of a cut one (m²): a cell of the 0.1 m grid. */
const MIN_LEFT = 0.01;
/** An overlap left as it is (m²): a piece's edge on a flight's, off by Clipper's millimetres. */
const SPECK = 0.001;
/** How far a corner may lie off the line of its neighbours and be dropped (m): a millimetre's crossing on a straight edge. */
const STRAIGHT = 0.005;

const ringOf = (flat: readonly number[]): Pt[] => Array.from({ length: flat.length >> 1 }, (_, i) => ({ x: flat[2 * i]!, z: flat[2 * i + 1]! }));
const toPath = (r: readonly Pt[]): Path64 => r.map((p) => ({ x: Math.round(p.x * SCALE), y: Math.round(p.z * SCALE) }));
const toPts = (p: Path64): Pt[] => p.map((q) => ({ x: q.x / SCALE, z: q.y / SCALE }));
const overlap = (a: Rect, b: Rect) => a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;
const area = (paths: Paths64) => Math.abs(paths.reduce((s, p) => s + signedArea(toPts(p)), 0));

/** Clipper's paths as rings: each outline with the holes inside it cut in (`cutHoles`), as the ground has outlines only. */
const rings = (paths: Paths64): Pt[][] => {
  const outers = paths.filter((p) => isPositive(p)).map(toPts);
  const holes = paths.filter((p) => !isPositive(p)).map(toPts);
  const straight = (r: readonly Pt[]) => removeCollinear(r, STRAIGHT);
  return outers
    .map((o) => {
      const inside = holes.filter((h) => pointInRing(h[0]!, o)).map(straight);
      return inside.length > 0 ? cutHoles(straight(o), inside) : ccw(straight(o));
    })
    .filter((r) => r.length >= 3 && Math.abs(signedArea(r)) >= MIN_LEFT);
};

/** Each piece of `out` lifted over steps, less the chunk's flights (`ground` read by `ground(o)`); the rest as they are, in their order. */
export const offSteps = <T>(out: readonly T[], ground: (o: T) => GroundOut, put: (o: T, g: GroundOut) => T): T[] => {
  const flights = out.map(ground).filter((g) => g.surface === "steps" && !g.bridge);
  if (flights.length === 0) return [...out];
  const all = union(flights.map((g) => toPath(ringOf(g.outline))), FillRule.NonZero);
  const box = (p: Path64) => ringBounds(toPts(p));
  const boxes = all.map(box);
  return out.flatMap((o) => {
    const g = ground(o);
    if (g.bridge || SURFACE_LIFT[g.surface] <= SURFACE_LIFT.steps) return [o];
    const own = [toPath(ringOf(g.outline))];
    const near = all.filter((_, i) => overlap(boxes[i]!, box(own[0]!)));
    if (near.length === 0 || area(intersect(own, near, FillRule.NonZero)) <= SPECK) return [o];
    return rings(difference(own, near, FillRule.NonZero)).map((r) => put(o, { ...g, outline: r.flatMap((p) => [p.x, p.z]) }));
  });
};
