import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { extractFeatures } from "../../osm-import/src/features.ts";
import { areaSurface } from "../../osm-import/src/ground.ts";
import type { OsmData, Tags } from "../../osm-import/src/osm.ts";
import { geoToWorld } from "../../osm-import/src/project.ts";
import { raisedGreen } from "../../osm-import/src/raised-green.ts";

/**
 * Bare terrain where a town has paving (`landuse-bare`, decision 5.11 on the bare strips of S4):
 * a point of a 0.5 m grid with no ground piece of the map's on it, in an area of
 * `landuse=retail|commercial`, a market, a bus station or a platform of the map (a platform's roof
 * is not drawn, T-025), within `NEAR` of a shop's or a public building's walls (a stop's shelter
 * among them) or within `STOP_REACH` of a stop. Points in a building, and in the map's lawns, beds
 * and water (drawn or not), are left out: a bed bare of paving is the photograph's, not a glitch.
 * A lawn mapped above the ground (`layer` > 0 or on a roof, G-664) is not: the ground under a
 * roof's green is no bed of the map's, and only the lawn's pieces drawn on the ground cover it.
 * The grid is rasterised once for the whole city, so the scan stays well under a second.
 */

type Pt = { readonly x: number; readonly z: number };
type Ring = readonly Pt[];
type Box = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
type Finding = { readonly at: string; readonly what: string };

/** The scan's grid (m): a sample is the middle of a cell, so none lands on the import's 0.1 m vertices. */
export const BARE_GRID = 0.5;
/** How far off a shop's or a public building's walls its forecourt reaches (m). */
export const NEAR = 5;
/** How far round a bus or tram stop of the map its platform reaches (m). */
export const STOP_REACH = 10;

export interface LanduseWorld {
  /** Where a town has paving: the map's areas, and the shops' and public buildings' outlines with their forecourts. */
  readonly landuse: readonly Ring[];
  readonly shops: readonly Ring[];
  /** The map's stops (points): a platform round each. */
  readonly stops: readonly Pt[];
  /** Every building's outline: no ground in it. */
  readonly buildings: readonly Ring[];
  /** The map's ground pieces, any surface. */
  readonly ground: readonly Ring[];
  /** Lawns, beds and water of the map, drawn or not. */
  readonly green: readonly Ring[];
  /** The map's chunks: off them is not the game's ground. */
  readonly chunks: readonly Box[];
}

const IN_REGION = 1;
const COVERED = 2;

const boxOf = (rings: readonly Ring[], grow: number): Box => {
  const pts = rings.flat();
  return {
    minX: Math.min(...pts.map((p) => p.x)) - grow,
    maxX: Math.max(...pts.map((p) => p.x)) + grow,
    minZ: Math.min(...pts.map((p) => p.z)) - grow,
    maxZ: Math.max(...pts.map((p) => p.z)) + grow,
  };
};

/** A raster of cells over a box, each sample at its cell's middle. */
class Grid {
  readonly x0: number;
  readonly z0: number;
  readonly nx: number;
  readonly nz: number;
  readonly cells: Uint8Array;
  constructor(b: Box) {
    this.x0 = Math.floor(b.minX);
    this.z0 = Math.floor(b.minZ);
    this.nx = Math.max(0, Math.ceil((b.maxX - this.x0) / BARE_GRID));
    this.nz = Math.max(0, Math.ceil((b.maxZ - this.z0) / BARE_GRID));
    this.cells = new Uint8Array(this.nx * this.nz);
  }
  x(i: number): number {
    return this.x0 + (i + 0.5) * BARE_GRID;
  }
  z(j: number): number {
    return this.z0 + (j + 0.5) * BARE_GRID;
  }
  /** Marks the samples inside the ring (even-odd, a scanline per row). */
  fill(ring: Ring, bit: number): void {
    const zs = ring.map((p) => p.z);
    const j0 = Math.max(0, Math.ceil((Math.min(...zs) - this.z0) / BARE_GRID - 0.5));
    const j1 = Math.min(this.nz - 1, Math.floor((Math.max(...zs) - this.z0) / BARE_GRID - 0.5));
    for (let j = j0; j <= j1; j++) {
      const z = this.z(j);
      const xs: number[] = [];
      for (let k = 0, m = ring.length - 1; k < ring.length; m = k++) {
        const a = ring[m]!;
        const b = ring[k]!;
        if (a.z > z !== b.z > z) xs.push(a.x + ((z - a.z) * (b.x - a.x)) / (b.z - a.z));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.ceil((xs[k]! - this.x0) / BARE_GRID - 0.5));
        const i1 = Math.min(this.nx - 1, Math.floor((xs[k + 1]! - this.x0) / BARE_GRID - 0.5));
        for (let i = i0; i <= i1; i++) this.cells[j * this.nx + i]! |= bit;
      }
    }
  }
  /** Marks the samples within `d` of the ring's edges, an edge at a time. */
  around(ring: Ring, d: number, bit: number): void {
    for (let k = 0, m = ring.length - 1; k < ring.length; m = k++) {
      const a = ring[m]!;
      const b = ring[k]!;
      const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - d - this.x0) / BARE_GRID));
      const i1 = Math.min(this.nx - 1, Math.ceil((Math.max(a.x, b.x) + d - this.x0) / BARE_GRID));
      const j0 = Math.max(0, Math.floor((Math.min(a.z, b.z) - d - this.z0) / BARE_GRID));
      const j1 = Math.min(this.nz - 1, Math.ceil((Math.max(a.z, b.z) + d - this.z0) / BARE_GRID));
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) if (segmentGap(a, b, this.x(i), this.z(j)) <= d) this.cells[j * this.nx + i]! |= bit;
    }
  }
}

const segmentGap = (a: Pt, b: Pt, x: number, z: number): number => {
  const [dx, dz] = [b.x - a.x, b.z - a.z];
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(a.x + dx * t - x, a.z + dz * t - z);
};

/** The world's raster: where a town has paving, and what covers it. */
const landuseGrid = (w: LanduseWorld): Grid | undefined => {
  if (w.landuse.length + w.shops.length + w.stops.length === 0) return undefined;
  const grid = new Grid(boxOf([...w.landuse, ...w.shops, ...w.stops.map((p) => [p])], STOP_REACH));
  for (const r of w.landuse) grid.fill(r, IN_REGION);
  for (const r of w.shops) {
    grid.fill(r, IN_REGION);
    grid.around(r, NEAR, IN_REGION);
  }
  for (const p of w.stops) grid.around([p], STOP_REACH, IN_REGION);
  for (const r of [...w.buildings, ...w.ground, ...w.green]) grid.fill(r, COVERED);
  return grid;
};

/**
 * Whether the 0.5 m cell holding (x, z) is bare in a town's paved area: another check of bare
 * ground leaves such a cell to `landuse-bare`, so the coverage report does not count it twice.
 */
export const landuseBareAt = (w: LanduseWorld): ((x: number, z: number) => boolean) => {
  const grid = landuseGrid(w);
  if (!grid) return () => false;
  return (x, z) => {
    const [i, j] = [Math.floor((x - grid.x0) / BARE_GRID), Math.floor((z - grid.z0) / BARE_GRID)];
    return i >= 0 && j >= 0 && i < grid.nx && j < grid.nz && grid.cells[j * grid.nx + i] === IN_REGION;
  };
};

/** The bare samples of a world: one finding per point, at its metre. */
export const landuseBare = (w: LanduseWorld): Finding[] => {
  const grid = landuseGrid(w);
  if (!grid) return [];
  const onChunk = (x: number, z: number) => w.chunks.some((c) => x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ);
  const out: Finding[] = [];
  for (let j = 0; j < grid.nz; j++)
    for (let i = 0; i < grid.nx; i++) {
      if (grid.cells[j * grid.nx + i] !== IN_REGION) continue;
      const [x, z] = [grid.x(i), grid.z(j)];
      if (onChunk(x, z)) out.push({ at: `${x.toFixed(0)},${z.toFixed(0)}`, what: `bare ${x.toFixed(2)},${z.toFixed(2)}` });
    }
  return out;
};

export const flatRing = (flat: readonly number[], ox = 0, oz = 0): Pt[] => {
  const ring: Pt[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) ring.push({ x: flat[i]! + ox, z: flat[i + 1]! + oz });
  return ring;
};

const LANDUSE = new Set(["retail", "commercial"]);
const PUBLIC_AMENITY = new Set(["marketplace", "bus_station"]);
const SHOP_USE = new Set(["commercial", "civic"]);
const GREEN = new Set(["grass", "water", "basin"]);

/** A town's paved area of the map: shops' and offices' land, a market, a bus station and its platforms (their roofs are not drawn). */
const paved = (t: Tags): boolean => LANDUSE.has(t.landuse ?? "") || PUBLIC_AMENITY.has(t.amenity ?? "") || t.public_transport === "platform" || t.public_transport === "station";
/** A public transport stop's shelter: a public building, though the game reads a shelter as a shed. */
const stopShelter = (t: Tags): boolean => t.shelter_type === "public_transport" || t.public_transport !== undefined;

/** The city's world: the map data's areas, the game's buildings and ground pieces. */
export const cityLanduseWorld = (osm: OsmData): LanduseWorld => {
  const areas = extractFeatures(osm).areas;
  const buildings = MAP_CHUNKS.flatMap((c) => c.buildings);
  const tagsOf = (id: string) => (id.startsWith("w") ? osm.ways.get(Number(id.split("/")[0]!.slice(1)))?.tags : undefined) ?? {};
  return {
    landuse: areas.filter((a) => paved(a.tags)).map((a) => a.ring),
    shops: buildings.filter((b) => SHOP_USE.has(b.use) || stopShelter(tagsOf(b.id))).map((b) => flatRing(b.outline, b.x, b.z)),
    stops: [...osm.nodes.values()].filter((n) => n.tags?.highway === "bus_stop" || n.tags?.railway === "tram_stop" || n.tags?.public_transport === "platform").map((n) => geoToWorld(n.lat, n.lon)),
    buildings: buildings.map((b) => flatRing(b.outline, b.x, b.z)),
    ground: MAP_CHUNKS.flatMap((c) => c.ground.map((g) => flatRing(g.outline))),
    green: areas.filter((a) => GREEN.has(areaSurface(a.tags) ?? "") && !raisedGreen(a.tags)).map((a) => a.ring),
    chunks: MAP_CHUNKS.map((c) => c.bounds),
  };
};
