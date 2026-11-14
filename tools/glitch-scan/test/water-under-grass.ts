import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { extractFeatures } from "../../osm-import/src/features.ts";
import { areaSurface } from "../../osm-import/src/ground.ts";
import type { OsmData } from "../../osm-import/src/osm.ts";
import { flatRing } from "./landuse-bare";

/**
 * `water-under-grass` (T-295): a point of a 0.5 m grid in the map data's water (a river's, a
 * pond's area) that the import's ground lays as grass: the Bystrzyca by Nabrzeże, some 1 440 m² of
 * whose water a lawn of the import covers. A finding is a sample, `STEP`² of water; the keys are
 * the 10 m squares (`SAMPLED_KINDS`).
 */

type Pt = { readonly x: number; readonly z: number };
type Ring = readonly Pt[];
type Box = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
type Finding = { readonly at: string; readonly what: string };

/** The grid (m): a sample is the middle of a cell, off the import's 0.1 m vertices. */
export const STEP = 0.5;

export interface WaterWorld {
  /** The map data's water areas. */
  readonly water: readonly Ring[];
  /** The import's grass pieces (off the bridges). */
  readonly grass: readonly Ring[];
  readonly chunks: readonly Box[];
}

const boxOf = (ring: Ring): Box => ({
  minX: Math.min(...ring.map((p) => p.x)),
  maxX: Math.max(...ring.map((p) => p.x)),
  minZ: Math.min(...ring.map((p) => p.z)),
  maxZ: Math.max(...ring.map((p) => p.z)),
});
const meets = (a: Box, b: Box) => a.minX <= b.maxX && b.minX <= a.maxX && a.minZ <= b.maxZ && b.minZ <= a.maxZ;
const inBox = (p: Pt, b: Box) => p.x >= b.minX && p.x < b.maxX && p.z >= b.minZ && p.z < b.maxZ;
const inRing = (p: Pt, ring: Ring): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = [ring[i]!, ring[j]!];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};

/** Every sample of the grid in a water area of the map, on a chunk, that a grass piece of the import covers. */
export const waterUnderGrass = (w: WaterWorld): Finding[] => {
  const grass = w.grass.map((ring) => ({ ring, box: boxOf(ring) }));
  const out: Finding[] = [];
  const seen = new Set<string>();
  for (const ring of w.water) {
    const box = boxOf(ring);
    // Lawn by lawn over the part of its box in the water's: a river's box is a district's, its lawns small.
    for (const g of grass) {
      if (!meets(g.box, box)) continue;
      const [x0, x1, z0, z1] = [Math.max(box.minX, g.box.minX), Math.min(box.maxX, g.box.maxX), Math.max(box.minZ, g.box.minZ), Math.min(box.maxZ, g.box.maxZ)];
      for (let i = Math.floor(x0 / STEP); i * STEP <= x1; i++)
        for (let k = Math.floor(z0 / STEP); k * STEP <= z1; k++) {
          const p = { x: (i + 0.5) * STEP, z: (k + 0.5) * STEP };
          const key = `${i},${k}`;
          if (seen.has(key) || !inRing(p, g.ring) || !inRing(p, ring) || !w.chunks.some((c) => inBox(p, c))) continue;
          seen.add(key);
          out.push({ at: `${p.x.toFixed(0)},${p.z.toFixed(0)}`, what: `water under grass ${p.x.toFixed(2)},${p.z.toFixed(2)}` });
        }
    }
  }
  return out;
};

/** The city's water world: the map data's water areas and the generated chunks' grass. */
export const cityWaterWorld = (osm: OsmData): WaterWorld => ({
  water: extractFeatures(osm).areas.filter((a) => areaSurface(a.tags) === "water").map((a) => a.ring),
  grass: MAP_CHUNKS.flatMap((c) => c.ground.filter((g) => g.surface === "grass" && !g.bridge).map((g) => flatRing(g.outline))),
  chunks: MAP_CHUNKS.map((c) => c.bounds),
});
