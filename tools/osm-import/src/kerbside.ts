/** What the kerbs of the map allow a parked car: the car parks mapped as areas. */
import { type Area } from "./features.ts";
import { type Rect, r1, rectsOverlap, ringBounds } from "./geometry.ts";
import { type CarParkOut } from "./model.ts";
import { type Tags } from "./osm.ts";

/** A car park on the ground: not under it, not a multi-storey's or a roof's deck. */
const groundCarPark = (t: Tags): boolean =>
  t.amenity === "parking" && t.parking !== "underground" && t.parking !== "multi-storey" && t.parking !== "rooftop" && Number(t.layer ?? 0) >= 0 && t.building === undefined;

/**
 * The car parks reaching into the chunk, by map id (one reaching over a chunk's edge is in both),
 * with their `parking` kind and outline: the kerbs where the map says cars park.
 */
export const chunkCarParks = (areas: readonly Area[], rect: Rect): CarParkOut[] =>
  areas
    .filter((a) => groundCarPark(a.tags) && rectsOverlap(ringBounds(a.ring), rect))
    .map((a) => ({ id: a.id, kind: a.tags.parking ?? "surface", outline: a.ring.flatMap((p) => [r1(p.x), r1(p.z)]) }));
