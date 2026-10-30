import { type StaticProp } from "./builders";
import { CAR_WASH_PROPS } from "./district-car-wash";
import { DOKI_QUAY_PROPS, DOKI_YARD_PROPS } from "./district-doki";
import { TARG_NORTH_PROPS, TARG_SOUTH_PROPS } from "./district-targ";
import { type GroundRect, rectOverlap } from "./lublin/shape";
import { CLEARED_BUILDINGS } from "./lublin/sites";
import { groundY } from "./lublin/terrain";
import type { LublinBuildingData } from "./lublin/types";

/**
 * Which of the map's buildings give way to the set pieces that clear them (ADR-0045, G-008):
 * the market, the docks and the car wash. Only their own props count here; the rest of the
 * game's content finds its places by the buildings that stay (`lublin/places.ts`).
 */

/** Share of a building's outline over the set pieces past which the building goes. */
const OVER_SET_PIECE = 0.25;

const ANYWHERE: GroundRect = { minX: -Infinity, maxX: Infinity, minZ: -Infinity, maxZ: Infinity };

/** The footprints of the set pieces' solid blocks standing on the ground (their walls, stalls, crates; not awnings or decks). */
const SET_PIECE_BLOCKS: readonly GroundRect[] = [...TARG_SOUTH_PROPS, ...TARG_NORTH_PROPS, ...DOKI_YARD_PROPS, ...DOKI_QUAY_PROPS, ...CAR_WASH_PROPS].flatMap((p: StaticProp) => {
  if (p.view.kind !== "block" || !p.solid) return [];
  const { x, y, z } = p.view.size;
  if (p.center.y - y / 2 - groundY(p.center.x, p.center.z) > 0.5) return [];
  return [{ minX: p.center.x - x / 2, maxX: p.center.x + x / 2, minZ: p.center.z - z / 2, maxZ: p.center.z + z / 2 }];
});

/**
 * Is a building of the map taken away for a set piece? When its outline reaches into one of the
 * set piece's blocks (it would stand through a wall), or a quarter of it stands over the set
 * piece. A building only overlapping the edge of a square stays: its centre alone decided
 * before, and a building centred just outside stood through the walls (G-008).
 */
export const clearedBuilding = (b: LublinBuildingData): boolean => {
  if (SET_PIECE_BLOCKS.some((r) => rectOverlap(r, b.outline, b.x, b.z) > 0.01)) return true;
  const over = CLEARED_BUILDINGS.reduce((s, r) => s + rectOverlap(r, b.outline, b.x, b.z), 0);
  return over > OVER_SET_PIECE * rectOverlap(ANYWHERE, b.outline, b.x, b.z);
};
