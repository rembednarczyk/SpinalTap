import { type EntityId, type TerrainGrid, type TerrainOpenSides, terrainHeightAt } from "@seki/core";
import type { Mesh } from "../../babylon";
import type { Box2, P2 } from "./polygon";

export interface TerrainEntry {
  readonly grid: TerrainGrid;
  /** Sides at the edge of the map data: an apron runs on from them (ADR-0044). */
  readonly open: TerrainOpenSides | undefined;
  readonly bounds: Box2;
  mesh: Mesh | null;
}

/** How far past its bounds a terrain still answers for the ground (m). */
const MARGIN = 0.01;
/** How far off an open side of its terrain a wall still lies on it (m): outlines are rounded to 0.1 m. */
const EDGE_TOLERANCE = 0.15;
/** How far past a terrain's side the next terrain is looked for (m). */
const EDGE_PROBE = 0.6;
/** Side of the bins the terrains are sorted into (m). */
const BIN = 64;

/** Key of a bin: a small integer, which a map finds fastest; bins 960 km apart may share one, told apart by the boxes. */
const key = (i: number, k: number): number => (i + 1.5e4) * 3e4 + k + 1.5e4;

/**
 * The chunks' terrains, in the order they were spawned, and the ground height from them. A city
 * holds a few dozen and the drape asks millions of points (G-444): each is looked up in the bins
 * its box touches instead of in every terrain. The bins keep the order, so a point on the edge
 * two chunks share takes the height of the first, as a walk through all of them would.
 */
export class TerrainEntries extends Map<EntityId, TerrainEntry> {
  private bins: Map<number, TerrainEntry[]> | null = null;

  override set(id: EntityId, t: TerrainEntry): this {
    this.bins = null;
    return super.set(id, t);
  }

  override delete(id: EntityId): boolean {
    this.bins = null;
    return super.delete(id);
  }

  override clear(): void {
    this.bins = null;
    super.clear();
  }

  /** Ground height at (x, z) from the first terrain there, or null outside every terrain. */
  heightAt(x: number, z: number): number | null {
    const bins = this.bins ?? this.sort();
    for (const t of bins.get(key(Math.floor(x / BIN), Math.floor(z / BIN))) ?? []) {
      const b = t.bounds;
      if (x >= b.minX - MARGIN && x <= b.maxX + MARGIN && z >= b.minZ - MARGIN && z <= b.maxZ + MARGIN) return terrainHeightAt(t.grid, x, z);
    }
    return null;
  }

  /**
   * Whether the segment a-c runs along a side of a terrain with no terrain past it: the edge of
   * the map data, where the importer cut a building (G-556). Read off the terrains present, not
   * their `open` sides, which only the preview's views carry.
   */
  onMapEdge(a: P2, c: P2): boolean {
    const along = (u: number, v: number, at: number) => Math.abs(u - at) <= EDGE_TOLERANCE && Math.abs(v - at) <= EDGE_TOLERANCE;
    const within = (u: number, v: number, lo: number, hi: number) => Math.min(u, v) >= lo - EDGE_TOLERANCE && Math.max(u, v) <= hi + EDGE_TOLERANCE;
    const [mx, mz] = [(a.x + c.x) / 2, (a.z + c.z) / 2];
    for (const { bounds: b } of [...this.values()]) {
      const acrossX = within(a.x, c.x, b.minX, b.maxX);
      const acrossZ = within(a.z, c.z, b.minZ, b.maxZ);
      const past =
        acrossX && along(a.z, c.z, b.minZ) ? { x: mx, z: b.minZ - EDGE_PROBE } :
        acrossX && along(a.z, c.z, b.maxZ) ? { x: mx, z: b.maxZ + EDGE_PROBE } :
        acrossZ && along(a.x, c.x, b.minX) ? { x: b.minX - EDGE_PROBE, z: mz } :
        acrossZ && along(a.x, c.x, b.maxX) ? { x: b.maxX + EDGE_PROBE, z: mz } : null;
      if (past && this.heightAt(past.x, past.z) === null) return true;
    }
    return false;
  }

  private sort(): Map<number, TerrainEntry[]> {
    const bins = new Map<number, TerrainEntry[]>();
    for (const t of this.values()) {
      const b = t.bounds;
      for (let i = Math.floor((b.minX - MARGIN) / BIN); i <= Math.floor((b.maxX + MARGIN) / BIN); i++) {
        for (let k = Math.floor((b.minZ - MARGIN) / BIN); k <= Math.floor((b.maxZ + MARGIN) / BIN); k++) {
          const bin = bins.get(key(i, k));
          if (bin) bin.push(t);
          else bins.set(key(i, k), [t]);
        }
      }
    }
    this.bins = bins;
    return bins;
  }
}
