/**
 * What the market's furniture (ADR-0058 stage 3, `props-food.ts`) keeps clear of beyond the chunks'
 * ground: the carriageways of the car roads as the map data has them (axis and width from the
 * tags, `roadWidth`), and the game's own doors (the clinic, Neon Koi), which the map does not know.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DISTRICTS } from "./config.ts";
import { extractFeatures } from "./features.ts";
import type { Pt } from "./geometry.ts";
import { roadWidth } from "./ground.ts";
import { type OsmData, mergeOsm, parseExtract } from "./osm.ts";
import { REPO } from "./paths.ts";

/** A carriageway: its axis and half its width (m). */
export interface Carriageway {
  readonly line: readonly Pt[];
  readonly half: number;
}

/** A door of the game's own: the two jambs of its opening at floor height. */
export interface DoorSpan {
  readonly a: Pt;
  readonly b: Pt;
}

/** The ways cars drive, as the glitch scan counts them (`market-pieces.ts`), service roads too. */
const CAR_ROADS: ReadonlySet<string> = new Set([
  "primary",
  "secondary",
  "tertiary",
  "residential",
  "unclassified",
  "living_street",
  "trunk",
  "primary_link",
  "secondary_link",
  "tertiary_link",
  "service",
]);

/** The carriageways of the car roads on the ground (not in a tunnel, on a bridge or a car park's aisle). */
export const carriageways = (osm: OsmData): Carriageway[] =>
  extractFeatures(osm)
    .lines.filter((l) => {
      const t = l.tags;
      return CAR_ROADS.has(t.highway ?? "") && Number(t.layer ?? 0) >= 0 && t.tunnel === undefined && t.bridge === undefined && t.area !== "yes" && t.service !== "parking_aisle";
    })
    .map((l) => ({ line: l.line, half: roadWidth(l.tags) / 2 }));

/** The carriageways of the districts' extracts in `data/osm`. */
export const loadCarriageways = (root = REPO): Carriageway[] =>
  carriageways(mergeOsm(DISTRICTS.map((d) => parseExtract(readFileSync(join(root, "data/osm", `${d.slug}.json`), "utf8")))));

/**
 * The axes of the map's ways under ground: in a tunnel (not a gateway's `building_passage`, at street
 * level) or on a negative layer. The chunks keep them as streets with neither tag (Trasa Podziemna
 * is a footway there), so the staircases' doors look them up here (G-197).
 */
export const undergroundWays = (osm: OsmData): (readonly Pt[])[] =>
  extractFeatures(osm)
    .lines.filter((l) => {
      const t = l.tags;
      return t.highway !== undefined && (Number(t.layer ?? 0) < 0 || (t.tunnel !== undefined && t.tunnel !== "no" && t.tunnel !== "building_passage"));
    })
    .map((l) => l.line);

/** The ways under ground of the districts' extracts in `data/osm`. */
export const loadUndergroundWays = (root = REPO): (readonly Pt[])[] =>
  undergroundWays(mergeOsm(DISTRICTS.map((d) => parseExtract(readFileSync(join(root, "data/osm", `${d.slug}.json`), "utf8")))));

/** A door of the game's content (sim `DoorDef`: the middle of its opening, the wall's axis, its width) as its jambs. */
export const doorSpan = (d: { readonly at: { readonly x: number; readonly z: number }; readonly along: "x" | "z"; readonly width: number }): DoorSpan => {
  const h = d.width / 2;
  return d.along === "x" ? { a: { x: d.at.x - h, z: d.at.z }, b: { x: d.at.x + h, z: d.at.z } } : { a: { x: d.at.x, z: d.at.z - h }, b: { x: d.at.x, z: d.at.z + h } };
};
