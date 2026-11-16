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
}

/**
 * The coarsest terrain cell under a dig (m): the game lays the digs on a grid refined to it
 * (`siteGrid` of the simulation's terrain, its `FLIGHT_CELL`), whatever the import's cell there.
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

/** The coarsest terrain cell under a ring's corners (m): a site on two chunks' edge reads the coarser grid's. */
export const ringCell = (ring: readonly Pt[], g: Pick<SiteGround, "cellAt">): number => Math.max(...ring.map((p) => g.cellAt(p)));
