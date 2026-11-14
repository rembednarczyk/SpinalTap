/**
 * The street furniture and trees of OpenStreetMap as points (ADR-0077 point 4: OSM first): `pnpm
 * osm:fetch` keeps them from the raw tiles in `data/osm/points/furniture.json`, since the district
 * extracts drop unnamed nodes (`filterOsm`). `pnpm osm:props` then places every one the plan does not
 * hold by its node id (`props-osm.ts`), so the furniture follows the current extracts, not the plan of
 * 29.10 alone (G-099, T-061), and the glitch scan's `osm-furniture-missing` counts what is still lost.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { OsmNode, Tags } from "./osm.ts";
import { geoToWorld } from "./project.ts";
import type { Pt } from "./geometry.ts";
import { REPO } from "./paths.ts";

/** The tags kept, `key=value`: the furniture, the trees, the lamps and hydrants (the last two placed by rules of their own). */
export const FURNITURE_TAGS: readonly string[] = [
  "natural=tree",
  "amenity=bench",
  "amenity=waste_basket",
  "amenity=bicycle_parking",
  "amenity=vending_machine",
  "amenity=parcel_locker",
  "barrier=bollard",
  "advertising=column",
  "highway=street_lamp",
  "emergency=fire_hydrant",
];

/** The kept tag of a node's tags, `key=value`, or null. */
export const furnitureTag = (tags: Tags | undefined): string | null => {
  if (!tags) return null;
  for (const t of FURNITURE_TAGS) {
    const [k, v] = t.split("=") as [string, string];
    if (tags[k] === v) return t;
  }
  return null;
};

/** The plan's kind of an OSM point, by its tag and detail; null: placed by another rule. */
export const planKindOf = (f: { readonly tag: string; readonly detail: string }): string | null => {
  switch (f.tag) {
    case "natural=tree":
      return "tree";
    case "amenity=bench":
      return "bench";
    case "amenity=waste_basket":
      return "waste-bin";
    case "amenity=bicycle_parking":
      return "bike-rack";
    case "amenity=vending_machine":
      return f.detail === "parking_tickets" || f.detail === "public_transport_tickets" ? "ticket-machine" : "vending-machine";
    case "amenity=parcel_locker":
      return "parcel-locker";
    case "barrier=bollard":
      return "bollard";
    case "advertising=column":
      return "advertising-column";
    default:
      return null;
  }
};

/** The detail a kind reads beside its tag: what a vending machine sells, a hydrant's type ("" when none). */
const detailOf = (tag: string, tags: Tags): string =>
  tag === "amenity=vending_machine" ? (tags.vending ?? "") : tag === "emergency=fire_hydrant" ? (tags["fire_hydrant:type"] ?? "") : "";

/** One point: OSM node id, position, the kept tag and its detail. */
export type FurnitureRow = [id: number, lat: number, lon: number, tag: string, detail: string];

/** The rows of the nodes with a kept tag, by node id (the tiles overlap, a node once). */
export const furnitureRows = (nodes: Iterable<OsmNode>): FurnitureRow[] => {
  const rows = new Map<number, FurnitureRow>();
  for (const n of nodes) {
    const tag = furnitureTag(n.tags);
    if (tag) rows.set(n.id, [n.id, n.lat, n.lon, tag, detailOf(tag, n.tags!)]);
  }
  return [...rows.values()].sort((a, b) => a[0] - b[0]);
};

/** The file's text: a header and a row a line, sorted by node id, so a refetch diffs line by line. */
export const serializeFurniture = (rows: readonly FurnitureRow[], header: Record<string, unknown>): string =>
  `{"header":${JSON.stringify({ ...header, filter: FURNITURE_TAGS.join("|"), row: ["id", "lat", "lon", "tag", "detail"] })},\n"points":[\n${rows.map((r) => JSON.stringify(r)).join(",\n")}\n]}\n`;

export const FURNITURE_FILE = "data/osm/points/furniture.json";

/** A point of the file in the world. */
export interface FurniturePoint {
  readonly id: string;
  readonly p: Pt;
  readonly tag: string;
  readonly detail: string;
}

/** The file's points as world points (none when it is missing). */
export const loadFurniture = (root = REPO): FurniturePoint[] => {
  const file = join(root, FURNITURE_FILE);
  if (!existsSync(file)) return [];
  const rows = (JSON.parse(readFileSync(file, "utf8")) as { points: FurnitureRow[] }).points;
  return rows.map(([id, lat, lon, tag, detail]) => ({ id: `n${id}`, p: geoToWorld(lat, lon), tag, detail }));
};
