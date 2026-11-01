import { type BlockStyle, type TerrainGrid, type Vec3, terrainHeightAt } from "@seki/core";
import type { StaticProp } from "../builders";
import { shapeGrid } from "./shape";
import { bridgeDeckAt } from "./decks";
import { MAP_CHUNKS, PADS, RAMPS } from "./sites";
import { surfaceLiftAt } from "./roads";

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

/**
 * Height of the surface the renderer draws at (x, z): the ground and the lift of the paving laid
 * there (`SURFACE_LIFT`, ADR-0045), so what stands on a square or a carriageway is not sunk in it.
 */
export const surfaceY = (x: number, z: number): number => {
  const y = groundY(x, z);
  return y + surfaceLiftAt(x, z, bridgeDeckAt(x, z) === y);
};

/** How deep a level body may sit in the paving at its uphill side (m): a tyre's squash, not a sunk wheel. */
const REST_SINK = 0.05;

/**
 * Where the bottom of a level body (a car, which the renderer turns only by its yaw) rests on
 * the surface drawn under the points of its footprint (G-130): on the highest of them, sunk at
 * most `REST_SINK` and never below the lowest, so on a slope the uphill wheels keep out of the
 * paving and the downhill ones lift off it as little as they can.
 */
export const restingY = (points: readonly { readonly x: number; readonly z: number }[]): number => {
  const ys = points.map((p) => surfaceY(p.x, p.z));
  return Math.max(Math.min(...ys), Math.max(...ys) - REST_SINK);
};

const VEHICLES: ReadonlySet<BlockStyle> = new Set<BlockStyle>(["car", "van", "wreck"]);

/**
 * A set piece's props in the world with its vehicles (car, van and wreck blocks) level on the
 * paving drawn under their boxes (G-130), not on the terrain under their middles or the set
 * piece's origin. The rest stay as placed.
 */
export const onPaving = (props: readonly StaticProp[]): StaticProp[] =>
  props.map((p) => {
    if (p.view.kind !== "block" || !p.view.skin || !VEHICLES.has(p.view.skin.style)) return p;
    const { x: w, y: h, z: d } = p.view.size;
    const under = [-0.5, 0, 0.5].flatMap((a) => [-0.5, 0, 0.5].map((b) => ({ x: p.center.x + w * a, z: p.center.z + d * b })));
    return { ...p, center: { ...p.center, y: restingY(under) + h / 2 } };
  });
