import type { StreetPropItem } from "@seki/core";
import { distanceToPiece, furnitureRadius } from "./lublin/furniture";
import { WORLD_STREET_PROPS } from "./street-props";

/**
 * The game's solid street furniture (ADR-0050) bucketed by 16 m, for the content tables that
 * keep clear of it (the crowd's routes and places). Each piece with its footprint circle.
 */

export interface FurniturePiece {
  readonly x: number;
  readonly z: number;
  /** Radius of the circle round the footprint. */
  readonly r: number;
  readonly item: StreetPropItem;
}

const CELL = 16;
const cells = new Map<string, FurniturePiece[]>();
for (const items of Object.values(WORLD_STREET_PROPS)) {
  for (const item of items) {
    const r = furnitureRadius(item);
    if (r <= 0) continue;
    const key = `${Math.floor(item.x / CELL)}:${Math.floor(item.z / CELL)}`;
    const list = cells.get(key);
    const piece = { x: item.x, z: item.z, r, item };
    if (list) list.push(piece);
    else cells.set(key, [piece]);
  }
}

/** The pieces in the cells round (x, z): every piece within 16 m, and some further. */
export const furnitureNear = (x: number, z: number): FurniturePiece[] => {
  const out: FurniturePiece[] = [];
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) out.push(...(cells.get(`${cx + dx}:${cz + dz}`) ?? []));
  return out;
};

/** Distance from (x, z) to the nearest solid footprint of the furniture (0 inside; Infinity with none within 16 m). */
export const furnitureClearance = (x: number, z: number): number => {
  let best = Infinity;
  for (const f of furnitureNear(x, z)) if (Math.hypot(f.x - x, f.z - z) - f.r < best) best = Math.min(best, distanceToPiece(f.item, x, z));
  return best;
};
