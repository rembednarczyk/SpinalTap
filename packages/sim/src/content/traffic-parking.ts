import { type Pt, polylineLength } from "./lublin/roads";
import { MAP_CHUNKS } from "./lublin/sites";
import { stripCut } from "./kerb-bays";
import { pointAt } from "./traffic-lane";

/**
 * The lane of a one-lane street beside a parking strip the map draws inside its carriageway
 * (ADR-0105). OSM maps street parking as its own area (`amenity=parking` with `parking=street_side`
 * or `lane`, the wiki's "Street parking" scheme), and where the carriageway's width counts that
 * strip (BDOT10k measures the asphalt kerb to kerb: Peowiaków's 5.7 m) a lane on the axis runs over
 * the bays. The street's cross-section is then split as a street design tool splits it, into a
 * parking lane and a moving lane, and the lane keeps to the middle of the part the strip leaves.
 * One shift a street, read off the median of its strips' inner edges, as `lanesOf` sets one
 * offset a lane; a strip outside the carriageway (a bay past the kerb) moves nothing.
 */

const KERB_KINDS: ReadonlySet<string> = new Set(["street_side", "lane", "half_on_kerb"]);
const KERB_PARKS: readonly (readonly Pt[])[] = [...new Map(MAP_CHUNKS.flatMap((c) => c.carParks ?? []).map((p) => [p.id, p])).values()]
  .filter((p) => KERB_KINDS.has(p.kind))
  .map((p) => Array.from({ length: p.outline.length / 2 }, (_, i): Pt => [p.outline[2 * i]!, p.outline[2 * i + 1]!]));

/** A strip is the street's own when it lies within this of its axis (m), as `bayCars` reaches. */
const REACH = 8;
/** The strip's edge is looked for this often along the axis (m). */
const STEP = 2;
/** Half a moving car and the room it keeps from the cars in the strip and from the far kerb (m). */
const LANE_HALF = 1.1;

/** Median of the inner edges of the kerb strips on one side of an axis, or Infinity where there is none. */
const innerEdge = (axis: readonly Pt[], side: 1 | -1, rings: readonly (readonly Pt[])[]): number => {
  const edges: number[] = [];
  const len = polylineLength(axis);
  for (let s = STEP / 2; s < len; s += STEP) {
    const p = pointAt(axis, s);
    const across = (d: number) => ({ x: p.x + p.tz * side * d, z: p.z - p.tx * side * d });
    const from = rings.map((r) => stripCut(r, across, REACH)?.from ?? Infinity).reduce((a, b) => Math.min(a, b), Infinity);
    if (from < Infinity) edges.push(from);
  }
  return edges.sort((a, b) => a - b)[Math.floor(edges.length / 2)] ?? Infinity;
};

/**
 * How far right of the axis the one lane of a street runs (m, negative to the left), given its
 * carriageway's reach right and left: the middle of the carriageway less the strips inside it,
 * held where a car keeps off both kerbs. Zero for a street without such a strip.
 */
export const parkingShift = (axis: readonly Pt[], right: number, left: number): number => {
  const xs = axis.map((p) => p[0]);
  const zs = axis.map((p) => p[1]);
  const [minX, maxX, minZ, maxZ] = [Math.min(...xs) - REACH, Math.max(...xs) + REACH, Math.min(...zs) - REACH, Math.max(...zs) + REACH];
  const rings = KERB_PARKS.filter((r) => r.some(([x, z]) => x >= minX && x <= maxX && z >= minZ && z <= maxZ));
  if (rings.length === 0) return 0;
  const r = Math.min(right, innerEdge(axis, 1, rings));
  const l = Math.min(left, innerEdge(axis, -1, rings));
  if (r === right && l === left) return 0;
  return Math.max(-Math.max(0, left - LANE_HALF), Math.min(Math.max(0, right - LANE_HALF), (r - l) / 2));
};
