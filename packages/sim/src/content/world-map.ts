import type { TerrainGrid } from "@seki/core";
import { type ActorDef, type NavGraph, type Rect, type StaticProp, mergeNav } from "./builders";
import { S7_STASHES } from "./district-m0";
import { KANAL_ALLEY_STASH, KANAL_SCENERY } from "./district-kanal";
import { type RoofStash, TARG_NAV, TARG_OVERPASS_STASH, TARG_ROOF_STASH } from "./district-targ";
import { DEVICES, type DeviceDef } from "./devices";
import { TRASA_PODZIEMNA_BOUNDS, TRASA_PODZIEMNA_CHUNK, TRASA_PODZIEMNA_PROPS, TRASA_PODZIEMNA_STASH } from "./kanal-underground";
import { METRO_STATIONS, type MetroStationDef } from "./metro";
import { CLINIC_DOOR, KOI_DOOR, S7_NAV } from "./interiors";
import { DOKI_NAV } from "./district-doki";
import { type RoomCut, type SceneryItem, chunkBuildings, chunkScenery } from "./lublin/city";
import { BUILDING_CUTS, CLINIC_SITE, KOI_SITE, MAP_CHUNKS, PASSAGES } from "./lublin/sites";
import { SHAPED_TERRAIN } from "./lublin/terrain";
import { BRIDGE_DECKS } from "./lublin/decks";
import type { GroundDeck } from "../world/deck";
import { furnitureProps } from "./lublin/furniture";
import { basinRimProps } from "./lublin/basins";
import { GAME_ACTORS, GAME_PROPS, WORLD_STREET_PROPS } from "./street-props";
import { PARKED_CARS, parkedProp, parkedView } from "./parked-cars";

export { WORLD_STREET_PROPS } from "./street-props";

/** The districts of Lublin 2077 (ADR-0042); the ids are the game's from before the move. */
export const DISTRICTS = {
  "shinsekai-7": { name: "Krakowskie Przedmieście" },
  kanal: { name: "Stare Miasto" },
  targ: { name: "Podzamcze" },
  doki: { name: "Nabrzeże Bystrzycy" },
} as const;

export type DistrictId = keyof typeof DISTRICTS;

/**
 * The unit of world streaming: a rectangle of the map with everything placed in it.
 * `bounds` encloses the chunk's walkable area and props; streaming measures distance to it.
 */
export interface ChunkDef {
  readonly id: string;
  readonly district: DistrictId;
  readonly bounds: Rect;
  readonly props: readonly StaticProp[];
  readonly actors: readonly ActorDef[];
  /**
   * The chunk's terrain (ADR-0043): characters stand on it, rays stop on it. Neighbouring chunks
   * must give the same heights where their bounds meet. Without it the ground is y = 0.
   */
  readonly terrain?: TerrainGrid;
  /** Bridge decks over the terrain (ADR-0053): the ground there. */
  readonly decks?: readonly GroundDeck[];
  /**
   * Solids of the street (ADR-0050): the furniture a body stumbles on, drawn by the scenery.
   * Their ids come from `STREET_ID_BASE`, not the allocator, so no id of the content moves.
   */
  readonly street?: readonly StaticProp[];
}

/** Horizontal distance from a point to a rectangle; 0 inside. */
export const distanceToRect = (x: number, z: number, r: Rect): number =>
  Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));

/** The map chunk a piece of content belongs to: the first holding its point, or the nearest. */
const mapChunkOf = (x: number, z: number): string => {
  let best = MAP_CHUNKS[0]?.id ?? "";
  let bestD = Infinity;
  for (const c of MAP_CHUNKS) {
    const d = distanceToRect(x, z, c.bounds);
    if (d === 0) return c.id;
    if (d < bestD) {
      bestD = d;
      best = c.id;
    }
  }
  return best;
};

/** The rooms cut into the tenements of Krakowskie Przedmieście, with their doors (ADR-0045). */
const ROOM_CUTS: readonly RoomCut[] = [
  { site: CLINIC_SITE, doors: [{ x: CLINIC_DOOR.at.x, width: CLINIC_DOOR.width, height: CLINIC_DOOR.height }] },
  { site: KOI_SITE, doors: [{ x: KOI_DOOR.at.x, width: KOI_DOOR.width, height: KOI_DOOR.height }] },
];

const MAP_BUILDINGS: ReadonlyMap<string, readonly StaticProp[]> = new Map(MAP_CHUNKS.map((c) => [c.id, chunkBuildings(c, ROOM_CUTS, PASSAGES, BUILDING_CUTS)]));

/**
 * Every chunk of the city (ADR-0045): Lublin's chunks from the map, each with the map's
 * buildings as solids and the game's props and characters that stand in it, on the shaped
 * terrain. The order is the creation order (and the order entity ids are reserved in).
 */
export const WORLD_CHUNKS: readonly ChunkDef[] = [
  ...MAP_CHUNKS.map((c): ChunkDef => {
    const terrain = SHAPED_TERRAIN.get(c.id);
    return {
      id: c.id,
      district: c.district,
      bounds: c.bounds,
      props: [...(MAP_BUILDINGS.get(c.id) ?? []), ...GAME_PROPS.filter((p) => mapChunkOf(p.center.x, p.center.z) === c.id)],
      actors: GAME_ACTORS.filter((a) => mapChunkOf(a.spawn.position.x, a.spawn.position.z) === c.id),
      ...(terrain ? { terrain } : {}),
      ...((BRIDGE_DECKS.get(c.id) ?? []).length > 0 ? { decks: BRIDGE_DECKS.get(c.id) } : {}),
      street: [...furnitureProps(WORLD_STREET_PROPS[c.id] ?? []), ...basinRimProps(c), ...PARKED_CARS.filter((p) => p.chunk === c.id).map(parkedProp)],
    };
  }),
  // Trasa Podziemna (ADR-0048): a chunk of its own over the cellars, last in the table, so it
  // streams in only near the Trybunał and the ground and the district there stay the Rynek's.
  { id: TRASA_PODZIEMNA_CHUNK, district: "kanal", bounds: TRASA_PODZIEMNA_BOUNDS, props: TRASA_PODZIEMNA_PROPS, actors: [] },
];

/**
 * What the renderer draws of the city for good (ADR-0045): the shaped terrain, the surfaces and
 * the buildings of every chunk, whether the chunk is streamed in or not. The buildings' props
 * carry `scenery`, so their entities are solids without a view.
 */
export const WORLD_SCENERY: readonly SceneryItem[] = [
  ...MAP_CHUNKS.flatMap((c) => chunkScenery(c, MAP_BUILDINGS.get(c.id) ?? [])),
  // The game's own buildings drawn with the city: the covered footbridge over Grodzka (ADR-0048).
  ...KANAL_SCENERY.map((s): SceneryItem => ({ chunk: mapChunkOf(s.at.x, s.at.z), view: s.view, at: s.at })),
  // The furniture (ADR-0050), so the views above keep their scenery ids.
  ...MAP_CHUNKS.map((c): SceneryItem => ({ chunk: c.id, view: { kind: "street-props", items: WORLD_STREET_PROPS[c.id] ?? [] }, at: { x: 0, y: 0, z: 0 } })),
  // The parked cars (ADR-0050), each drawn where it stands.
  ...PARKED_CARS.map((p): SceneryItem => ({ chunk: p.chunk, view: parkedView(p), at: { x: p.x, y: p.y, z: p.z }, yaw: p.yaw })),
];

/** Cameras and hackable devices (ADR-0029); each one names its chunk above. */
export const WORLD_DEVICES: readonly DeviceDef[] = DEVICES;

/** Metro platforms (ADR-0034); each one names its chunk above. */
export const WORLD_METRO: readonly MetroStationDef[] = METRO_STATIONS;

/**
 * Level graph of the whole city (ADR-0021): the market's viaduct, the docks' roofs and crane,
 * and the interiors of Krakowskie Przedmieście (ADR-0038). The streets themselves are one level
 * on the terrain.
 */
export const WORLD_NAV: NavGraph = mergeNav(TARG_NAV, DOKI_NAV, S7_NAV);

/** Stashes placed once when the player first comes near: on roofs (ADR-0021), in alleys and dead ends (ADR-0026). */
export const WORLD_STASHES: readonly RoofStash[] = [TARG_ROOF_STASH, ...S7_STASHES, KANAL_ALLEY_STASH, TARG_OVERPASS_STASH, TRASA_PODZIEMNA_STASH];

/** First chunk (in table order) whose bounds contain the point. */
export const chunkAt = (x: number, z: number, chunks: readonly ChunkDef[] = WORLD_CHUNKS): ChunkDef | null =>
  chunks.find((c) => distanceToRect(x, z, c.bounds) === 0) ?? null;
