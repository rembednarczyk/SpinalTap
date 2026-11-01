import type { BuildingUse, GroundSurface, RoadMarkingKind, RoofShape, StreetPropKind, TerrainGrid, VenueKind } from "@seki/core";

/**
 * Lublin's centre from map data (ADR-0042), as `tools/osm-import` writes it into
 * `*.generated.ts`. World metres around `LUBLIN_ANCHOR`: x east, z north, y = height above sea
 * level − `LUBLIN_ANCHOR.altitude`. Point lists are flat `[x0, z0, x1, z1, …]`, rounded to 0.1 m.
 */
export type FlatPoints = readonly number[];

export interface LublinBuildingData {
  /** OSM element: `w<id>` a way, `r<id>` a multipolygon (`r<id>/<k>` its k-th outer ring). */
  readonly id: string;
  /** Position: the outline's centroid on the ground plane. */
  readonly x: number;
  readonly z: number;
  /** World y of the foot: the lowest point of the 1 m terrain model under the outline. */
  readonly y: number;
  /** Counter-clockwise outline relative to (x, z), simplified to about 0.3 m. Holes (courtyards of multipolygons) are filled. */
  readonly outline: FlatPoints;
  /** Convex counter-clockwise parts of the outline relative to (x, z), for prism solids; their areas sum to the outline's. */
  readonly parts: readonly FlatPoints[];
  /** From `y` to the eaves, metres, plinth included. */
  readonly height: number;
  /**
   * A part of a landmark lifted onto the building under it (OSM `building:part`, G-049): a tower,
   * a helmet, a nave over the aisles. Its walls and its solid start this many metres over `y`.
   */
  readonly soffit?: number;
  /** Ground difference under the outline: on a slope the bottom `plinth` metres are a plinth (podmurówka). */
  readonly plinth: number;
  readonly levels: number;
  readonly use: BuildingUse;
  /** Pitched or domed roof above `height`, metres; absent means flat. */
  readonly roof?: number;
  /** The roof's shape from OSM `roof:shape` (ADR-0064); absent, the renderer picks one. */
  readonly roofShape?: RoofShape;
  /** OSM `roof:orientation=across`: the ridge across the outline's long side. */
  readonly roofAcross?: true;
  /** Landmark name (named OSM building, or a named hotel or sight mapped as a point inside it). */
  readonly name?: string;
  /** Seed of the facade's variation: FNV-1a of `id`. */
  readonly look: number;
  /** Shops on the ground floor (a 4 m storey). */
  readonly shopfront?: true;
  /** Where the height came from: the `height` tag, `building:levels`, or the district's defaults. */
  readonly source: "height" | "levels" | "default";
  /** Venues in or at it (ADR-0064 stage 4): a point relative to (x, z), the kind, the 2077 name and the neon. */
  readonly venues?: readonly LublinVenueData[];
}

/** A shop, café, bar, bank, pharmacy or club of the map on a building (ADR-0064 stage 4). */
export interface LublinVenueData {
  readonly x: number;
  readonly z: number;
  readonly kind: VenueKind;
  /** Lublin 2077's name from the importer's `venue-names` table, never the real one (ADR-0058). */
  readonly name: string;
  /** `#rrggbb` from the kit's neon palette (ADR-0022). */
  readonly color: string;
}

export interface LublinGroundData {
  readonly surface: GroundSurface;
  /** World points, counter-clockwise, clipped to the chunk. Listed in draw order (water first, rails last). */
  readonly outline: FlatPoints;
  /** On a bridge: not draped on the terrain. */
  readonly bridge?: true;
  /** The bridge's deck axis, `[x0, z0, x1, z1]`: the bridge way's ends, its abutments. */
  readonly deck?: FlatPoints;
}

export interface LublinStreetData {
  readonly name: string;
  /** The OSM `highway` value. */
  readonly kind: string;
  /** World polyline, clipped to the chunk. */
  readonly line: FlatPoints;
  /** Driven one way only, the way the line runs (`oneway=-1` already turned round). */
  readonly oneway?: true;
  /** A passage under a building closed to motor vehicles in OSM: no lane, not even for deliveries (G-002). */
  readonly noVehicles?: true;
}

export interface LublinMarkingData {
  readonly kind: RoadMarkingKind;
  /** World polyline along the line. */
  readonly line: FlatPoints;
}

export type LublinPoiKind = "shop" | "food" | "bar" | "stop" | "hotel" | "sight" | "culture" | "church" | "service" | "office";

export interface LublinPoiData {
  readonly x: number;
  readonly z: number;
  readonly kind: LublinPoiKind;
  /** The OSM tag it came from, like `shop=bakery`. */
  readonly tag: string;
  readonly name: string;
}

/** A passage through a building of the chunk (ADR-0048), from a way the map has under it. */
export interface LublinPassageData {
  /** The building it runs through. */
  readonly building: string;
  /** World points a little beyond both facades. */
  readonly from: { readonly x: number; readonly z: number };
  readonly to: { readonly x: number; readonly z: number };
  readonly width: number;
  /** Clear height under the vault's crown, and how far the vault rises under it (m). */
  readonly height: number;
  readonly rise: number;
}

/** An unnamed service road (a driveway, a yard's lane): no lane of the game, only room kept clear of parked cars (G-140). */
export interface LublinServiceWayData {
  /** World polyline, clipped to the chunk. */
  readonly line: FlatPoints;
  /** Its carriageway's width (m). */
  readonly width: number;
}

export interface LublinChunkData {
  readonly id: string;
  readonly district: "shinsekai-7" | "kanal" | "targ" | "doki";
  /** The chunk's rectangle. Buildings belong to the chunk holding their centroid and may reach past it. */
  readonly bounds: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
  /** Terrain over exactly `bounds`; the cell is finer where the ground is steep. */
  readonly terrain: TerrainGrid;
  readonly buildings: readonly LublinBuildingData[];
  readonly ground: readonly LublinGroundData[];
  readonly streets: readonly LublinStreetData[];
  /** Road markings (ADR-0052), cut to the chunk: world polylines. */
  readonly markings: readonly LublinMarkingData[];
  readonly pois: readonly LublinPoiData[];
  /** Passages through its buildings, when it has any. */
  readonly passages?: readonly LublinPassageData[];
  /** Unnamed service roads, when it has any (named ones are among `streets`). */
  readonly serviceWays?: readonly LublinServiceWayData[];
}

/**
 * Street furniture of the chunks (ADR-0047), as `pnpm osm:props` writes it: per chunk id, per
 * `StreetPropKind`, flat rows of x, y, z (world metres, y from the chunk's terrain), yaw
 * (radians from +z towards +x) and variant.
 */
export type LublinPropTable = Readonly<Record<string, Readonly<Partial<Record<StreetPropKind, readonly number[]>>>>>;
