import { LUBLIN_CHUNKS, type LublinChunkData } from "@seki/sim/lublin";
import { type LandmarkPart, RECIPE_BY_OSM } from "./recipes";

/**
 * Which map building a recipe's OSM id is (ADR-0062). A building view carries no OSM id, but the
 * entity of a map building stands at its data's position (the outline's centroid, rounded to
 * 0.1 m), so the recipes' ids are looked up once in the map data and matched by that position
 * and the outline's corner count.
 */

const keyOf = (x: number, z: number, corners: number): string => `${Math.round(x * 10)},${Math.round(z * 10)},${corners}`;

/** Recipe parts by position and corner count, from the given map data. */
export const landmarkIndex = (chunks: readonly LublinChunkData[]): ReadonlyMap<string, LandmarkPart> => {
  const out = new Map<string, LandmarkPart>();
  for (const c of chunks) {
    for (const b of c.buildings) {
      const part = RECIPE_BY_OSM.get(b.id);
      if (part) out.set(keyOf(b.x, b.z, b.outline.length / 2), part);
    }
  }
  return out;
};

let index: ReadonlyMap<string, LandmarkPart> | null = null;

/** The recipe part of the map building standing at (x, z) with an outline of `corners` points, or null. */
export const landmarkAt = (x: number, z: number, corners: number): LandmarkPart | null => {
  index ??= landmarkIndex(LUBLIN_CHUNKS);
  return index.get(keyOf(x, z, corners)) ?? null;
};
