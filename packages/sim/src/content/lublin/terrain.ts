import { type TerrainGrid, type Vec3, terrainHeightAt } from "@seki/core";
import { shapeGrid } from "./shape";
import { bridgeDeckAt } from "./decks";
import { MAP_CHUNKS, PADS, RAMPS } from "./sites";

/**
 * The terrain of the game's Lublin (ADR-0045): the map's grids with the pads and ramps of
 * `sites.ts` applied, by chunk id. The simulation walks on these and the renderer draws them.
 */
export const SHAPED_TERRAIN: ReadonlyMap<string, TerrainGrid> = new Map(MAP_CHUNKS.map((c) => [c.id, shapeGrid(c.terrain, PADS, RAMPS)]));

const inside = (b: { minX: number; maxX: number; minZ: number; maxZ: number }, x: number, z: number): boolean => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;

/** Ground height of the game's terrain at (x, z): the first chunk holding the point, or a bridge's deck over it, as the simulation's ground does. */
export const groundY = (x: number, z: number): number => {
  for (const c of MAP_CHUNKS) {
    if (!inside(c.bounds, x, z)) continue;
    const g = SHAPED_TERRAIN.get(c.id);
    if (!g) return 0;
    const h = terrainHeightAt(g, x, z);
    const deck = bridgeDeckAt(x, z);
    return deck !== null && deck > h ? deck : h;
  }
  return 0;
};

/** A point on the ground at (x, z), `up` metres above it. */
export const ground = (x: number, z: number, up = 0): Vec3 => ({ x, y: groundY(x, z) + up, z });
