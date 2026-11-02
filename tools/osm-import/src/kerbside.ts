/** What the kerbs of the map allow a parked car: the car parks mapped as areas, the bus stops and the streets of many lanes. */
import { type Area, type Line } from "./features.ts";
import { type Pt, type Rect, clipLineToRect, inRect, lineLength, r1, rectsOverlap, ringBounds, simplifyLine } from "./geometry.ts";
import { type CarParkOut, type MultiLaneWayOut } from "./model.ts";
import { type OsmData, type Tags } from "./osm.ts";
import { geoToWorld } from "./project.ts";

/** A car park on the ground: not under it, not a multi-storey's or a roof's deck. */
const groundCarPark = (t: Tags): boolean =>
  t.amenity === "parking" && t.parking !== "underground" && t.parking !== "multi-storey" && t.parking !== "rooftop" && Number(t.layer ?? 0) >= 0 && t.building === undefined;

/**
 * The car parks reaching into the chunk, by map id (one reaching over a chunk's edge is in both),
 * with their `parking` kind, the `orientation` of their bays when mapped and outline: the kerbs
 * where the map says cars park, and how (along the kerb or across it, G-177).
 */
export const chunkCarParks = (areas: readonly Area[], rect: Rect): CarParkOut[] =>
  areas
    .filter((a) => groundCarPark(a.tags) && rectsOverlap(ringBounds(a.ring), rect))
    .map((a) => ({
      id: a.id,
      kind: a.tags.parking ?? "surface",
      ...(a.tags.orientation !== undefined ? { orientation: a.tags.orientation } : {}),
      outline: a.ring.flatMap((p) => [r1(p.x), r1(p.z)]),
    }));

/** A bus stop's post or platform (not the stop position on the carriageway). */
const stopPost = (t: Tags): boolean => t.highway === "bus_stop" || t.public_transport === "platform" || t.highway === "platform";

/** Bus stops this far past a chunk's edge are its own too: no car parks in the 15 m before or after one (m). */
const STOP_MARGIN = 25;

/** Every bus stop's post (a node) and each vertex of a platform drawn as a way, in map order. */
export const busStopPosts = (data: OsmData, lines: readonly Line[], areas: readonly Area[]): Pt[] => [
  ...[...data.nodes.values()].sort((a, b) => a.id - b.id).flatMap((n) => (n.tags && stopPost(n.tags) ? [geoToWorld(n.lat, n.lon)] : [])),
  ...[...lines.map((l) => ({ tags: l.tags, pts: l.line })), ...areas.map((a) => ({ tags: a.tags, pts: a.ring }))].flatMap((w) => (stopPost(w.tags) ? w.pts : [])),
];

/**
 * The bus stops by the chunk, flat x, z. No car stops less than 15 m from a post (art. 49 ust. 1
 * pkt 9 PoRD, G-156), so the stops just past the chunk's edge come along.
 */
export const chunkBusStops = (posts: readonly Pt[], rect: Rect): number[] => {
  const near: Rect = { minX: rect.minX - STOP_MARGIN, minZ: rect.minZ - STOP_MARGIN, maxX: rect.maxX + STOP_MARGIN, maxZ: rect.maxZ + STOP_MARGIN };
  return posts.filter((p) => inRect(p, near)).flatMap((p) => [r1(p.x), r1(p.z)]);
};

/** A street of two lanes or more a way: `lanes` 4 or more, or `lanes:forward` or `lanes:backward` 2 or more. */
const multiLane = (t: Tags): boolean => Number(t.lanes ?? 0) >= 4 || Number(t["lanes:forward"] ?? 0) >= 2 || Number(t["lanes:backward"] ?? 0) >= 2;

/**
 * The axes of the streets of two lanes or more a way, clipped to the chunk: a car parked by such
 * a kerb stands on the outer lane, so none parks there outside a mapped car park (G-155).
 */
export const chunkMultiLaneWays = (lines: readonly Line[], rect: Rect): MultiLaneWayOut[] =>
  lines
    .filter((l) => l.tags.highway !== undefined && l.tags.area !== "yes" && multiLane(l.tags))
    .flatMap((l) => clipLineToRect(l.line, rect))
    .filter((piece) => lineLength(piece) >= 0.1)
    .map((piece) => ({ line: simplifyLine(piece, 0.5).flatMap((q) => [r1(q.x), r1(q.z)]) }));
