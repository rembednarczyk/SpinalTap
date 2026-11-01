/** Street names for the minimap and texts, and named points of interest for placing content later. */
import { type Line } from "./features.ts";
import { type Pt, type Rect, clipLineToRect, inRect, lineLength, r1, simplifyLine } from "./geometry.ts";
import { oneway } from "./markings.ts";
import { type PoiKind, type PoiOut, type StreetOut } from "./model.ts";
import { type OsmData, type Tags } from "./osm.ts";
import { geoToWorld } from "./project.ts";

const STREET_KINDS = new Set([
  "primary",
  "secondary",
  "tertiary",
  "unclassified",
  "residential",
  "living_street",
  "pedestrian",
  "service",
  "footway",
  "steps",
  "path",
]);

/**
 * Misspelt street names in OSM, corrected here because a street's pieces join into one road by
 * name: way 739432828 is "Aleje Tysiąclecia", a 36 m gap in Aleja Tysiąclecia's lane (G-020).
 */
const NAME_FIXES: Readonly<Record<string, string>> = {
  "Aleje Tysiąclecia": "Aleja Tysiąclecia",
};

/**
 * Shorter pieces are noise, unless the chunk's edge cut them off a longer way: dropped there,
 * they leave a hole in the street at the seam (G-021). Under half a metre the roads join over
 * the gap anyway (`JOIN` in the sim's `roads.ts`).
 */
const MIN_PIECE = 5;
const MIN_SEAM_PIECE = 0.5;

const onEdge = (p: Pt, r: Rect): boolean => Math.min(Math.abs(p.x - r.minX), Math.abs(p.x - r.maxX), Math.abs(p.z - r.minZ), Math.abs(p.z - r.maxZ)) < 1e-6;
const keepPiece = (piece: readonly Pt[], rect: Rect): boolean => {
  const len = lineLength(piece);
  return len >= MIN_PIECE || (len >= MIN_SEAM_PIECE && (onEdge(piece[0]!, rect) || onEdge(piece[piece.length - 1]!, rect)));
};

/**
 * A gate under a building barred to motor vehicles (Ku Farze, G-002). Only passages: most pedestrian
 * streets carry `motor_vehicle=no` too, yet the game's vans serve them in the morning (ADR-0050).
 */
const closedToVehicles = (t: Tags): boolean =>
  (t.tunnel === "building_passage" || t.tunnel === "yes" || t.covered === "yes") && [t.motor_vehicle, t.motorcar, t.vehicle].some((v) => v === "no");

export const chunkStreets = (lines: readonly Line[], rect: Rect): StreetOut[] => {
  const out: StreetOut[] = [];
  for (const l of lines) {
    const name = l.tags.name && (NAME_FIXES[l.tags.name] ?? l.tags.name);
    const kind = l.tags.highway;
    if (!name || !kind || !STREET_KINDS.has(kind)) continue;
    // A one-way street is drawn the way it is driven (`oneway=-1` turned round).
    const one = oneway(l.tags);
    const closed = closedToVehicles(l.tags);
    const line = l.tags.oneway === "-1" ? [...l.line].reverse() : l.line;
    for (const piece of clipLineToRect(line, rect)) {
      if (!keepPiece(piece, rect)) continue;
      const simple = simplifyLine(piece, 1).flatMap((p) => [r1(p.x), r1(p.z)]);
      out.push({ name, kind, line: simple, ...(one ? { oneway: true as const } : {}), ...(closed ? { noVehicles: true as const } : {}) });
    }
  }
  return out;
};

const FOOD = new Set(["cafe", "restaurant", "fast_food", "ice_cream", "food_court"]);
const BAR = new Set(["bar", "pub", "biergarten", "nightclub"]);
const CULTURE = new Set(["theatre", "cinema", "arts_centre", "library", "community_centre"]);
const SERVICE = new Set(["pharmacy", "bank", "post_office", "clinic", "doctors", "dentist", "police", "townhall", "courthouse", "hospital"]);

/** What a named point is for the game, or null when it is street furniture or noise. */
export const poiKind = (t: Tags): { kind: PoiKind; tag: string } | null => {
  const a = t.amenity ?? "";
  if (t.shop) return { kind: "shop", tag: `shop=${t.shop}` };
  if (FOOD.has(a)) return { kind: "food", tag: `amenity=${a}` };
  if (BAR.has(a)) return { kind: "bar", tag: `amenity=${a}` };
  if (t.highway === "bus_stop" || t.public_transport === "platform" || t.public_transport === "stop_position") return { kind: "stop", tag: "public_transport=platform" };
  if (["hotel", "hostel", "guest_house", "apartment"].includes(t.tourism ?? "")) return { kind: "hotel", tag: `tourism=${t.tourism}` };
  if (a === "place_of_worship") return { kind: "church", tag: "amenity=place_of_worship" };
  if (CULTURE.has(a)) return { kind: "culture", tag: `amenity=${a}` };
  if (SERVICE.has(a)) return { kind: "service", tag: `amenity=${a}` };
  if (t.tourism === "museum" || t.tourism === "attraction" || t.tourism === "artwork" || t.tourism === "viewpoint" || t.historic) {
    return { kind: "sight", tag: t.tourism ? `tourism=${t.tourism}` : `historic=${t.historic}` };
  }
  if (t.office) return { kind: "office", tag: `office=${t.office}` };
  if (t.craft) return { kind: "shop", tag: `craft=${t.craft}` };
  return null;
};

/**
 * A street address `street number` from OSM tags, or undefined without one; lower case, with
 * `9/11` and `9-11` alike (OSM spells one number both ways).
 */
export const addressOf = (t: Tags): string | undefined =>
  t["addr:street"] && t["addr:housenumber"] ? `${t["addr:street"]} ${t["addr:housenumber"].replace(/\s+/g, "").replace("/", "-")}`.toLowerCase() : undefined;

/** A point of interest of the whole data set: where it lies and its street address, if it has one. */
export type WorldPoi = PoiOut & { readonly at: Pt; readonly addr?: string };

/** Named points of interest of the whole data set, stops merged by name within 40 m. */
export const allPois = (data: OsmData): WorldPoi[] => {
  const out: WorldPoi[] = [];
  const nodes = [...data.nodes.values()].filter((n) => n.tags?.name).sort((a, b) => a.id - b.id);
  for (const n of nodes) {
    const k = poiKind(n.tags!);
    if (!k) continue;
    const at = geoToWorld(n.lat, n.lon);
    if (k.kind === "stop" && out.some((p) => p.kind === "stop" && p.name === n.tags!.name && Math.hypot(p.at.x - at.x, p.at.z - at.z) < 40)) continue;
    const addr = addressOf(n.tags!);
    out.push({ x: r1(at.x), z: r1(at.z), kind: k.kind, tag: k.tag, name: n.tags!.name!, at, ...(addr ? { addr } : {}) });
  }
  return out;
};

export const chunkPois = (pois: readonly WorldPoi[], rect: Rect): PoiOut[] =>
  pois.filter((p) => inRect(p.at, rect)).map(({ x, z, kind, tag, name }) => ({ x, z, kind, tag, name }));
