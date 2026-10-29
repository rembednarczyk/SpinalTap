/**
 * Ground surfaces (ADR-0042): areas from the map (squares, lawns, water, road areas) and bands
 * built from lines (carriageways by type, lanes and width; sidewalks from tags, from mapped
 * sidewalk ways, or added along city streets that have neither; footpaths; rails).
 */
import { type GroundSurface } from "../../../packages/core/src/world/city-geo.ts";
import { parseLength } from "./building-tags.ts";
import { type Area, type Line } from "./features.ts";
import { type Pt, type Rect, bufferLine, ccw, clipRingToRect, pointInRing, r1, removeCollinear, signedArea, simplifyRing, stripAlong } from "./geometry.ts";
import { type GroundOut } from "./model.ts";
import { type Tags } from "./osm.ts";

const COBBLES = new Set(["sett", "cobblestone", "unhewn_cobblestone", "cobblestone:flattened"]);
const cobbled = (t: Tags) => COBBLES.has(t.surface ?? "");

/** Surface of a mapped area, or null when it is not ground. */
export const areaSurface = (t: Tags): GroundSurface | null => {
  if (t.building !== undefined) return null;
  if (t.natural === "water" || t.waterway === "riverbank" || t.landuse === "reservoir" || t.landuse === "basin") return "water";
  if (t.place === "square" || t.highway === "pedestrian" || t["area:highway"] === "pedestrian" || t.amenity === "marketplace") return cobbled(t) ? "cobble" : "square";
  if (t["area:highway"] === "footway" || t.highway === "footway") return cobbled(t) ? "cobble" : "footway";
  if (t["area:highway"] !== undefined || (t.amenity === "parking" && t.parking !== "underground" && t.parking !== "multi-storey")) return cobbled(t) ? "cobble" : "road";
  if (["park", "garden", "playground", "dog_park", "pitch"].includes(t.leisure ?? "")) return "grass";
  if (["grass", "village_green", "meadow", "recreation_ground", "cemetery", "allotments", "orchard", "flowerbed"].includes(t.landuse ?? "")) return "grass";
  if (["grass", "scrub", "wood", "grassland", "heath", "wetland"].includes(t.natural ?? "")) return "grass";
  return null;
};

/** Carriageway width in metres by type when neither `width` nor `lanes` says. */
const ROAD_WIDTH: Record<string, number> = {
  motorway: 14,
  trunk: 14,
  primary: 12,
  primary_link: 6,
  secondary: 10,
  secondary_link: 6,
  tertiary: 8,
  tertiary_link: 5,
  unclassified: 6,
  residential: 6.5,
  living_street: 5,
  service: 4,
  busway: 7,
  road: 6,
};
/** Streets that get sidewalks where the map has none. */
const URBAN = new Set(["primary", "secondary", "tertiary", "unclassified", "residential", "living_street"]);
const PATHS: Record<string, number> = { footway: 2.5, path: 2, cycleway: 2, steps: 3, bridleway: 2 };

const underground = (t: Tags) => t.tunnel === "yes" || t.tunnel === "culvert" || t.indoor === "yes" || Number(t.layer ?? 0) < 0 || t.location === "underground";

export const roadWidth = (t: Tags): number => {
  const w = parseLength(t.width ?? t["width:carriageway"]);
  if (w !== null) return w;
  const lanes = Number(t.lanes);
  if (Number.isFinite(lanes) && lanes > 0) return lanes * 3.25;
  if (t.highway === "service" && t.service === "parking_aisle") return 5;
  return ROAD_WIDTH[t.highway ?? ""] ?? 6;
};

export interface Band {
  readonly surface: GroundSurface;
  readonly ring: readonly Pt[];
  readonly bridge: boolean;
  readonly source: string;
}

/** Sidewalk sides a road gets: tagged ones, or both on city streets without tags and without mapped sidewalks nearby. */
export const sidewalkSides = (t: Tags, mappedNearby: boolean): { left: boolean; right: boolean } => {
  const s = t.sidewalk ?? (t["sidewalk:both"] === "yes" ? "both" : undefined);
  const left = t["sidewalk:left"];
  const right = t["sidewalk:right"];
  if (s === "both" || s === "yes") return { left: true, right: true };
  if (s === "left" || s === "right") return { left: s === "left", right: s === "right" };
  if (s === "no" || s === "none" || s === "separate" || left !== undefined || right !== undefined)
    return { left: left === "yes", right: right === "yes" };
  if (mappedNearby || !URBAN.has(t.highway ?? "")) return { left: false, right: false };
  return { left: true, right: true };
};

/** Whether most points of `line` lie in one of the mapped water areas (a river already drawn as a polygon). */
export const coveredByWater = (line: readonly Pt[], water: readonly (readonly Pt[])[]): boolean => {
  if (water.length === 0 || line.length === 0) return false;
  const inside = line.filter((p) => water.some((ring) => pointInRing(p, ring))).length;
  return inside / line.length >= 0.6;
};

/**
 * Bands from one line; `mappedSidewalkNear` tells whether separate sidewalks run along it.
 * A river whose bed is mapped as a water area gets no band of its own: the buffered centre
 * line would lay a second, wider strip over the real banks.
 */
export const lineBands = (l: Line, mappedSidewalkNear: boolean, water: readonly (readonly Pt[])[] = []): Band[] => {
  const t = l.tags;
  if (underground(t) || l.line.length < 2) return [];
  const bridge = t.bridge !== undefined && t.bridge !== "no";
  const out: Band[] = [];
  const add = (surface: GroundSurface, ring: Pt[]) => {
    if (ring.length >= 3) out.push({ surface, ring, bridge, source: l.id });
  };
  const hw = t.highway;
  if (hw && t.area !== "yes") {
    if (ROAD_WIDTH[hw] !== undefined) {
      const w = roadWidth(t);
      add(cobbled(t) ? "cobble" : "road", bufferLine(l.line, w));
      const sides = sidewalkSides(t, mappedSidewalkNear);
      const sw = parseLength(t["sidewalk:width"]) ?? (hw === "primary" || hw === "secondary" ? 3 : 2.5);
      if (sides.left) add("sidewalk", stripAlong(l.line, w / 2, sw));
      if (sides.right) add("sidewalk", stripAlong(l.line, -w / 2 - sw, sw));
    } else if (hw === "pedestrian") add(cobbled(t) ? "cobble" : "square", bufferLine(l.line, parseLength(t.width) ?? 8));
    else if (PATHS[hw] !== undefined) {
      const w = parseLength(t.width) ?? PATHS[hw]!;
      add(t.footway === "sidewalk" ? "sidewalk" : cobbled(t) ? "cobble" : "footway", bufferLine(l.line, w));
    }
  }
  if (t.railway === "rail" || t.railway === "tram" || t.railway === "light_rail") add("rail", bufferLine(l.line, 3));
  if (t.waterway === "river" && !t.tunnel && !coveredByWater(l.line, water)) add("water", bufferLine(l.line, parseLength(t.width) ?? 15));
  if ((t.waterway === "stream" || t.waterway === "canal" || t.waterway === "ditch") && !underground(t)) add("water", bufferLine(l.line, parseLength(t.width) ?? 3));
  return out;
};

export const areaBand = (a: Area): Band | null => {
  const s = areaSurface(a.tags);
  if (!s || underground(a.tags)) return null;
  return { surface: s, ring: a.ring, bridge: false, source: a.id };
};

/** Draw order: big areas first, then roads, cobbles, sidewalks, paths and rails on top. */
const ORDER: Record<GroundSurface, number> = { water: 0, grass: 1, square: 2, road: 3, cobble: 4, sidewalk: 5, footway: 6, rail: 7 };

/** Clips bands to a chunk, simplifies and rounds them, in draw order then by source id. */
export const chunkGround = (bands: readonly Band[], rect: Rect): GroundOut[] => {
  const out: { g: GroundOut; order: number; source: string; k: number }[] = [];
  bands.forEach((b, k) => {
    const clipped = clipRingToRect(ccw(b.ring), rect);
    if (clipped.length < 3) return;
    const simple = removeCollinear(
      simplifyRing(clipped, 0.3).map((p) => ({ x: r1(p.x), z: r1(p.z) })),
      0.02,
    );
    if (simple.length < 3 || Math.abs(signedArea(simple)) < 0.5) return;
    const ring = ccw(simple);
    out.push({ g: { surface: b.surface, outline: ring.flatMap((p) => [p.x, p.z]), ...(b.bridge ? { bridge: true as const } : {}) }, order: ORDER[b.surface], source: b.source, k });
  });
  out.sort((a, b) => a.order - b.order || (a.source < b.source ? -1 : a.source > b.source ? 1 : a.k - b.k));
  return out.map((o) => o.g);
};
