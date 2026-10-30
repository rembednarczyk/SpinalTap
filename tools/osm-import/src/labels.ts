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

export const chunkStreets = (lines: readonly Line[], rect: Rect): StreetOut[] => {
  const out: StreetOut[] = [];
  for (const l of lines) {
    const name = l.tags.name;
    const kind = l.tags.highway;
    if (!name || !kind || !STREET_KINDS.has(kind)) continue;
    // A one-way street is drawn the way it is driven (`oneway=-1` turned round).
    const one = oneway(l.tags);
    const line = l.tags.oneway === "-1" ? [...l.line].reverse() : l.line;
    for (const piece of clipLineToRect(line, rect)) {
      if (lineLength(piece) < 5) continue;
      const simple = simplifyLine(piece, 1).flatMap((p) => [r1(p.x), r1(p.z)]);
      out.push({ name, kind, line: simple, ...(one ? { oneway: true as const } : {}) });
    }
  }
  return out;
};

const FOOD = new Set(["cafe", "restaurant", "fast_food", "ice_cream", "food_court"]);
const BAR = new Set(["bar", "pub", "biergarten", "nightclub"]);
const CULTURE = new Set(["theatre", "cinema", "arts_centre", "library", "community_centre"]);
const SERVICE = new Set(["pharmacy", "bank", "post_office", "clinic", "doctors", "dentist", "police", "townhall", "hospital"]);

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

/** Named points of interest of the whole data set, stops merged by name within 40 m. */
export const allPois = (data: OsmData): (PoiOut & { readonly at: Pt })[] => {
  const out: (PoiOut & { at: Pt })[] = [];
  const nodes = [...data.nodes.values()].filter((n) => n.tags?.name).sort((a, b) => a.id - b.id);
  for (const n of nodes) {
    const k = poiKind(n.tags!);
    if (!k) continue;
    const at = geoToWorld(n.lat, n.lon);
    if (k.kind === "stop" && out.some((p) => p.kind === "stop" && p.name === n.tags!.name && Math.hypot(p.at.x - at.x, p.at.z - at.z) < 40)) continue;
    out.push({ x: r1(at.x), z: r1(at.z), kind: k.kind, tag: k.tag, name: n.tags!.name!, at });
  }
  return out;
};

export const chunkPois = (pois: readonly (PoiOut & { readonly at: Pt })[], rect: Rect): PoiOut[] =>
  pois.filter((p) => inRect(p.at, rect)).map(({ x, z, kind, tag, name }) => ({ x, z, kind, tag, name }));
