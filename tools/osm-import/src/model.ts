/**
 * What the generator writes per chunk; mirrors `packages/sim/src/content/lublin/types.ts`
 * (the importer does not import sim, the sim test checks the generated files against its types).
 * Point lists are flat `[x0, z0, x1, z1, …]` in metres rounded to 0.1.
 */
import { type MarkingOut } from "./markings.ts";
import { type PassageOut } from "./passages.ts";
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
  /** Ground difference under the outline: the bottom `plinth` metres are a plinth on a slope. */
  readonly plinth: number;
  readonly levels: number;
  readonly use: BuildingUse;
  readonly roof?: number;
  readonly name?: string;
  readonly look: number;
  /** Shops on the ground floor (a 4 m storey). */
  readonly shopfront?: true;
  /** Where the height came from. */
  readonly source: "height" | "levels" | "default";
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
}
