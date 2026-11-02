/**
 * What the generator writes per chunk; mirrors `packages/sim/src/content/lublin/types.ts`
 * (the importer does not import sim, the sim test checks the generated files against its types).
 * Point lists are flat `[x0, z0, x1, z1, …]` in metres rounded to 0.1.
 */
import { type MarkingOut } from "./markings.ts";
import { type PassageOut } from "./passages.ts";
import { type VenueOut } from "./venues.ts";
import type { RoofShape } from "../../../packages/core/src/ports/types.ts";
import { type BuildingUse, type GroundSurface, type TerrainGrid } from "../../../packages/core/src/world/city-geo.ts";

export interface BuildingOut {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  /** World y of the building's foot: the lowest NMT point under the outline. */
  readonly y: number;
  /** Counter-clockwise outline relative to (x, z). */
  readonly outline: readonly number[];
  /** Convex counter-clockwise parts of the outline, relative to (x, z); their areas sum to the outline's. */
  readonly parts: readonly (readonly number[])[];
  /** From `y` to the eaves, plinth included. */
  readonly height: number;
  /** A part lifted onto its building (`building:part`, G-049): its walls start this far over `y`. */
  readonly soffit?: number;
  /** Ground difference under the outline: the bottom `plinth` metres are a plinth on a slope. */
  readonly plinth: number;
  readonly levels: number;
  readonly use: BuildingUse;
  readonly roof?: number;
  /** The roof's shape from `roof:shape` (ADR-0064); absent, the renderer picks one. */
  readonly roofShape?: RoofShape;
  /** `roof:orientation=across`: the ridge across the outline's long side. */
  readonly roofAcross?: true;
  readonly name?: string;
  readonly look: number;
  /** Shops on the ground floor (a 4 m storey). */
  readonly shopfront?: true;
  /** A church with a tower of the map in its outline or by its walls (G-212): the renderer adds none of its own. */
  readonly mappedTower?: true;
  /** Where the height came from. */
  readonly source: "height" | "levels" | "default";
  /** Venues in or at it (ADR-0064 stage 4), relative to (x, z), with their 2077 names. */
  readonly venues?: readonly VenueOut[];
}

export interface GroundOut {
  readonly surface: GroundSurface;
  /** World points, counter-clockwise, clipped to the chunk. */
  readonly outline: readonly number[];
  /** Laid on a bridge, not on the terrain. */
  readonly bridge?: true;
  /** The bridge's deck axis, `[x0, z0, x1, z1]`: the bridge way's ends, its abutments. */
  readonly deck?: readonly number[];
}

export interface StreetOut {
  readonly name: string;
  readonly kind: string;
  readonly line: readonly number[];
  /** Driven one way only, the way the line runs. */
  readonly oneway?: true;
  /** A passage under a building closed to motor vehicles: no lane, not even for deliveries (G-002). */
  readonly noVehicles?: true;
}

/** An unnamed service road's axis (world polyline, clipped to the chunk) and its carriageway's width (m). */
export interface ServiceWayOut {
  readonly line: readonly number[];
  readonly width: number;
}

/** A footway's or a path's axis mapped on its own (world polyline, clipped to the chunk) and its width (m). */
export interface FootWayOut {
  readonly line: readonly number[];
  readonly width: number;
}

/** A street's axis of two lanes or more a way (world polyline, clipped to the chunk). */
export interface MultiLaneWayOut {
  readonly line: readonly number[];
}

/** A car park mapped as an area: its map id, `parking` kind (`street_side`, `lane`, `surface`…) and world outline. */
export interface CarParkOut {
  readonly id: string;
  readonly kind: string;
  /** Its bays' `orientation` when mapped: `parallel`, `perpendicular` or `diagonal` (G-177). */
  readonly orientation?: string;
  readonly outline: readonly number[];
}

export type PoiKind = "shop" | "food" | "bar" | "stop" | "hotel" | "sight" | "culture" | "church" | "service" | "office";

export interface PoiOut {
  readonly x: number;
  readonly z: number;
  readonly kind: PoiKind;
  /** The OSM tag it came from, like `shop=bakery`. */
  readonly tag: string;
  readonly name: string;
}

export interface ChunkOut {
  readonly id: string;
  readonly district: "shinsekai-7" | "kanal" | "targ" | "doki";
  readonly bounds: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
  readonly terrain: TerrainGrid;
  readonly buildings: readonly BuildingOut[];
  readonly ground: readonly GroundOut[];
  readonly streets: readonly StreetOut[];
  /** Road markings (ADR-0052). */
  readonly markings: readonly MarkingOut[];
  readonly pois: readonly PoiOut[];
  /** Passages through the chunk's buildings (ADR-0048), when it has any. */
  readonly passages?: readonly PassageOut[];
  /** Unnamed service roads (G-140), when it has any. */
  readonly serviceWays?: readonly ServiceWayOut[];
  /** Footways and paths mapped on their own (G-143), when it has any. */
  readonly footWays?: readonly FootWayOut[];
  /** Car parks reaching into it, when it has any. */
  readonly carParks?: readonly CarParkOut[];
  /** Bus stops' posts by it, flat x, z (G-156), when it has any. */
  readonly busStops?: readonly number[];
  /** Streets of two lanes or more a way (G-155), when it has any. */
  readonly multiLaneWays?: readonly MultiLaneWayOut[];
}
