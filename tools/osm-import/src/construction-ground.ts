/**
 * What the building sites' generator (ADR-0087, `construction-site.ts`) asks of the ground round a
 * site: where a piece may stand, how high the map's terrain is and how far the streets are. The
 * import answers it from the generated chunks (`construction-table.ts`), the tests from a plan.
 */
import { segmentDistance } from "../../../packages/core/src/math/geometry2d.ts";
import { type Pt } from "./geometry.ts";

export interface SiteGround {
  /** Ground a site's piece may stand on: no carriageway, pavement, building, water or rails, and clear of the map's own walls and fences. */
  free(p: Pt): boolean;
  /** Ground a body may stand on outside a gate: no building, water or rails. */
  open(p: Pt): boolean;
  /** The map's terrain (the import's NMT), before the game's shaping. */
  heightAt(p: Pt): number;
  /** Side of the terrain grid's cells at p (m). */
  cellAt(p: Pt): number;
  /** Distance from p to the nearest street a vehicle takes (m); Infinity with none. */
  driveDistance(p: Pt): number;
  /** Distance from p to the nearest street of any kind (m); Infinity with none. */
  walkDistance(p: Pt): number;
  /** The buildings round the site (stage 2: the crane's height, the scaffold's wall). */
  readonly neighbours: readonly SiteNeighbour[];
}

/** A building by a site: its outline in the world and the world y of its top (its roof's included). */
export interface SiteNeighbour {
  readonly ring: readonly Pt[];
  readonly top: number;
  /** OSM tags it `historic` or `heritage` (G-894: the crane keeps out of its front). */
  readonly heritage?: boolean;
}

/**
 * The coarsest terrain cell a dig and its blend lie on (m), the simulation's `FLIGHT_CELL`: a dig
 * keeps off a chunk of a coarser grid, whose points would carry it a cell further, and whose
 * refining (`siteGrid` of the simulation's terrain) would move its seams with the next chunks.
 */
export const DIG_CELL = 2.5;

/** Street kinds no vehicle takes: a gate on them is a wicket. */
export const FOOT_KINDS: ReadonlySet<string> = new Set(["pedestrian", "footway", "path", "steps", "cycleway", "bridleway", "corridor", "elevator"]);

/** Distance from p to a polyline. */
export const lineDistance = (p: Pt, line: readonly Pt[]): number => {
  let d = Infinity;
  for (let i = 0; i + 1 < line.length; i++) d = Math.min(d, segmentDistance(p.x, p.z, line[i]!.x, line[i]!.z, line[i + 1]!.x, line[i + 1]!.z));
  return d;
};
