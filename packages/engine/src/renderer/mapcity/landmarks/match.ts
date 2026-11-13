import { LUBLIN_CHUNKS, type LublinBuildingData, type LublinChunkData } from "@seki/sim/lublin";
import type { WallMaterial } from "../facade-style";
import { BELL_TOWERS, type BellTower } from "./bell-towers";
import { type P2, centroid, pointInRing } from "../polygon";
import { type CableAnchor, type LandmarkPart, RECIPE_BY_OSM } from "./recipes";

/**
 * Which map building a recipe's OSM id is (ADR-0062). A building view carries no OSM id, but the
 * entity of a map building stands at its data's position (the outline's centroid, rounded to
 * 0.1 m), so the recipes' ids are looked up once in the map data and matched by that position
 * and the outline's corner count. The parts lifted onto a part and the tenements its cables run
 * to come from the same data.
 */

/** How far from a part's position another building's position may lie to count as its neighbour, metres. */
const NEARBY = 30;

const keyOf = (x: number, z: number, corners: number): string => `${Math.round(x * 10)},${Math.round(z * 10)},${corners}`;

/** The world outline of a building of the data. */
const ringOf = (b: LublinBuildingData): P2[] => Array.from({ length: b.outline.length / 2 }, (_, i) => ({ x: b.x + (b.outline[i * 2] as number), z: b.z + (b.outline[i * 2 + 1] as number) }));

/** Recipe parts by position and corner count, from the given map data, with the parts lifted onto each. */
export const landmarkIndex = (chunks: readonly LublinChunkData[]): ReadonlyMap<string, LandmarkPart> => {
  const found = chunks.flatMap((c) => c.buildings.flatMap((b) => (RECIPE_BY_OSM.has(b.id) ? [b] : [])));
  const wanted = new Set([...RECIPE_BY_OSM.values()].flatMap((p) => p.part.tier.cables ?? []));
  const anchors = new Map(chunks.flatMap((c) => c.buildings.flatMap((b): [string, CableAnchor][] => (wanted.has(b.id) ? [[b.id, { ring: ringOf(b), top: b.y + b.height }]] : []))));
  const out = new Map<string, LandmarkPart>();
  for (const b of found) {
    const part = RECIPE_BY_OSM.get(b.id) as LandmarkPart;
    const ring = ringOf(b);
    // Standing on its top, from the data: the tower on the annex, not the octagon on the tower.
    const above = found.filter((o) => o !== b && o.soffit !== undefined && Math.abs(o.y + o.soffit - b.y - b.height) < 0.3 && RECIPE_BY_OSM.get(o.id)?.recipe === part.recipe && pointInRing(centroid(ringOf(o)), ring)).map(ringOf);
    const cableTo = (part.part.tier.cables ?? []).flatMap((id) => anchors.get(id) ?? []);
    // Standing against it or overlapping its fronts in the data (Teatr NN by Brama Grodzka).
    const nearby = chunks.flatMap((c) => c.buildings.flatMap((o) => (RECIPE_BY_OSM.get(o.id)?.recipe !== part.recipe && Math.hypot(o.x - b.x, o.z - b.z) < NEARBY ? [ringOf(o)] : [])));
    out.set(keyOf(b.x, b.z, b.outline.length / 2), { ...part, ...(above.length > 0 ? { above } : {}), ...(cableTo.length > 0 ? { cableTo } : {}), ...(nearby.length > 0 ? { nearby } : {}) });
  }
  return out;
};

let index: ReadonlyMap<string, LandmarkPart> | null = null;

/** The recipe part of the map building standing at (x, z) with an outline of `corners` points, or null. */
export const landmarkAt = (x: number, z: number, corners: number): LandmarkPart | null => {
  index ??= landmarkIndex(LUBLIN_CHUNKS);
  return index.get(keyOf(x, z, corners)) ?? null;
};

let bellTowers: ReadonlyMap<string, readonly BellTower[]> | null = null;

/** The bell towers of the renderer's on the map building standing at (x, z) with an outline of `corners` points: a church's of `BELL_TOWERS` (G-215), else none. */
export const bellTowersAt = (x: number, z: number, corners: number): readonly BellTower[] => {
  bellTowers ??= new Map(LUBLIN_CHUNKS.flatMap((c) => c.buildings.flatMap((b): [string, readonly BellTower[]][] => {
    const towers = BELL_TOWERS.get(b.id);
    return towers ? [[keyOf(b.x, b.z, b.outline.length / 2), towers]] : [];
  })));
  return bellTowers.get(keyOf(x, z, corners)) ?? [];
};

let towers: ReadonlySet<string> | null = null;

/** Whether the map building standing at (x, z) with an outline of `corners` points is a tower of the map (`tower`, G-232). */
export const towerAt = (x: number, z: number, corners: number): boolean => {
  towers ??= new Set(LUBLIN_CHUNKS.flatMap((c) => c.buildings.flatMap((b) => (b.tower ? [keyOf(b.x, b.z, b.outline.length / 2)] : []))));
  return towers.has(keyOf(x, z, corners));
};

/** The walls the map gives a building (G-244): `building:material` and `building:colour`. */
export interface MappedWall {
  readonly material?: WallMaterial;
  readonly wallColour?: string;
}

let walls: ReadonlyMap<string, MappedWall> | null = null;

/** The walls of the map building standing at (x, z) with an outline of `corners` points, empty where the map is silent. */
export const wallAt = (x: number, z: number, corners: number): MappedWall => {
  walls ??= new Map(
    LUBLIN_CHUNKS.flatMap((c) => c.buildings.flatMap((b): [string, MappedWall][] => (b.material || b.colour ? [[keyOf(b.x, b.z, b.outline.length / 2), { ...(b.material ? { material: b.material } : {}), ...(b.colour ? { wallColour: b.colour } : {}) }]] : []))),
  );
  return walls.get(keyOf(x, z, corners)) ?? {};
};
