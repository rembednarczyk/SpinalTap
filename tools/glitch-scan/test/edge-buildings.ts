/**
 * `edge-building-dropped` (G-556): a building of the map whose centroid lies off the map but part
 * of it on a chunk, missing from the game. The importer used to put a building in the chunk of its
 * centroid only, so one across the map's edge was dropped whole, with the part on the map too
 * (Cicha 3, 5, 6 and 8 in krakowskie-0-1, Pałac Ordynacki and the Curia of T-058).
 */
import { centroid, clipRingToRect, inRect, signedArea, type Pt, type Rect } from "../../osm-import/src/geometry.ts";
import { belowGround } from "../../osm-import/src/building-tags.ts";
import { type Area, extractFeatures } from "../../osm-import/src/features.ts";
import { withoutReplaced } from "../../osm-import/src/corrections-alchemia.ts";
import { type OsmData } from "../../osm-import/src/osm.ts";

/** A part on the map under this many square metres is a sliver of the outline's line, not a building. */
export const EDGE_PART_MIN = 2;

/**
 * A part on the map less deep than this (m) from the map's edge is a slab, not a building: it waits
 * off the map with the rest of its building for the map's widening (user's decision 8.11, backlog
 * "Poszerzanie mapy").
 */
export const EDGE_DEPTH_MIN = 3;

/** Buildings left off the map on purpose, with their reason (none: the map's edge cuts them, G-556). */
export const EDGE_DROPPED_KNOWN: Readonly<Record<string, string>> = {};

const SKIP = new Set(["no", "construction", "roof", "ruins", "demolished", "proposed"]);

/** The map's buildings as OSM has them: a building's outer ways stand for its relation, not for buildings of their own. */
export const osmBuildings = (data: OsmData): Area[] => {
  const inRelation = new Set<string>();
  for (const r of data.relations.values()) if (r.tags?.building !== undefined) for (const m of r.members) if (m.type === "way" && m.role !== "inner") inRelation.add(`w${m.ref}`);
  return withoutReplaced({ ...extractFeatures(data) }).areas.filter(
    (a) => a.tags.building !== undefined && !SKIP.has(a.tags.building) && !belowGround(a.tags) && !inRelation.has(a.id),
  );
};

type Finding = { readonly at: string; readonly what: string };

/**
 * How deep a building's parts reach into the map from its edge (m): for each chunk, from the sides
 * the outline crosses with no chunk past them, the least; the deepest of the chunks.
 */
export const depthOnMap = (ring: readonly Pt[], chunks: readonly Rect[]): number => {
  const offMap = (p: Pt) => !chunks.some((r) => p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ);
  let deepest = 0;
  for (const r of chunks) {
    const piece = clipRingToRect(ring, r);
    if (piece.length < 3 || Math.abs(signedArea(piece)) <= 0) continue;
    const c = centroid(piece);
    const sides = [
      { past: (p: Pt) => p.x < r.minX, beyond: { x: r.minX - 0.5, z: c.z }, from: (p: Pt) => p.x - r.minX },
      { past: (p: Pt) => p.x > r.maxX, beyond: { x: r.maxX + 0.5, z: c.z }, from: (p: Pt) => r.maxX - p.x },
      { past: (p: Pt) => p.z < r.minZ, beyond: { x: c.x, z: r.minZ - 0.5 }, from: (p: Pt) => p.z - r.minZ },
      { past: (p: Pt) => p.z > r.maxZ, beyond: { x: c.x, z: r.maxZ + 0.5 }, from: (p: Pt) => r.maxZ - p.z },
    ].filter((s) => ring.some(s.past) && offMap(s.beyond));
    deepest = Math.max(deepest, sides.length > 0 ? Math.min(...sides.map((s) => Math.max(...piece.map(s.from)))) : Infinity);
  }
  return deepest;
};

/** Buildings centred off every chunk with over `EDGE_PART_MIN` m² and `EDGE_DEPTH_MIN` m on them that the game has not got. */
export const edgeBuildingsDropped = (buildings: readonly Area[], chunks: readonly Rect[], inGame: ReadonlySet<string>, known = EDGE_DROPPED_KNOWN): Finding[] =>
  buildings.flatMap((b) => {
    if (inGame.has(b.id) || known[b.id] !== undefined || chunks.some((r) => inRect(centroid(b.ring), r))) return [];
    const pieces = chunks.map((r) => clipRingToRect(b.ring, r)).filter((p) => p.length >= 3);
    const area = pieces.reduce((s, p) => s + Math.abs(signedArea(p)), 0);
    if (area <= EDGE_PART_MIN || depthOnMap(b.ring, chunks) < EDGE_DEPTH_MIN) return [];
    const biggest = pieces.reduce((a, p) => (Math.abs(signedArea(p)) > Math.abs(signedArea(a)) ? p : a));
    const at: Pt = centroid(biggest);
    const name = b.tags.name ?? (b.tags["addr:street"] ? `${b.tags["addr:street"]} ${b.tags["addr:housenumber"] ?? ""}`.trim() : b.tags.building);
    return [{ at: `${at.x.toFixed(0)},${at.z.toFixed(0)}`, what: `${b.id} (${name}): ${area.toFixed(1)} m² on the map, centroid off it` }];
  });

/**
 * The whole area (m²) by id of the map's buildings centred off every chunk: what the game draws of
 * one is its piece cut at the map's edge, the rest of it standing past the edge.
 */
export const offMapAreas = (buildings: readonly Area[], chunks: readonly Rect[]): ReadonlyMap<string, number> =>
  new Map(buildings.filter((b) => !chunks.some((r) => inRect(centroid(b.ring), r))).map((b) => [b.id, Math.abs(signedArea(b.ring))]));
