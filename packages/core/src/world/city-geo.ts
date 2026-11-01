/**
 * Shared vocabulary of the city built from map data (ADR-0042): Lublin's centre from
 * OpenStreetMap and a terrain model, converted offline by `tools/osm-import` into content the
 * simulation and the renderer read. No network at runtime.
 */

/** A point on the ground plane in world metres: x east, z north. */
export interface GroundPoint {
  readonly x: number;
  readonly z: number;
}

/**
 * The geographic anchor of world coordinates (ADR-0042): world (0, 0) is this point, x grows
 * east and z north in metres, on a local tangent plane (equirectangular around the anchor; the
 * error stays under 0.1 % across the 2 km the game covers). `altitude` is the terrain height
 * mapped to world y = 0.
 */
export interface GeoAnchor {
  readonly lat: number;
  readonly lon: number;
  readonly altitude: number;
}

/** Plac Litewski, by the fountain: the middle of the game's Krakowskie Przedmieście. */
export const LUBLIN_ANCHOR: GeoAnchor = { lat: 51.24838, lon: 22.55964, altitude: 195.8 };

/** What a building is for: chooses its facade, its ground floor and its signs. */
export type BuildingUse = "residential" | "commercial" | "civic" | "church" | "historic" | "industrial" | "garage" | "other";

/**
 * Terrain heights on a regular grid (ADR-0042): `heights[row * cols + col]` is the ground
 * height in world metres at x = originX + col * cell, z = originZ + row * cell. Between the
 * points the height is interpolated bilinearly, the same way in the simulation and the
 * renderer, so feet and ground agree.
 */
export interface TerrainGrid {
  readonly originX: number;
  readonly originZ: number;
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
  readonly heights: readonly number[];
}

/** Ground height of `grid` at (x, z); clamped to the grid's edge outside it. */
export const terrainHeightAt = (grid: TerrainGrid, x: number, z: number): number => {
  const fx = Math.min(Math.max((x - grid.originX) / grid.cell, 0), grid.cols - 1);
  const fz = Math.min(Math.max((z - grid.originZ) / grid.cell, 0), grid.rows - 1);
  const c0 = Math.min(Math.floor(fx), grid.cols - 2 < 0 ? 0 : grid.cols - 2);
  const r0 = Math.min(Math.floor(fz), grid.rows - 2 < 0 ? 0 : grid.rows - 2);
  const c1 = Math.min(c0 + 1, grid.cols - 1);
  const r1 = Math.min(r0 + 1, grid.rows - 1);
  const tx = fx - c0;
  const tz = fz - r0;
  const h = (r: number, c: number) => grid.heights[r * grid.cols + c] ?? 0;
  const top = h(r0, c0) * (1 - tx) + h(r0, c1) * tx;
  const bottom = h(r1, c0) * (1 - tx) + h(r1, c1) * tx;
  return top * (1 - tz) + bottom * tz;
};

/** Which sides of a chunk's terrain are the edge of the map data. */
export interface TerrainOpenSides {
  readonly south: boolean;
  readonly north: boolean;
  readonly west: boolean;
  readonly east: boolean;
}

/** Ground surfaces drawn from map areas and ways (ADR-0042). */
/**
 * `basin`: a fountain's water inside its stone rim, standing above the square. `steps`: one
 * straight run of outdoor steps; its long side is the direction of the flight. `crossing`: a
 * zebra across a carriageway; its long side runs across the road, kerb to kerb.
 */
export type GroundSurface = "road" | "sidewalk" | "square" | "cobble" | "footway" | "steps" | "crossing" | "grass" | "water" | "basin" | "rail";

/**
 * Lift above the terrain per surface (m): order of drawing where they overlap. The carriageway
 * and what is painted on it (a few centimetres up: the drapes of the two differ that much on a
 * slope) lie over the squares' paving and the paths it crosses (a street
 * through Plac Łokietka, a park path meeting a road), under the raised sidewalks only. The
 * renderer drapes each surface this high; the simulation sets what stands on the paving (a
 * parked car, G-130) on the same height.
 */
export const SURFACE_LIFT: Readonly<Record<GroundSurface, number>> = {
  water: 0.03,
  grass: 0.04,
  steps: 0.05,
  square: 0.08,
  cobble: 0.08,
  footway: 0.09,
  road: 0.1,
  rail: 0.105,
  crossing: 0.13,
  sidewalk: 0.16,
  basin: 0.32,
};

/**
 * Road markings of the map city (ADR-0052), from the carriageways' lanes, direction and tags:
 * - `centre-dash`: the broken line between the two directions (P-1);
 * - `centre-double`: the double solid line between them on four lanes and more (P-4);
 * - `lane-dash`: the broken line between two lanes of one direction;
 * - `edge`: the solid line along the edge of a main road (P-7);
 * - `stop`: the stop line across the lanes before traffic lights (P-14);
 * - `cycle-lane`, `bus-lane`: a lane of its own along the kerb.
 */
export type RoadMarkingKind = "centre-dash" | "centre-double" | "lane-dash" | "edge" | "stop" | "cycle-lane" | "bus-lane";

/**
 * Street furniture of the map city (ADR-0047), from `docs/world/lublin-props.todo.json`: the
 * five Lublin lamp types, benches, bollards, trees, bins and the rest. Drawn in bulk per chunk.
 * The last four came with the street furniture of ADR-0058 stage 2: free-standing cash machines,
 * fire hydrants, food carts on the markets and shipping containers on the riverside. ADR-0058
 * stage 3 adds the market's stock beside the stalls (`market-goods`: cartons on a pallet, barrels,
 * crates, goods under a canvas) and the food booths in front of the fast-food venues (`food-stall`:
 * a yatai with its counter, stools, noren and lanterns). ADR-0058 stage 6 adds the decals, drawn
 * only (`decals.ts`): `graffiti` on walls without glass, `house-plate` with the map's house number,
 * `sticker` on a pole or a cabinet, `drain-grate` at the kerb.
 */
export type StreetPropKind =
  | "lamp-pastoral"
  | "lamp-wall-lantern"
  | "lamp-candelabra"
  | "lamp-modern-pole"
  | "lamp-road"
  | "lamp-park"
  | "floodlight"
  | "bench"
  | "bollard"
  | "tree"
  | "shrubs"
  | "planter"
  | "hanging-basket"
  | "waste-bin"
  | "bike-rack"
  | "bike-station"
  | "advertising-column"
  | "a-frame-sign"
  | "street-plate"
  | "street-cabinet"
  | "manhole"
  | "granite-block"
  | "flagpole"
  | "traffic-signal"
  | "bus-shelter"
  | "bus-stop"
  | "ticket-machine"
  | "vending-machine"
  | "kiosk"
  | "cafe-garden"
  | "market-stall"
  | "trolley-pole"
  | "fountain-jets"
  | "monument"
  | "artwork"
  | "cctv"
  | "atm"
  | "hydrant"
  | "food-cart"
  | "container"
  | "market-goods"
  | "food-stall"
  | "graffiti"
  | "house-plate"
  | "sticker"
  | "drain-grate";

/** One piece of street furniture, in world metres relative to its chunk entity's position. */
export interface StreetPropItem {
  readonly prop: StreetPropKind;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Facing around Y in radians (a bench's front, a lamp's arm). */
  readonly yaw: number;
  /**
   * Seed of the variation (species of tree, colour of a bin, which monument), up to 16 bits. For
   * a bollard its chains (G-032), 0 for none: bits 0-8 where the chain along its +x ends (cm from
   * its centre, at the next post's face or a lamp's shaft), bits 9-17 where a second chain ends
   * behind it, back to a lamp of its row (cm), bits 18-24 that chain's turn off its -x towards
   * +z (degrees + 64).
   */
  readonly variant: number;
}
