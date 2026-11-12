/**
 * Buildings whose height GUGiK LoD1 2024 does not bear out (ADR-0077 step 3): matched one to one
 * by footprint (IoU ≥ `LOD1_MIN_IOU`), not among the import's exceptions (`lod1Exempt`:
 * churches, towers, the listed landmarks, parts and what they crown, corrections by hand), with
 * the middle of the roof (`height + roof / 2`) over `LOD1_DIFF` metres off `measuredHeight`. A
 * building with its eaves and ridge from LoD2 (`source: "lod2"`, G-639) is off when LoD1 lies over
 * `LOD1_DIFF` outside them: LoD1's prism stands anywhere from the eaves to the ridge (Pałac
 * Parysów: eaves 10.7 m, ridge 18.2 m, LoD1 18.1 m). The import takes LoD1 for default and
 * `building:levels` heights, so what stays is a mapped `height` LoD1 disagrees with and a change
 * cut at `LOD1_MAX_CHANGE`.
 */
import { type Lod1Building, loadLod1, tilesOf } from "../../gugik/src/extracts.ts";
import { centroid, pointInRing, ringBounds } from "../../osm-import/src/geometry.ts";
import { isListedLandmark } from "../../osm-import/src/landmark-ids.ts";
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

type Finding = { readonly at: string; readonly what: string };

/** Each building `keep` takes (`crowned`: lifted parts stand on it) whose middle of the roof is over `LOD1_DIFF` off LoD1. */
const offLod1 = (buildings: readonly Building[], lod1: readonly Lod1Building[], keep: (b: Building, crowned: boolean) => boolean): Finding[] => {
  const index = lod1Index(lod1);
  const parts = buildings.filter((b) => b.soffit !== undefined).map((p) => centroid(worldRing(p)));
  return buildings.flatMap((b) => {
    const ring = worldRing(b);
    if (!keep(b, parts.some((p) => pointInRing(p, ring)))) return [];
    const m = lod1Match(index, ring);
    if (!m) return [];
    const at = `${b.x.toFixed(0)},${b.z.toFixed(0)}`;
    // Eaves and ridge measured in LoD2 (G-639): LoD1's prism may stand anywhere between them.
    if (b.source === "lod2") {
      const top = b.height + (b.roof ?? 0);
      if (m.lod1.height >= b.height - LOD1_DIFF && m.lod1.height <= top + LOD1_DIFF) return [];
      return [{ at, what: `${b.id} lod2: eaves ${b.height.toFixed(1)} m, ridge ${top.toFixed(1)} m, LoD1 ${m.lod1.height} m (IoU ${m.iou.toFixed(2)})` }];
    }
    const d = b.height + (b.roof ?? 0) / 2 - m.lod1.height;
    if (Math.abs(d) <= LOD1_DIFF) return [];
    return [{ at, what: `${b.id} ${b.source}: middle of the roof ${(b.height + (b.roof ?? 0) / 2).toFixed(1)} m, LoD1 ${m.lod1.height} m (IoU ${m.iou.toFixed(2)})` }];
  });
};

/**
 * Each building off its LoD1 height by more than `LOD1_DIFF`, among those the import's rule may
 * take. `isPart`: an orphan `building:part` standing as a building; a building is crowned by the
 * lifted parts (`soffit`) whose centroid it holds.
 */
export const heightsOffLod1 = (buildings: readonly Building[], lod1: readonly Lod1Building[], isPart: (id: string) => boolean): Finding[] =>
  offLod1(buildings, lod1, (b, crowned) => lod1Exempt(b, crowned || isPart(b.id)) === undefined);

/**
 * Each landmark of the list (`landmark-ids.ts`, its own outline, not a part lifted onto it) off its
 * LoD1 height by more than `LOD1_DIFF` (G-631): the import keeps the landmarks' heights as reviewed,
 * so a measured one the reviews missed shows here. Churches are measured on NMPT instead
 * (`church-over-nmpt`, T-122): LoD1's one prism averages their towers and naves.
 */
export const landmarksOffLod1 = (buildings: readonly Building[], lod1: readonly Lod1Building[]): Finding[] =>
  offLod1(buildings, lod1, (b) => b.soffit === undefined && b.use !== "church" && isListedLandmark(b.id));

/** A storey count of the map, `building:levels` (a fraction is a mezzanine or an attic within the walls, G-116). */
const tagStoreys = (v: string | undefined): number | null => {
  const n = v === undefined ? NaN : Math.max(...v.replace(/(\d),(\d)/g, "$1.$2").split(/[;,-]/).map(Number));
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
};

/**
 * Each building (not a lifted part) drawn with fewer rows of windows than its `building:levels`,
 * corrections included (G-629): storeys the map has, lost to a height that left no room for them.
 * A building crowned by lifted parts (centroid in its outline) counts the most storeys of it and
 * them: the outline's tag may count a tower standing on it (G-684, Brama Krakowska's five).
 */
export const levelsTagLost = (buildings: readonly (Building & { readonly levels: number })[], tagsOf: (id: string) => Readonly<Record<string, string>>): Finding[] => {
  const parts = buildings.filter((b) => b.soffit !== undefined).map((p) => ({ at: centroid(worldRing(p)), levels: p.levels }));
  return buildings.flatMap((b) => {
    const tagged = b.soffit === undefined ? tagStoreys(tagsOf(b.id)["building:levels"]) : null;
    if (tagged === null || b.levels >= tagged) return [];
    const ring = worldRing(b);
    if (parts.some((p) => p.levels >= tagged && pointInRing(p.at, ring))) return [];
    return [{ at: `${b.x.toFixed(0)},${b.z.toFixed(0)}`, what: `${b.id} ${b.source}: ${b.levels} storeys of building:levels=${tagsOf(b.id)["building:levels"]}` }];
  });
};
