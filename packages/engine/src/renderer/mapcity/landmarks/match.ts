import { LUBLIN_CHUNKS, type LublinBuildingData, type LublinChunkData } from "@seki/sim/lublin";
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

/**
 * Landmarks of the curator's list the map shows whole and without a tower (G-210): no
 * `building:part`, no `tower:*` and no tower mapped at them. The Trinity Chapel has none (T-119,
 * NMPT). The Bernardine church has one, but not where the renderer's would stand: by its south
 * wall where the nave meets the chancel (about (378.1, -247.7), 5.5 x 5.5 m, helmet to y 39.2 in
 * NMPT), with a ridge turret at (375.4, -240.1) to y 31.8. Without it is the lesser error than
 * two made-up towers at its west end, until the tower comes in as a part (G-214) and the entry goes.
 */
const TOWERLESS_OSM: ReadonlySet<string> = new Set(["w66258167", "w66330578"]);

let towerless: ReadonlySet<string> | null = null;

/**
 * Whether the map building standing at (x, z) with an outline of `corners` points takes no bell
 * towers of the renderer's: a landmark without a tower, or a church whose tower the map has by
 * it (`mappedTower`, G-212), so a made-up one would stand beside the real one.
 */
export const towerlessAt = (x: number, z: number, corners: number): boolean => {
  towerless ??= new Set(LUBLIN_CHUNKS.flatMap((c) => c.buildings.flatMap((b) => (TOWERLESS_OSM.has(b.id) || b.mappedTower ? [keyOf(b.x, b.z, b.outline.length / 2)] : []))));
  return towerless.has(keyOf(x, z, corners));
};
