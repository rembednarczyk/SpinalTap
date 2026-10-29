import type { StreetPropItem, TerrainGrid } from "@seki/core";
import { type ActorDef, type NavGraph, type Rect, type StaticProp, mergeNav } from "./builders";
import { DISTRICT_M0_ACTORS, DISTRICT_M0_PROPS, S7_STASHES } from "./district-m0";
import { KANAL_ACTORS, KANAL_ALLEY_STASH, KANAL_PROPS } from "./district-kanal";
import {
  type RoofStash,
  TARG_NAV,
  TARG_NORTH_ACTORS,
  TARG_NORTH_PROPS,
  TARG_OVERPASS_STASH,
  TARG_ROOF_STASH,
  TARG_SOUTH_ACTORS,
  TARG_SOUTH_PROPS,
} from "./district-targ";
import { DEVICES, type DeviceDef } from "./devices";
import { METRO_STATIONS, type MetroStationDef } from "./metro";
import { CLINIC_DOOR, KOI_DOOR, S7_NAV } from "./interiors";
import { DOKI_NAV, DOKI_QUAY_ACTORS, DOKI_QUAY_PROPS, DOKI_YARD_ACTORS, DOKI_YARD_PROPS } from "./district-doki";
import { type RoomCut, type SceneryItem, chunkBuildings, chunkScenery } from "./lublin/city";
import { CLEARED_BUILDINGS, CLINIC_SITE, KOI_SITE, MAP_CHUNKS, PASSAGES } from "./lublin/sites";
import { SHAPED_TERRAIN, groundY } from "./lublin/terrain";
import { LUBLIN_STREET_PROPS } from "./lublin";
import { furnitureProps, furnitureRadius } from "./lublin/furniture";
import { DRINKER_SITES, drinkerWay } from "./contract-plans";

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

/** What the game adds to the map, in the order its entity ids are reserved. */
const GAME_PROPS: readonly StaticProp[] = [...DISTRICT_M0_PROPS, ...KANAL_PROPS, ...TARG_SOUTH_PROPS, ...TARG_NORTH_PROPS, ...DOKI_YARD_PROPS, ...DOKI_QUAY_PROPS];
const GAME_ACTORS: readonly ActorDef[] = [...DISTRICT_M0_ACTORS, ...KANAL_ACTORS, ...TARG_SOUTH_ACTORS, ...TARG_NORTH_ACTORS, ...DOKI_YARD_ACTORS, ...DOKI_QUAY_ACTORS];

const MAP_BUILDINGS: ReadonlyMap<string, readonly StaticProp[]> = new Map(MAP_CHUNKS.map((c) => [c.id, chunkBuildings(c, ROOM_CUTS, PASSAGES)]));

/** A set piece's or a game block's clearance from the map's furniture (m). */
const FURNITURE_CLEARANCE = 1.2;

const gameBlocks: readonly Rect[] = [...GAME_PROPS, ...METRO_STATIONS.flatMap((m) => m.props)].flatMap((p) =>
  p.view.kind === "block" ? [{ minX: p.center.x - p.view.size.x / 2, maxX: p.center.x + p.view.size.x / 2, minZ: p.center.z - p.view.size.z / 2, maxZ: p.center.z + p.view.size.z / 2 }] : [],
).concat(METRO_STATIONS.map((m) => ({ minX: m.kiosk.x - 0.6, maxX: m.kiosk.x + 0.6, minZ: m.kiosk.z - 0.6, maxZ: m.kiosk.z + 0.6 })));

type Pt = { readonly x: number; readonly z: number };

/** Horizontal distance from (x, z) to the segment a..b. */
const segmentDistance = (x: number, z: number, a: Pt, b: Pt): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2));
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
};

/** Plac Łokietka on foot: from the deptak past the car wash to the mouth of Brama Krakowska (ADR-0045). */
const GATE_WALK: readonly Pt[] = [
  { x: 400, z: -97 },
  { x: 440, z: -100 },
  { x: 447, z: -95 },
  { x: 457, z: -95.6 },
];

/** Ways the content walks in straight lines (the night drinker's to the bar, the gates' passages): no furniture on them. */
const KEEP_CLEAR: readonly (readonly [Pt, Pt])[] = [
  ...DRINKER_SITES.flatMap((site) => {
    const way = drinkerWay(site) ?? [];
    return way.slice(1).map((p, k) => [way[k] as Pt, p] as const);
  }),
  ...PASSAGES.map((p) => [p.from, p.to] as const),
  // The way from the deptak across Plac Łokietka into Brama Krakowska.
  ...GATE_WALK.slice(1).map((p, k) => [GATE_WALK[k] as Pt, p] as const),
];

/** Does a piece of the map's furniture stand clear of the game's set pieces, blocks and characters? */
const clearOfGame = (i: StreetPropItem): boolean =>
  !CLEARED_BUILDINGS.some((r) => distanceToRect(i.x, i.z, r) < 2) &&
  !gameBlocks.some((b) => distanceToRect(i.x, i.z, b) < FURNITURE_CLEARANCE) &&
  !GAME_ACTORS.some((a) => Math.hypot(a.spawn.position.x - i.x, a.spawn.position.z - i.z) < FURNITURE_CLEARANCE) &&
  !KEEP_CLEAR.some(([a, b]) => segmentDistance(i.x, i.z, a, b) < furnitureRadius(i) + 0.7);

/**
 * The street furniture of the game's Lublin per chunk (ADR-0050): the map's pieces (ADR-0047)
 * that stand clear of the set pieces and the game's own blocks, on the shaped terrain.
 */
export const WORLD_STREET_PROPS: Readonly<Record<string, readonly StreetPropItem[]>> = Object.fromEntries(
  MAP_CHUNKS.map((c) => [c.id, (LUBLIN_STREET_PROPS[c.id] ?? []).filter(clearOfGame).map((i) => ({ ...i, y: Math.round(groundY(i.x, i.z) * 100) / 100 }))]),
);

/**
 * Every chunk of the city (ADR-0045): Lublin's chunks from the map, each with the map's
 * buildings as solids and the game's props and characters that stand in it, on the shaped
 * terrain. The order is the creation order (and the order entity ids are reserved in).
 */
export const WORLD_CHUNKS: readonly ChunkDef[] = MAP_CHUNKS.map((c) => {
  const terrain = SHAPED_TERRAIN.get(c.id);
  return {
    id: c.id,
    district: c.district,
    bounds: c.bounds,
    props: [...(MAP_BUILDINGS.get(c.id) ?? []), ...GAME_PROPS.filter((p) => mapChunkOf(p.center.x, p.center.z) === c.id)],
    actors: GAME_ACTORS.filter((a) => mapChunkOf(a.spawn.position.x, a.spawn.position.z) === c.id),
    ...(terrain ? { terrain } : {}),
    street: furnitureProps(WORLD_STREET_PROPS[c.id] ?? []),
  };
});

/**
 * What the renderer draws of the city for good (ADR-0045): the shaped terrain, the surfaces and
 * the buildings of every chunk, whether the chunk is streamed in or not. The buildings' props
 * carry `scenery`, so their entities are solids without a view.
 */
export const WORLD_SCENERY: readonly SceneryItem[] = [
  ...MAP_CHUNKS.flatMap((c) => chunkScenery(c, MAP_BUILDINGS.get(c.id) ?? [])),
  // The furniture last (ADR-0050), so the views above keep their scenery ids.
  ...MAP_CHUNKS.map((c): SceneryItem => ({ chunk: c.id, view: { kind: "street-props", items: WORLD_STREET_PROPS[c.id] ?? [] }, at: { x: 0, y: 0, z: 0 } })),
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
export const WORLD_STASHES: readonly RoofStash[] = [TARG_ROOF_STASH, ...S7_STASHES, KANAL_ALLEY_STASH, TARG_OVERPASS_STASH];

/** First chunk (in table order) whose bounds contain the point. */
export const chunkAt = (x: number, z: number, chunks: readonly ChunkDef[] = WORLD_CHUNKS): ChunkDef | null =>
  chunks.find((c) => distanceToRect(x, z, c.bounds) === 0) ?? null;
