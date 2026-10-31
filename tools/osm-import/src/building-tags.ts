/**
 * Building tags to game numbers (ADR-0042): use, height, floors and roof. Storeys are 3.2 m, a
 * ground floor with shops 4 m. Without tags a building gets its district's default floors.
 */
import type { RoofShape } from "../../../packages/core/src/ports/types.ts";
import { type BuildingUse } from "../../../packages/core/src/world/city-geo.ts";
import { type Tags } from "./osm.ts";

export const STOREY = 3.2;
export const SHOP_STOREY = 4;

/** Parses an OSM length (`12`, `12 m`, `12,5`, `12.5m`); feet and garbage give null. */
export const parseLength = (v: string | undefined): number | null => {
  if (v === undefined) return null;
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(m|metre|meter)?\s*$/.exec(v);
  if (!m) return null;
  const n = Number(m[1]!.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Parses `building:levels` (`3`, `3.5`, `3;4` takes the largest). */
export const parseLevels = (v: string | undefined): number | null => {
  if (v === undefined) return null;
  const parts = v
    .split(/[;,-]/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return parts.length > 0 ? Math.max(...parts) : null;
};

const CHURCH = new Set(["church", "cathedral", "chapel", "basilica", "religious", "monastery", "convent"]);
const HISTORIC = new Set(["castle", "city_gate", "tower", "monument", "fort", "citywalls", "city_walls"]);
const CIVIC = new Set([
  "government",
  "public",
  "townhall",
  "civic",
  "university",
  "college",
  "school",
  "hospital",
  "train_station",
  "transportation",
  "courthouse",
  "museum",
  "theatre",
  "kindergarten",
  "library",
  "fire_station",
]);
const CIVIC_AMENITY = new Set(["townhall", "courthouse", "school", "university", "college", "hospital", "theatre", "library", "police", "post_office", "bus_station", "arts_centre"]);
const COMMERCIAL = new Set(["commercial", "retail", "office", "hotel", "kiosk", "supermarket", "shop", "mall", "bank"]);
const INDUSTRIAL = new Set(["industrial", "warehouse", "manufacture", "service", "transformer_tower", "storage_tank", "greenhouse"]);
const GARAGE = new Set(["garage", "garages", "carport", "shed", "parking", "roof", "shelter"]);
const RESIDENTIAL = new Set(["apartments", "residential", "house", "detached", "terrace", "dormitory", "semidetached_house"]);

export const buildingUse = (tags: Tags): BuildingUse => {
  const b = tags.building ?? "yes";
  if (CHURCH.has(b) || tags.amenity === "place_of_worship") return "church";
  if (HISTORIC.has(b) || HISTORIC.has(tags.historic ?? "") || tags["tower:type"] !== undefined) return "historic";
  if (CIVIC.has(b) || CIVIC_AMENITY.has(tags.amenity ?? "")) return "civic";
  if (COMMERCIAL.has(b) || tags.shop !== undefined || tags.tourism === "hotel") return "commercial";
  if (INDUSTRIAL.has(b)) return "industrial";
  // A shelter is often only `building=yes`; as a plain building it would become a block of flats.
  if (GARAGE.has(b) || tags.amenity === "shelter") return "garage";
  if (RESIDENTIAL.has(b)) return "residential";
  if (tags.historic !== undefined) return "historic";
  return b === "yes" ? "residential" : "other";
};

const PITCHED = new Set(["gabled", "hipped", "half-hipped", "gambrel", "mansard", "saltbox", "side_hipped", "skillion", "lean_to"]);
const DOMED = new Set(["dome", "onion", "pyramidal", "cone", "round"]);

/** Roof height in metres on top of the walls, or 0 for flat. `size` is the square root of the footprint area. */
export const roofHeight = (tags: Tags, use: BuildingUse, size: number): number => {
  const tagged = parseLength(tags["roof:height"]);
  if (tagged !== null) return tagged;
  const levels = parseLevels(tags["roof:levels"]);
  const shape = tags["roof:shape"];
  if (shape === "flat") return 0;
  if (shape === "skillion" || shape === "lean_to") return Math.min(Math.max(size * 0.12, 1), 3);
  if (shape !== undefined && DOMED.has(shape)) return Math.min(Math.max(size * 0.4, 3), 14);
  if (shape !== undefined && PITCHED.has(shape)) return levels ? levels * STOREY : Math.min(Math.max(size * 0.3, 2.5), 7);
  if (levels) return levels * STOREY;
  if (use === "church") return Math.min(Math.max(size * 0.35, 4), 12);
  return 0;
};

/** OSM `roof:shape` values to the game's shapes (ADR-0064); kindred values map to the nearest one. */
const SHAPES: Readonly<Record<string, RoofShape>> = {
  gabled: "gabled",
  side_hipped: "gabled",
  saltbox: "gabled",
  "half-hipped": "half-hipped",
  mansard: "mansard",
  gambrel: "mansard",
  hipped: "hipped",
  pyramidal: "pyramidal",
  cone: "pyramidal",
  skillion: "skillion",
  lean_to: "skillion",
  dome: "dome",
  onion: "onion",
  flat: "flat",
};

/** The roof's shape and ridge from `roof:shape` and `roof:orientation`; nothing for an untagged or unknown shape. */
export const roofShapeOf = (tags: Tags): { readonly shape?: RoofShape; readonly across?: true } => {
  const shape = SHAPES[tags["roof:shape"] ?? ""];
  if (!shape) return {};
  return tags["roof:orientation"] === "across" ? { shape, across: true } : { shape };
};

export interface Massing {
  /** Walls from the ground to the eaves, metres. */
  readonly walls: number;
  readonly roof: number;
  readonly levels: number;
  readonly source: "height" | "levels" | "default";
  /** The roof's shape from the tags (ADR-0064); absent, the renderer's own choice. */
  readonly shape?: RoofShape;
  readonly across?: true;
}

/** Default floors when tags are silent: by use and size, otherwise the district's range picked by `look`. */
const defaultLevels = (tags: Tags, use: BuildingUse, area: number, range: readonly [number, number], look: number): number => {
  const b = tags.building ?? "yes";
  if (area < 25 || use === "garage" || b === "kiosk") return 1;
  if (use === "industrial") return 2;
  if (b === "house" || b === "detached") return 2;
  if (use === "commercial") return 3;
  if (use === "civic") return 4;
  return range[0] + (look % (range[1] - range[0] + 1));
};

export const massing = (tags: Tags, opts: { area: number; shops: boolean; range: readonly [number, number]; look: number }): Massing => ({ ...heights(tags, opts), ...roofShapeOf(tags) });

const heights = (tags: Tags, opts: { area: number; shops: boolean; range: readonly [number, number]; look: number }): Massing => {
  const use = buildingUse(tags);
  const size = Math.sqrt(opts.area);
  const roof = roofHeight(tags, use, size);
  const floors = (n: number) => (opts.shops && n >= 2 ? SHOP_STOREY + (n - 1) * STOREY : n * STOREY);
  const height = parseLength(tags.height ?? tags["building:height"]);
  const minHeight = parseLength(tags.min_height) ?? 0;
  const tagLevels = parseLevels(tags["building:levels"]);
  if (height !== null) {
    const r = Math.min(roof, height * 0.5);
    const walls = Math.max(height - minHeight - r, 2.5);
    return { walls, roof: r, levels: tagLevels ?? Math.max(1, Math.round(walls / STOREY)), source: "height" };
  }
  if (tagLevels !== null) {
    const levels = Math.max(1, Math.round(tagLevels));
    return { walls: floors(levels), roof, levels, source: "levels" };
  }
  if (use === "church") {
    const tower = tags["building"] === "bell_tower" || tags["tower:type"] !== undefined;
    return { walls: tower ? 30 : 16, roof, levels: tower ? 8 : 4, source: "default" };
  }
  if (tags.historic === "city_gate" || tags.building === "tower") return { walls: 4 * STOREY, roof, levels: 4, source: "default" };
  const levels = defaultLevels(tags, use, opts.area, opts.range, opts.look);
  return { walls: floors(levels), roof, levels, source: "default" };
};

/** Landmark names the renderer may label: anything named that is not a plain block of flats. */
export const landmarkName = (tags: Tags, use: BuildingUse): string | undefined => {
  const name = tags["name:pl"] ?? tags.name;
  if (!name) return undefined;
  if (use !== "residential" || tags.historic !== undefined || tags.tourism !== undefined) return name;
  return undefined;
};

/** FNV-1a of the OSM id: the facade's seed, stable across imports. */
export const lookOf = (id: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
};
