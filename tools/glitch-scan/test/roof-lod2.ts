/**
 * Buildings drawn flat whose GUGiK LoD2 roof (ALS 2011) is steep (G-639, ADR-0077 step 4): matched one
 * to one by footprint (IoU ≥ `LOD1_MIN_IOU`), not among the import's exceptions (`lod1Exempt`),
 * LoD2's main roof (`mainRoof` in `tools/gugik/src/citygml.ts`) rising over `LOD2_MIN_ROOF` and
 * the game's eaves over `ROOF_DIFF` above LoD2's main eaves: a flat block at the height of the
 * ridge, its walls and storeys too tall. What stays: mapped heights and `roof:*` tags LoD2
 * disagrees with, and buildings LoD1 2024 says have changed since 2011.
 */
import { type Lod2Building, loadLod2, tilesOf } from "../../gugik/src/extracts.ts";
import { centroid, pointInRing, ringBounds } from "../../osm-import/src/geometry.ts";
import { lod1Exempt, worldRing } from "../../osm-import/src/lod1-heights.ts";
import { lineAngle, longAxisDegrees } from "../../osm-import/src/long-axis.ts";
import { LOD2_MIN_ROOF, RIDGED_SHAPES, lod2Index, lod2Match } from "../../osm-import/src/lod2-roofs.ts";
import type { RoofShape } from "../../../packages/core/src/ports/types.ts";

/** How far over LoD2's eaves the game's flat top may stand, metres (`LOD1_DIFF`). */
export const ROOF_DIFF = 3;

interface Building {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly outline: readonly number[];
  readonly height: number;
  readonly roof?: number;
  readonly roofShape?: string;
  readonly roofAcross?: true;
  readonly plinth?: number;
  readonly use: string;
  readonly source: string;
  readonly soffit?: number;
  readonly tower?: true;
  readonly mappedTower?: true;
}

/** The LoD2 buildings of the tiles under the buildings, 50 m round them. */
export const lod2Under = (buildings: readonly Building[]): Lod2Building[] => {
  const b = ringBounds(buildings.map(worldRing).flat());
  return loadLod2(tilesOf({ minX: b.minX - 50, minZ: b.minZ - 50, maxX: b.maxX + 50, maxZ: b.maxZ + 50 }));
};

/** A roof the renderer draws flat (`roofKindFor` in the engine's `facade-style.ts`). */
const drawnFlat = (b: Building) => !b.roof || b.roof <= 0.3 || b.roofShape === "flat";

/**
 * Each flat building with a steep LoD2 roof and its top over `ROOF_DIFF` above LoD2's main eaves.
 * `isPart`: an orphan `building:part` standing as a building; a building is crowned by the lifted
 * parts (`soffit`) whose centroid it holds.
 */
export const flatOverLod2Roof = (buildings: readonly Building[], lod2: readonly Lod2Building[], isPart: (id: string) => boolean): { readonly at: string; readonly what: string }[] => {
  const index = lod2Index(lod2);
  const parts = buildings.filter((b) => b.soffit !== undefined).map((p) => centroid(worldRing(p)));
  return buildings.flatMap((b) => {
    if (!drawnFlat(b)) return [];
    const ring = worldRing(b);
    if (lod1Exempt(b, isPart(b.id) || parts.some((p) => pointInRing(p, ring))) !== undefined) return [];
    const m = lod2Match(index, ring);
    const eaves = m?.lod2.mainEaves;
    const ridge = m?.lod2.mainRidge;
    if (eaves === undefined || ridge === undefined || ridge - eaves <= LOD2_MIN_ROOF || b.height <= eaves + ROOF_DIFF) return [];
    return [{ at: `${b.x.toFixed(0)},${b.z.toFixed(0)}`, what: `${b.id} ${b.source}: flat at ${b.height.toFixed(1)} m, LoD2 eaves ${eaves} m, ridge ${ridge} m (IoU ${m!.iou.toFixed(2)})` }];
  });
};

type Finding = { readonly at: string; readonly what: string };
const at = (b: Building) => `${b.x.toFixed(0)},${b.z.toFixed(0)}`;

/**
 * Each building with its roof from LoD2 (`source: "lod2"`) of a shape with a ridge (gabled,
 * half-hipped, mansard, skillion) whose drawn ridge (the outline's long axis, or its short one
 * with `roofAcross`) lies over 45° off LoD2's main ridge (G-639: Złota 3 at 86°).
 */
export const lod2RidgeAcross = (buildings: readonly Building[], lod2: readonly Lod2Building[]): Finding[] => {
  const index = lod2Index(lod2);
  return buildings.flatMap((b) => {
    if (b.source !== "lod2" || !RIDGED_SHAPES.has(b.roofShape as RoofShape)) return [];
    const ring = worldRing(b);
    const dir = lod2Match(index, ring)?.lod2.ridgeDir;
    if (dir === undefined) return [];
    const drawn = longAxisDegrees(ring) + (b.roofAcross ? 90 : 0);
    const off = lineAngle(drawn, dir);
    return off > 45 ? [{ at: at(b), what: `${b.id} ${b.roofShape}: ridge ${off.toFixed(0)}° off LoD2's` }] : [];
  });
};

/**
 * Each building the LoD2 roof rule may take (not among `lod1Exempt`, no mapped `height`, no
 * `roof:*` tag, the main roof rising over `LOD2_MIN_ROOF`) whose main shell's lowest point is a
 * sliver over 1 m under the main eaves (`shellEaves`), and which does not stand at the main
 * eaves: flat, or at the sliver's (G-639: Złota 5, eaves 11.3 m from 3.1 m², 13.0 m from its slopes).
 */
export const lod2SliverEaves = (buildings: readonly Building[], lod2: readonly Lod2Building[], isPart: (id: string) => boolean, roofTagged: (id: string) => boolean): Finding[] => {
  const index = lod2Index(lod2);
  const parts = buildings.filter((b) => b.soffit !== undefined).map((p) => centroid(worldRing(p)));
  return buildings.flatMap((b) => {
    if (b.source === "height" || roofTagged(b.id)) return [];
    const ring = worldRing(b);
    if (lod1Exempt(b, isPart(b.id) || parts.some((p) => pointInRing(p, ring))) !== undefined) return [];
    const l = lod2Match(index, ring)?.lod2;
    if (!l || l.shellEaves === undefined || l.mainEaves === undefined || l.mainRidge === undefined) return [];
    if (l.mainEaves - l.shellEaves <= 1 || l.mainRidge - l.mainEaves <= LOD2_MIN_ROOF) return [];
    const floor = (b.plinth ?? 0) + 3.2;
    if (b.source === "lod2" && (Math.abs(b.height - l.mainEaves) <= 1 || (floor > l.mainEaves && Math.abs(b.height - floor) <= 0.1))) return [];
    return [{ at: at(b), what: `${b.id} ${b.source}: at ${b.height.toFixed(1)} m, LoD2 eaves ${l.mainEaves} m, sliver ${l.shellEaves} m` }];
  });
};
