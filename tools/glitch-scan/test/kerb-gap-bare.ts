import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import type { OsmData } from "../../osm-import/src/osm.ts";
import { cityLanduseWorld, flatRing, landuseBareAt } from "./landuse-bare";

/**
 * Bare terrain between a carriageway and its pavement (`kerb-gap-bare`, G-522, proposed in the
 * review of G-440): a point of a 0.25 m grid on no ground piece of the map's, outside buildings and
 * lawns, beds and water (drawn or not), at most `KERB_GAP` from a road's edge, with paving on the
 * same side, past it along the line from the road's nearest point, before `KERB_GAP` from that
 * point and with nothing else between. A strip wider than that, or one ending at a wall or a lawn,
 * is another kind of bare. A cell `landuse-bare` counts is left to it, so the coverage report holds
 * each bare place once. Each chunk is rasterised on its own, so the city takes a few seconds.
 */

type Pt = { readonly x: number; readonly z: number };
type Ring = readonly Pt[];
type Box = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
type Finding = { readonly at: string; readonly what: string };

/** The grid (m): samples at cells' middles, off the import's 0.1 m vertices and the chunks' seams. */
export const KERB_GRID = 0.25;
/** The widest gap between a road's edge and its pavement the check counts (m). */
export const KERB_GAP = 3;
/** The step along the line from the road out to the pavement (m), half a cell. */
const MARCH = KERB_GRID / 2;

export interface KerbWorld {
  /** The carriageways and car parks of the map (ground pieces `road`). */
  readonly roads: readonly Ring[];
  /** The map's paving a walker stands on: pavements, footways, squares, cobbles, steps, crossings. */
  readonly paving: readonly Ring[];
  /** Everything else that covers the ground: buildings, the other ground pieces, lawns and water of the map data. */
  readonly covered: readonly Ring[];
  readonly chunks: readonly Box[];
  /** A sample `landuse-bare` counts already. */
  readonly landuseBare?: (x: number, z: number) => boolean;
}

const ROAD = 1;
const PAVED = 2;
const COVERED = 4;

type Boxed = { readonly ring: Ring; readonly box: Box };
const boxed = (ring: Ring): Boxed => ({
  ring,
  box: {
    minX: Math.min(...ring.map((p) => p.x)),
    maxX: Math.max(...ring.map((p) => p.x)),
    minZ: Math.min(...ring.map((p) => p.z)),
    maxZ: Math.max(...ring.map((p) => p.z)),
  },
});
const meets = (a: Box, b: Box) => a.minX <= b.maxX && b.minX <= a.maxX && a.minZ <= b.maxZ && b.minZ <= a.maxZ;

/** A chunk's raster: what covers each sample, and the nearest point of a road's edge to the bare ones. */
class Raster {
  readonly x0: number;
  readonly z0: number;
  readonly nx: number;
  readonly nz: number;
  readonly cells: Uint8Array;
  readonly gap: Float32Array;
  readonly nearX: Float32Array;
  readonly nearZ: Float32Array;
  constructor(b: Box) {
    this.x0 = Math.floor(b.minX);
    this.z0 = Math.floor(b.minZ);
    this.nx = Math.ceil((b.maxX - this.x0) / KERB_GRID);
    this.nz = Math.ceil((b.maxZ - this.z0) / KERB_GRID);
    this.cells = new Uint8Array(this.nx * this.nz);
    this.gap = new Float32Array(this.nx * this.nz).fill(Infinity);
    this.nearX = new Float32Array(this.nx * this.nz);
    this.nearZ = new Float32Array(this.nx * this.nz);
  }
  x(i: number): number {
    return this.x0 + (i + 0.5) * KERB_GRID;
  }
  z(j: number): number {
    return this.z0 + (j + 0.5) * KERB_GRID;
  }
  at(x: number, z: number): number {
    const [i, j] = [Math.floor((x - this.x0) / KERB_GRID), Math.floor((z - this.z0) / KERB_GRID)];
    return i >= 0 && j >= 0 && i < this.nx && j < this.nz ? this.cells[j * this.nx + i]! : COVERED;
  }
  /** Marks the samples inside the ring (even-odd, a scanline per row). */
  fill(ring: Ring, bit: number): void {
    const zs = ring.map((p) => p.z);
    const j0 = Math.max(0, Math.ceil((Math.min(...zs) - this.z0) / KERB_GRID - 0.5));
    const j1 = Math.min(this.nz - 1, Math.floor((Math.max(...zs) - this.z0) / KERB_GRID - 0.5));
    for (let j = j0; j <= j1; j++) {
      const z = this.z(j);
      const xs: number[] = [];
      for (let k = 0, m = ring.length - 1; k < ring.length; m = k++) {
        const [a, b] = [ring[m]!, ring[k]!];
        if (a.z > z !== b.z > z) xs.push(a.x + ((z - a.z) * (b.x - a.x)) / (b.z - a.z));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.ceil((xs[k]! - this.x0) / KERB_GRID - 0.5));
        const i1 = Math.min(this.nx - 1, Math.floor((xs[k + 1]! - this.x0) / KERB_GRID - 0.5));
        for (let i = i0; i <= i1; i++) this.cells[j * this.nx + i]! |= bit;
      }
    }
  }
  /** Keeps, for each bare sample within `KERB_GAP` of the ring's edges, the nearest point on them. */
  nearest(ring: Ring): void {
    for (let k = 0, m = ring.length - 1; k < ring.length; m = k++) {
      const [a, b] = [ring[m]!, ring[k]!];
      const [dx, dz] = [b.x - a.x, b.z - a.z];
      const len2 = dx * dx + dz * dz || 1;
      const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - KERB_GAP - this.x0) / KERB_GRID));
      const i1 = Math.min(this.nx - 1, Math.ceil((Math.max(a.x, b.x) + KERB_GAP - this.x0) / KERB_GRID));
      const j0 = Math.max(0, Math.floor((Math.min(a.z, b.z) - KERB_GAP - this.z0) / KERB_GRID));
      const j1 = Math.min(this.nz - 1, Math.ceil((Math.max(a.z, b.z) + KERB_GAP - this.z0) / KERB_GRID));
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const c = j * this.nx + i;
          if (this.cells[c] !== 0) continue;
          const [x, z] = [this.x(i), this.z(j)];
          const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2));
          const [px, pz] = [a.x + dx * t, a.z + dz * t];
          const d = Math.hypot(x - px, z - pz);
          if (d < this.gap[c]!) [this.gap[c], this.nearX[c], this.nearZ[c]] = [d, px, pz];
        }
    }
  }
  /** Whether the line from the road's nearest point out through the sample reaches paving over bare ground only. */
  pavedPast(c: number, x: number, z: number): boolean {
    const d = this.gap[c]!;
    const [ux, uz] = [(x - this.nearX[c]!) / d, (z - this.nearZ[c]!) / d];
    // Back to the road: a cell of the road itself is the kerb's raster, anything else stands between.
    for (let t = -MARCH; t > -d; t -= MARCH) {
      const bits = this.at(x + ux * t, z + uz * t);
      if (bits !== 0 && bits !== (ROAD | COVERED)) return false;
    }
    for (let t = MARCH; t <= KERB_GAP - d; t += MARCH) {
      const bits = this.at(x + ux * t, z + uz * t);
      if (bits & PAVED) return true;
      if (bits !== 0) return false;
    }
    return false;
  }
}

const inChunk = (c: Box, x: number, z: number) => x >= c.minX && x < c.maxX && z >= c.minZ && z < c.maxZ;

/** The bare samples between the world's carriageways and pavements: one finding per point, at its metre. */
export const kerbGapBare = (w: KerbWorld): Finding[] => {
  const [roads, paving, covered] = [w.roads.map(boxed), w.paving.map(boxed), w.covered.map(boxed)];
  const out: Finding[] = [];
  for (const chunk of w.chunks) {
    const reach = 2 * KERB_GAP;
    const box = { minX: chunk.minX - reach, maxX: chunk.maxX + reach, minZ: chunk.minZ - reach, maxZ: chunk.maxZ + reach };
    const near = (rs: readonly Boxed[]) => rs.filter((r) => meets(r.box, box));
    const grid = new Raster(box);
    const chunkRoads = near(roads);
    for (const r of chunkRoads) grid.fill(r.ring, ROAD | COVERED);
    for (const r of near(paving)) grid.fill(r.ring, PAVED | COVERED);
    for (const r of near(covered)) grid.fill(r.ring, COVERED);
    for (const r of chunkRoads) grid.nearest(r.ring);
    for (let j = 0; j < grid.nz; j++)
      for (let i = 0; i < grid.nx; i++) {
        const c = j * grid.nx + i;
        const [x, z] = [grid.x(i), grid.z(j)];
        if (grid.cells[c] !== 0 || !(grid.gap[c]! <= KERB_GAP) || grid.gap[c]! < 1e-6 || !inChunk(chunk, x, z)) continue;
        if (w.landuseBare?.(x, z) || !grid.pavedPast(c, x, z)) continue;
        out.push({ at: `${x.toFixed(0)},${z.toFixed(0)}`, what: `kerb gap ${x.toFixed(2)},${z.toFixed(2)}, ${grid.gap[c]!.toFixed(2)} m off the road` });
      }
  }
  return out;
};

const PAVING = new Set(["sidewalk", "footway", "square", "cobble", "steps", "crossing"]);

/** The city's world: the game's ground pieces and buildings, the map data's lawns and water, `landuse-bare`'s cells. */
export const cityKerbWorld = (osm: OsmData): KerbWorld => {
  const landuse = cityLanduseWorld(osm);
  const ground = MAP_CHUNKS.flatMap((c) => c.ground);
  const of = (keep: (s: string) => boolean) => ground.filter((g) => keep(g.surface)).map((g) => flatRing(g.outline));
  return {
    roads: of((s) => s === "road"),
    paving: of((s) => PAVING.has(s)),
    covered: [...of((s) => s !== "road" && !PAVING.has(s)), ...landuse.buildings, ...landuse.green],
    chunks: landuse.chunks,
    landuseBare: landuseBareAt(landuse),
  };
};
