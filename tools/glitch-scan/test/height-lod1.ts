/**
 * Buildings whose height GUGiK LoD1 2024 does not bear out (ADR-0077 step 3): matched one to one
 * by footprint (IoU ≥ `LOD1_MIN_IOU`), not among the import's exceptions (`lod1Exempt`:
 * churches, historic buildings, towers, parts and what they crown, corrections by hand), with
 * the middle of the roof (`height + roof / 2`) over `LOD1_DIFF` metres off `measuredHeight`. The
 * import takes LoD1 for default and `building:levels` heights, so what stays is a mapped
 * `height` LoD1 disagrees with and a change cut at `LOD1_MAX_CHANGE`.
 */
import { type Lod1Building, loadLod1, tilesOf } from "../../gugik/src/extracts.ts";
import { centroid, pointInRing, ringBounds } from "../../osm-import/src/geometry.ts";
import { lod1Exempt, lod1Index, lod1Match, worldRing } from "../../osm-import/src/lod1-heights.ts";

/** A difference worth a look, metres (the GUGiK report's `BIG_DIFF`). */
export const LOD1_DIFF = 3;

interface Building {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly outline: readonly number[];
  readonly height: number;
  readonly roof?: number;
  readonly use: string;
  readonly source: string;
  readonly soffit?: number;
  readonly tower?: true;
  readonly mappedTower?: true;
}

/** The LoD1 buildings of the tiles under the buildings, 50 m round them. */
export const lod1Under = (buildings: readonly Building[]): Lod1Building[] => {
  const rings = buildings.map(worldRing).filter((r) => r.length >= 3);
  const b = ringBounds(rings.flat());
  return loadLod1(tilesOf({ minX: b.minX - 50, minZ: b.minZ - 50, maxX: b.maxX + 50, maxZ: b.maxZ + 50 }));
};

/**
 * Each building off its LoD1 height by more than `LOD1_DIFF`. `isPart`: an orphan `building:part`
 * standing as a building; a building is crowned by the lifted parts (`soffit`) whose centroid it holds.
 */
export const heightsOffLod1 = (buildings: readonly Building[], lod1: readonly Lod1Building[], isPart: (id: string) => boolean): { readonly at: string; readonly what: string }[] => {
  const index = lod1Index(lod1);
  const parts = buildings.filter((b) => b.soffit !== undefined).map((p) => centroid(worldRing(p)));
  return buildings.flatMap((b) => {
    const ring = worldRing(b);
    const crowned = isPart(b.id) || parts.some((p) => pointInRing(p, ring));
    if (lod1Exempt(b, crowned) !== undefined) return [];
    const m = lod1Match(index, ring);
    if (!m) return [];
    const d = b.height + (b.roof ?? 0) / 2 - m.lod1.height;
    if (Math.abs(d) <= LOD1_DIFF) return [];
    return [{ at: `${b.x.toFixed(0)},${b.z.toFixed(0)}`, what: `${b.id} ${b.source}: middle of the roof ${(b.height + (b.roof ?? 0) / 2).toFixed(1)} m, LoD1 ${m.lod1.height} m (IoU ${m.iou.toFixed(2)})` }];
  });
};
