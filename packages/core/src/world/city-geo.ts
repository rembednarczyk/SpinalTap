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
export const LUBLIN_ANCHOR: GeoAnchor = { lat: 51.24838, lon: 22.55964, altitude: 198 };

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

/** Ground surfaces drawn from map areas and ways (ADR-0042). */
export type GroundSurface = "road" | "sidewalk" | "square" | "cobble" | "footway" | "grass" | "water" | "rail";
