import { type ActorDef, type NavGraph, type Rect, type StaticProp, mergeNav } from "./builders";
import { DISTRICT_M0_ACTORS, DISTRICT_M0_BOUNDS, DISTRICT_M0_PROPS } from "./district-m0";
import {
  KANAL_BOUNDS,
  KANAL_NAV,
  KANAL_PROPS,
  type RoofStash,
  TARG_NAV,
  TARG_ROOF_STASH,
  TARG_NORTH_ACTORS,
  TARG_NORTH_BOUNDS,
  TARG_NORTH_PROPS,
  TARG_SOUTH_ACTORS,
  TARG_SOUTH_BOUNDS,
  TARG_SOUTH_PROPS,
} from "./district-targ";

export const DISTRICTS = {
  "shinsekai-7": { name: "Shinsekai, kwartał 7" },
  kanal: { name: "Ulica Kanałowa" },
  targ: { name: "Targ pod estakadą" },
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
}

/** Every chunk of the city, in the order their content is created (and entity ids reserved). */
export const WORLD_CHUNKS: readonly ChunkDef[] = [
  { id: "shinsekai-7", district: "shinsekai-7", bounds: DISTRICT_M0_BOUNDS, props: DISTRICT_M0_PROPS, actors: DISTRICT_M0_ACTORS },
  { id: "kanal", district: "kanal", bounds: KANAL_BOUNDS, props: KANAL_PROPS, actors: [] },
  { id: "targ-south", district: "targ", bounds: TARG_SOUTH_BOUNDS, props: TARG_SOUTH_PROPS, actors: TARG_SOUTH_ACTORS },
  { id: "targ-north", district: "targ", bounds: TARG_NORTH_BOUNDS, props: TARG_NORTH_PROPS, actors: TARG_NORTH_ACTORS },
];

/** Level graph of the whole city (ADR-0021). Shinsekai 7 is flat and has none. */
export const WORLD_NAV: NavGraph = mergeNav(KANAL_NAV, TARG_NAV);

/** Stashes on roofs, placed once when the player first comes near (ADR-0021). */
export const WORLD_STASHES: readonly RoofStash[] = [TARG_ROOF_STASH];

/** Horizontal distance from a point to a rectangle; 0 inside. */
export const distanceToRect = (x: number, z: number, r: Rect): number =>
  Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));

/** First chunk (in table order) whose bounds contain the point. */
export const chunkAt = (x: number, z: number, chunks: readonly ChunkDef[] = WORLD_CHUNKS): ChunkDef | null =>
  chunks.find((c) => distanceToRect(x, z, c.bounds) === 0) ?? null;
