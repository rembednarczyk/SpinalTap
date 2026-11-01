/**
 * Venues on the ground floors (ADR-0064 stage 4): the map's shops, cafés, bars, banks,
 * pharmacies and clubs as signs on the building they are in or at. The real name only picks the
 * 2077 name from `venue-names.ts` (ADR-0058); the colour comes from `brand:colour` or `colour`,
 * else from the table, else from the kind, always brought to the kit's neon palette (ADR-0022).
 */
import type { VenueKind } from "../../../packages/core/src/world/venues.ts";
import { type Area } from "./features.ts";
import { type Pt, centroid, pointInRing, r1, ringBounds, signedArea } from "./geometry.ts";
import { type OsmData, type Tags } from "./osm.ts";
import { geoToWorld } from "./project.ts";
import { KIND_COLOUR, venueEntry } from "./venue-names.ts";

const AMENITY: Readonly<Record<string, VenueKind>> = {
  restaurant: "restaurant",
  fast_food: "fast-food",
  food_court: "fast-food",
  cafe: "cafe",
  ice_cream: "ice-cream",
  bar: "bar",
  pub: "pub",
  biergarten: "pub",
  nightclub: "club",
  bank: "bank",
  bureau_de_change: "exchange",
  pharmacy: "pharmacy",
};

const SHOP: Readonly<Record<string, VenueKind>> = {
  convenience: "grocery",
  supermarket: "grocery",
  greengrocer: "grocery",
  deli: "grocery",
  butcher: "grocery",
  alcohol: "grocery",
  health_food: "grocery",
  variety_store: "grocery",
  bakery: "bakery",
  pastry: "bakery",
  confectionery: "bakery",
  books: "books",
  newsagent: "books",
  kiosk: "books",
  jewelry: "jewelry",
  gold_buyer: "jewelry",
  coins: "jewelry",
  pawnbroker: "jewelry",
  optician: "optician",
  hairdresser: "hairdresser",
  hairdresser_supply: "hairdresser",
  beauty: "beauty",
  cosmetics: "beauty",
  chemist: "beauty",
  massage: "beauty",
  clothes: "clothes",
  shoes: "clothes",
  bag: "clothes",
  second_hand: "clothes",
  art: "art",
  antiques: "art",
  craft: "art",
  mall: "mall",
};

/** What a mapped venue is, or null when the tags are no shop, café, bar, bank, pharmacy or club. */
export const venueKind = (t: Tags): VenueKind | null => {
  if (t.shop) return t.shop === "vacant" || t.shop === "no" ? null : (SHOP[t.shop] ?? "shop");
  return AMENITY[t.amenity ?? ""] ?? null;
};

/** The kit's neon swatches (ADR-0022, `tools/city_kit_palette.py`) and its cold white for the greys. */
export const KIT_NEON: readonly string[] = ["#ff2e88", "#00e5ff", "#ffb000", "#39ff8a", "#b46cff", "#ff4040", "#3f8cff", "#c9dcf2"];

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** Hue (0..1), saturation and value of a colour. */
const hsv = (hex: string): [number, number, number] => {
  const [r, g, b] = rgb(hex);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, max === 0 ? 0 : d / max, max];
};

const NAMED: Readonly<Record<string, string>> = {
  red: "#ff0000", green: "#00a000", blue: "#0050ff", yellow: "#ffd000", orange: "#ff8000", purple: "#8000c0", violet: "#8000c0", pink: "#ff60a0",
  magenta: "#ff00ff", cyan: "#00ffff", white: "#ffffff", black: "#000000", grey: "#808080", gray: "#808080", brown: "#8b4513", gold: "#d4af37", navy: "#000080",
};

/** An OSM colour (`#rgb`, `#rrggbb` or a CSS name) as `#rrggbb`, or null. */
export const parseColour = (v: string | undefined): string | null => {
  if (!v) return null;
  const s = v.trim().toLowerCase().split(/[;,]/)[0]!.trim();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return `#${[...s.slice(1)].map((c) => c + c).join("")}`;
  return NAMED[s] ?? null;
};

/**
 * The kit's neon nearest a colour: by hue, as a neon keeps its hue and lights it fully; a grey,
 * a black or a white is the cold white. Dark blues go to the blue, not the violet.
 */
export const toKitNeon = (hex: string): string => {
  const [h, s] = hsv(hex);
  if (s < 0.22) return "#c9dcf2";
  let best = KIT_NEON[0]!;
  let dist = Infinity;
  for (const n of KIT_NEON.slice(0, 7)) {
    const d = Math.min(Math.abs(hsv(n)[0] - h), 1 - Math.abs(hsv(n)[0] - h));
    if (d < dist) [best, dist] = [n, d];
  }
  return best;
};

/** Where a venue's colour came from, for the importer's counts. */
export type ColourSource = "osm" | "table" | "kind";

/** A venue of the whole data set, in world metres. */
export interface WorldVenue {
  /** `n<id>` a node, `w<id>` a way. */
  readonly id: string;
  readonly at: Pt;
  readonly kind: VenueKind;
  /** Lublin 2077's name for the sign; never the map's. */
  readonly name: string;
  /** From the table (the map's name is in it) or generic for its kind. */
  readonly named: boolean;
  readonly color: string;
  readonly colourFrom: ColourSource;
  /** A venue mapped as the building's own outline: its sign goes on that building. */
  readonly building?: string;
}

const venueOf = (id: string, at: Pt, t: Tags, building?: string): WorldVenue | null => {
  const kind = venueKind(t);
  if (!kind) return null;
  const entry = venueEntry(t.name, kind, id);
  const osm = parseColour(t["brand:colour"]) ?? parseColour(t.colour);
  const colourFrom: ColourSource = osm ? "osm" : entry.color ? "table" : "kind";
  const color = toKitNeon(osm ?? entry.color ?? KIND_COLOUR[kind]);
  return { id, at, kind, name: entry.name, named: entry.named, color, colourFrom, ...(building ? { building } : {}) };
};

/** The venues of the whole data set: mapped as nodes, or as areas (their middle), in id order. */
export const allVenues = (data: OsmData, areas: readonly Area[]): WorldVenue[] => {
  const out: WorldVenue[] = [];
  for (const n of [...data.nodes.values()].sort((a, b) => a.id - b.id)) {
    const v = n.tags ? venueOf(`n${n.id}`, geoToWorld(n.lat, n.lon), n.tags) : null;
    if (v) out.push(v);
  }
  for (const a of areas) {
    const v = venueOf(a.id, centroid(a.ring), a.tags, a.tags.building !== undefined ? a.id : undefined);
    if (v) out.push(v);
  }
  return out;
};

/** A venue this far off a building's wall and nearer stands at it (a café on the pavement, a point drawn off the facade). */
export const VENUE_REACH = 8;

const edgeDistance = (p: Pt, ring: readonly Pt[]): number => {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(a.x + dx * k - p.x, a.z + dz * k - p.z));
  }
  return best;
};

/** A building outline in world metres, by its id. */
export interface VenueHost {
  readonly id: string;
  readonly ring: readonly Pt[];
}

/**
 * The building each venue goes on: its own outline when it is mapped as one, else the smallest
 * outline around its point, else the one with a wall nearest it within `VENUE_REACH`; venues
 * with none are left out. Ties go to the lower id, so the result never depends on the order.
 */
export const assignVenues = (venues: readonly WorldVenue[], hosts: readonly VenueHost[]): Map<string, WorldVenue[]> => {
  const boxes = hosts.map((h) => ({ h, box: ringBounds(h.ring), area: Math.abs(signedArea(h.ring)) }));
  const ids = new Set(hosts.map((h) => h.id));
  const out = new Map<string, WorldVenue[]>();
  // One sign per name on a building: a restaurant and its beer garden mapped apart are one venue.
  const put = (id: string, v: WorldVenue) => {
    const list = out.get(id) ?? [];
    if (!list.some((o) => o.name === v.name)) out.set(id, [...list, v]);
  };
  for (const v of venues) {
    if (v.building && ids.has(v.building)) {
      put(v.building, v);
      continue;
    }
    const p = v.at;
    const near = boxes.filter(({ box }) => p.x >= box.minX - VENUE_REACH && p.x <= box.maxX + VENUE_REACH && p.z >= box.minZ - VENUE_REACH && p.z <= box.maxZ + VENUE_REACH);
    const inside = near.filter(({ h }) => pointInRing(p, h.ring)).sort((a, b) => a.area - b.area || a.h.id.localeCompare(b.h.id))[0];
    if (inside) {
      put(inside.h.id, v);
      continue;
    }
    const at = near
      .map(({ h }) => ({ h, d: edgeDistance(p, h.ring) }))
      .filter((c) => c.d <= VENUE_REACH)
      .sort((a, b) => a.d - b.d || a.h.id.localeCompare(b.h.id))[0];
    if (at) put(at.h.id, v);
  }
  return out;
};

/** A venue as a building's chunk record: its point relative to the building's centre. */
export interface VenueOut {
  readonly x: number;
  readonly z: number;
  readonly kind: VenueKind;
  readonly name: string;
  readonly color: string;
}

export const venueOut = (v: WorldVenue, center: Pt): VenueOut => ({ x: r1(v.at.x - center.x), z: r1(v.at.z - center.z), kind: v.kind, name: v.name, color: v.color });
