import { type BlockStyle, type TerrainGrid, type Vec3, terrainHeightAt } from "@seki/core";
import type { StaticProp } from "../builders";
import { underDecks } from "./abutments";
import { FLIGHT_CELL, type Pad, flightGrid, refineGrid, shapeGrid } from "./shape";
import { shapeWays, wayRamps, waySegments } from "./steep-ways";
import { bridgeDeckAt, deckGroundAt } from "./decks";
import { DIG_PADS, FLIGHT_RAMPS, MAP_CHUNKS, PADS, RAMPS, STEEP_WAYS } from "./sites";
import { surfaceLiftAt } from "./roads";
import { stitchSeams } from "./seams";

const inside = (b: { minX: number; maxX: number; minZ: number; maxZ: number }, x: number, z: number): boolean => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;

/** W-3's site with its margins (ADR-0082): the fence, the quay, the basin and the strip south of them. */
const W3_SITE = { minX: 2470, maxX: 2615, minZ: 375, maxZ: 480 } as const;
const overlaps = (g: TerrainGrid, b: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number }): boolean =>
  g.originX <= b.maxX && g.originX + (g.cols - 1) * g.cell >= b.minX && g.originZ <= b.maxZ && g.originZ + (g.rows - 1) * g.cell >= b.minZ;
/**
 * A grid under W-3 refined to `FLIGHT_CELL` before the pads (ADR-0082, audit P2): on the import's
 * 5 m cell the zone's pad would pull the public strip and the metro's entrance down a cell past
 * the fence. Refining keeps the NMT's surface as it is; the pads then end within a metre.
 */
export const w3Grid = (g: TerrainGrid): TerrainGrid => (g.cell > FLIGHT_CELL && overlaps(g, W3_SITE) ? refineGrid(g, FLIGHT_CELL) : g);

/**
 * A grid a building site's dig reaches (ADR-0087), its blend and a cell past it, refined to
 * `FLIGHT_CELL`, else as it is: the import's 5 m cell would carry the dig a cell further, past
 * the fence. Refining keeps the surface as it is.
 */
export const siteGrid = (g: TerrainGrid, pads: readonly Pad[] = DIG_PADS): TerrainGrid =>
  g.cell > FLIGHT_CELL && pads.some((p) => overlaps(g, { minX: p.rect.minX - p.blend - g.cell, maxX: p.rect.maxX + p.blend + g.cell, minZ: p.rect.minZ - p.blend - g.cell, maxZ: p.rect.maxZ + p.blend + g.cell })) ? refineGrid(g, FLIGHT_CELL) : g;

/**
 * The terrain of the game's Lublin (ADR-0045): the map's grids with the pads and ramps of
 * `sites.ts` applied, by chunk id. The simulation walks on these and the renderer draws them.
 * The pads and the steps' ramps are shaped on the import's grid (G-236 round 3; Trasa
 * Podziemna's dig is in metres and holds on any grid of up to 5 m, G-252); only then is a grid
 * under a flight's ramp refined, which keeps that surface as it is, and the flights' ramps laid on
 * the finer points. Then the stretches of the ways walked on foot still too steep on that terrain
 * are laid at an even grade along them, on the finer grid too (G-755). Last the seams are
 * stitched (G-748): each grid's points by a coarser neighbour take its surface, so the chunks'
 * terrain meets there. The building sites' digs are laid with the flights' ramps, on a grid
 * refined under them (`siteGrid`).
 */
const LAID: ReadonlyMap<string, TerrainGrid> = new Map(
  MAP_CHUNKS.map((c) => [c.id, shapeGrid(flightGrid(siteGrid(shapeGrid(w3Grid(c.terrain), PADS, RAMPS)), FLIGHT_RAMPS), DIG_PADS, FLIGHT_RAMPS)]),
);
/** The steep ways' stretches laid (G-755), read on the ground walked there: a way on a bridge's deck is not on the bank under it. */
export const WAY_RAMPS = wayRamps(
  STEEP_WAYS,
  (x, z) => {
    const c = MAP_CHUNKS.find((k) => inside(k.bounds, x, z));
    return c ? terrainHeightAt(LAID.get(c.id)!, x, z) : 0;
  },
  deckGroundAt,
);
export const SHAPED_TERRAIN: ReadonlyMap<string, TerrainGrid> = stitchSeams(MAP_CHUNKS, underDecks(MAP_CHUNKS, new Map([...LAID].map(([id, g]) => [id, shapeWays(flightGrid(g, waySegments(WAY_RAMPS)), WAY_RAMPS)]))));

/**
 * Ground height of the game's terrain at (x, z): the first chunk holding the point, or a bridge's
 * deck over it or a flight of steps hung off one (G-255), as the simulation's ground does.
 */
export const groundY = (x: number, z: number): number => {
  for (const c of MAP_CHUNKS) {
    if (!inside(c.bounds, x, z)) continue;
    const g = SHAPED_TERRAIN.get(c.id);
    if (!g) return 0;
    return deckGroundAt(x, z, terrainHeightAt(g, x, z));
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
