import type { BarrierKind, BuildingUse, GroundSurface, RoadMarkingKind, RoofShape, StreetPropKind, TerrainGrid, VenueKind } from "@seki/core";

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
  /**
   * A church with a tower of the map: in its tags, or a tower way in its outline or up to 10 m
   * from its walls, imported or not (G-212). The renderer adds no bell towers of its own to it.
   */
  readonly mappedTower?: true;
  /**
   * A tower of the map standing as a building of its own: `man_made=tower`, `tower:type`,
   * `building=tower|bell_tower` in its own tags (G-232). The renderer gives it a tower's facade
   * whatever its size, where a short one would pass for a tenement.
   */
  readonly tower?: true;
  /**
   * OSM `building:material` of its own element (G-244): `brick` (the Gothic keep and bastion,
   * the Trinity Chapel), `stone` or `plaster`. The renderer draws brick and stone walls bare.
   */
  readonly material?: "brick" | "stone" | "plaster";
  /** OSM `building:colour` of its own element as `#rrggbb` (G-244): the renderer's wall colour nearest it. */
  readonly colour?: string;
  /** Where the height came from: the `height` tag, `building:levels`, the district's defaults, GUGiK LoD1 2024, or the walls and roof from GUGiK LoD2 2017 (ADR-0077). */
  readonly source: "height" | "levels" | "default" | "lod1" | "lod2";
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
  /** A zebra's piece cut by the chunk's edge: its whole band, `[x0, z0, …]`, for the stripes to line up (G-958). */
  readonly zebra?: FlatPoints;
  /** The bridge's deck axis, `[x0, z0, x1, z1]`: the bridge way's ends, its abutments. */
  readonly deck?: FlatPoints;
  /** Laid by the import in a pedestrian street's frontage (G-853): drawn as any piece, not read by the furniture's placing. */
  readonly front?: true;
}

export interface LublinStreetData {
  readonly name: string;
  /** The OSM `highway` value. */
  readonly kind: string;
  /** World polyline, clipped to the chunk. */
  readonly line: FlatPoints;
  /**
   * How far its carriageway reaches left and right of `line` at each of its points, `[l0, r0, l1, r1…]`
   * (m; 0 off its asphalt), as the import widths it: what the traffic's lanes and the kerbs' cars read (ADR-0080).
   */
  readonly half?: FlatPoints;
  /** Driven one way only, the way the line runs (`oneway=-1` already turned round). */
  readonly oneway?: true;
  /** A passage under a building closed to motor vehicles in OSM: no lane, not even for deliveries (G-002). */
  readonly noVehicles?: true;
  /** A street the game closes to cars (a deptak of 2077, T-324): deliveries only, as a pedestrian street. */
  readonly carFree?: true;
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

/** A footway or a path mapped on its own (not a sidewalk, not a crossing): room kept clear of parked cars (G-143). */
export interface LublinFootWayData {
  /** World polyline, clipped to the chunk. */
  readonly line: FlatPoints;
  /** Its width (m). */
  readonly width: number;
}

/**
 * A flight of steps the map tags with `incline=up` or `down` (G-236): its way's whole polyline,
 * from its foot to its top, in every chunk it reaches into.
 */
export interface LublinFlightData {
  /** Its map id, to take a flight in several chunks once. */
  readonly id: string;
  /** World polyline, foot first, not clipped to the chunk. */
  readonly line: FlatPoints;
  /** Its mapped `step_count`, when it has one. */
  readonly steps?: number;
}

/** A straight run of a steps way with a `step_count` (G-840): `[x0, z0, x1, z1]` and its share of the way's steps. */
export interface LublinStepRunData {
  /** `<way>/<run>`, to take a run in several chunks once. */
  readonly id: string;
  readonly run: FlatPoints;
  readonly steps: number;
}

/**
 * A stretch of a way walked on foot the terrain makes too steep to walk (G-755): `<way>/<k>`,
 * its world polyline from its foot to its top, in every chunk it reaches into.
 */
export interface LublinSteepWayData {
  readonly id: string;
  readonly line: FlatPoints;
}

/** A car park mapped as an area (on the ground): the kerbs and yards where the map says cars park. */
export interface LublinCarParkData {
  /** Its map id; one reaching over a chunk's edge is in both chunks. */
  readonly id: string;
  /** Its `parking` kind: `street_side`, `lane`, `half_on_kerb`, `surface`… */
  readonly kind: string;
  /** Its bays' `orientation` when mapped: `parallel`, `perpendicular` or `diagonal` (G-177). */
  readonly orientation?: string;
  /** World outline. */
  readonly outline: FlatPoints;
  /** A surface car park's aisles (`service=parking_aisle`) in it, world polylines: the bays line up along them (T-352). */
  readonly aisles?: readonly FlatPoints[];
}

/**
 * A barrier of the map (ADR-0077 point 4): a wall, a retaining wall, the city walls, a fence or a
 * hedge as a line with its height over the ground, cut by the import where the map's ways cross
 * it, at its gates and clear of the buildings, carriageways and steps; a gate or a lift gate as
 * an opening, its span post to post, drawn without a solid.
 */
export interface LublinBarrierData {
  /** Its map id: `w<id>` a way, `n<id>` a gate node. */
  readonly id: string;
  readonly kind: BarrierKind;
  /** Over the ground (m). */
  readonly height: number;
  /** World polyline, clipped to the chunk; an opening's span. */
  readonly line: FlatPoints;
  /** OSM `material`, or a fence's `fence_type`. */
  readonly material?: string;
}

/**
 * A roof on posts of the map (`building=roof`, G-063): a slab from `soffit` to `height` over `y`
 * on the outline, carried by square steel posts; walked under. Its own list, not a building.
 */
export interface LublinCanopyData {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly y: number;
  readonly outline: FlatPoints;
  readonly parts: readonly FlatPoints[];
  readonly soffit: number;
  readonly height: number;
  readonly plinth: number;
  readonly look: number;
  readonly name?: string;
  /** The posts' centres relative to (x, z). */
  readonly posts: FlatPoints;
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
  /** Footways and paths mapped on their own, when it has any. */
  readonly footWays?: readonly LublinFootWayData[];
  /** Flights of steps with a mapped `incline` reaching into it, when it has any. */
  readonly flights?: readonly LublinFlightData[];
  /** The runs of the steps ways with a `step_count` reaching into it (G-840): the renderer lays their flights by it. */
  readonly stepRuns?: readonly LublinStepRunData[];
  /** Stretches of the ways walked on foot too steep on the terrain reaching into it (G-755), when it has any. */
  readonly steepWays?: readonly LublinSteepWayData[];
  /** Car parks reaching into it, when it has any. */
  readonly carParks?: readonly LublinCarParkData[];
  /** Bus stops' posts by it (and up to 25 m past its edge), when it has any: no car parks 15 m either side of one (G-156). */
  readonly busStops?: FlatPoints;
  /** Axes of the streets of two lanes or more a way, clipped to the chunk, when it has any: no car parks by their kerbs outside a car park (G-155). */
  readonly multiLaneWays?: readonly { readonly line: FlatPoints }[];
  /** Walls, fences, hedges and their gates (ADR-0077), when it has any. */
  readonly barriers?: readonly LublinBarrierData[];
  /** Roofs on posts (G-063), when it has any. */
  readonly canopies?: readonly LublinCanopyData[];
  /**
   * The big squares and footways' bands as laid before the ground became a partition (ADR-0078
   * step 3), the crowd's loops drawn round them, when it has any: `ground` has them cut by what lies on them.
   */
  readonly walkAreas?: readonly { readonly surface: "square" | "footway"; readonly outline: FlatPoints }[];
}

/**
 * Street furniture of the chunks (ADR-0047), as `pnpm osm:props` writes it: per chunk id, per
 * `StreetPropKind`, flat rows of x, y, z (world metres, y from the chunk's terrain), yaw
 * (radians from +z towards +x) and variant.
 */
export type LublinPropTable = Readonly<Record<string, Readonly<Partial<Record<StreetPropKind, readonly number[]>>>>>;

/**
 * A building site of the map (ADR-0087 stage 1), as `pnpm osm:props` writes it
 * (`tools/osm-import/src/construction-site.ts`): the set its area gives, the board's texts as
 * catalog keys (ADR-0056), the dig the terrain is shaped to and its pieces as rows of the prop
 * table's kinds (`site-fence`, `site-gate`, `site-board`, `site-cabin`).
 */
export interface LublinConstructionSiteData {
  /** OSM element of the outline: `w<id>`, `r<id>`; the generator's seed is FNV-1a of it. */
  readonly id: string;
  readonly seed: number;
  /** Up to 150 m² the fence alone, up to 600 m² a yard with containers and a dig, past it the full set. */
  readonly set: "fence" | "yard" | "full";
  /** The outline's area (m²). */
  readonly area: number;
  /** The outline (world metres, to the centimetre): the crane's jib reaches each of its corners (stage 2). */
  readonly outline: FlatPoints;
  /** The keys of the board's name, developer and term; null for a site with no gate. */
  readonly board: { readonly name: string; readonly developer: string; readonly term: string } | null;
  /** The dig: a counter-clockwise rectangle levelled to `y` (world), blending into the terrain over `blend` m round it. */
  readonly dig: { readonly outline: FlatPoints; readonly y: number; readonly blend: number } | null;
  /** Per kind, flat rows of x, y, z (world metres), yaw (radians) and variant (`sites.ts` of `@seki/core`). */
  readonly pieces: Readonly<Partial<Record<StreetPropKind, readonly number[]>>>;
}
