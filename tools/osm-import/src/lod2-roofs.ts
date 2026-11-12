/**
 * Roofs from GUGiK LoD2, roofs from the 2011 ALS scan (`aktZrodla`; ADR-0077 step 4, G-639). A building the map gives no roof stood flat
 * at its LoD1 height, which under a steep roof lies near the ridge: Pałac Parysów w66330695 at
 * 18.1 m and five rows of windows, its LoD2 eaves at 10.7 m and ridge at 18.2 m.
 *
 * The mapping follows CityGML LoD2 and OSM Simple 3D Buildings: the walls go up to the eaves
 * (`height`), the roof from the eaves to the ridge (`roof`, `roofShape`), the storeys
 * (`building:levels`) count to the eaves. Eaves and ridge are those of the main mass
 * (`mainRoof` in `tools/gugik/src/citygml.ts`): the roof shell joined to its largest surface, so
 * a low annex's or a porch's roof does not set the eaves (Teatr Osterwy 5.3 m, Lublinianka 4.3 m,
 * T-257). The shape is LoD2's `roofType` where the renderer draws it, a gabled, half-hipped,
 * mansard or skillion roof turned across the outline (`roofAcross`) where LoD2's ridge runs nearer
 * its short axis; a combination of shapes
 * (`1130`, most of the old town) and the rest take a hipped roof, which the renderer lays over any
 * outline.
 *
 * Only for a building LoD1's rule may take (`lod1Exempt`: not a church, a tower, a landmark of the
 * list, a part or what parts crown, a correction by hand or an area added by hand), whose height
 * is not a mapped `height`, with no `roof:*` tag of its own, matched one to one by footprint (IoU ≥
 * `LOD1_MIN_IOU`) with a LoD2 building whose main roof rises over `LOD2_MIN_ROOF`. LoD2's roofs are of 2011
 * and LoD1 of 2024: where LoD1 lies over `LOD2_LOD1_SLACK` outside LoD2's eaves to ridge, the
 * building has changed since and keeps LoD1's height; so does one whose `building:levels` do not
 * fit under LoD2's eaves (kamienica Złota 5: five storeys, eaves at 11.3 m).
 */
import type { RoofShape } from "../../../packages/core/src/ports/types.ts";
import { type Lod2Building } from "../../gugik/src/extracts.ts";
import { BoxIndex, type Footprint, footprint, iou } from "../../gugik/src/overlap.ts";
import { STOREY } from "./building-tags.ts";
import { type Pt, r1 } from "./geometry.ts";
import { LOD1_MIN_IOU, MIN_STOREY, lod1Exempt, lod1Match, type lod1Index, storeysOf, worldRing } from "./lod1-heights.ts";
import { lineAngle, longAxisDegrees } from "./long-axis.ts";
import { type BuildingOut } from "./model.ts";

/** The least rise of LoD2's main roof, eaves to ridge, for the building to take it, metres. */
export const LOD2_MIN_ROOF = 4;
/** How far LoD1 2024 may lie outside LoD2's eaves to ridge for the roof to stand, metres. */
export const LOD2_LOD1_SLACK = 3;

/** LoD2 `roofType` codes (SIG3D, `ROOF_TYPES` in `citygml.ts`) to the renderer's shapes; others hipped, flat (1000) none. */
const LOD2_SHAPES: Readonly<Record<number, RoofShape>> = {
  1010: "skillion",
  1020: "gabled",
  1030: "gabled",
  1040: "hipped",
  1050: "half-hipped",
  1060: "mansard",
  1070: "pyramidal",
  1080: "pyramidal",
  1090: "dome",
  1120: "pyramidal",
};

/** The renderer's shape for a LoD2 roof type; undefined for a flat one. */
export const lod2Shape = (roofType: number | undefined): RoofShape | undefined => (roofType === 1000 ? undefined : (LOD2_SHAPES[roofType ?? -1] ?? "hipped"));

type Indexed = Footprint & { readonly lod2: Lod2Building };

/** LoD2 buildings with a roof, indexed for the footprint match. */
export const lod2Index = (lod2: readonly Lod2Building[]): BoxIndex<Indexed> =>
  new BoxIndex(lod2.filter((b) => b.ring.length >= 3 && b.mainEaves !== undefined && b.mainRidge !== undefined).map((b) => ({ ...footprint(b.ring), lod2: b })));

/** The LoD2 building over a game outline at IoU ≥ `LOD1_MIN_IOU` (one to one, as for LoD1). */
export const lod2Match = (index: BoxIndex<Indexed>, ring: readonly Pt[]): { readonly lod2: Lod2Building; readonly iou: number } | undefined => {
  const f = footprint(ring);
  let best: { lod2: Lod2Building; iou: number } | undefined;
  for (const c of index.near(f.box)) {
    const v = iou(f, c, LOD1_MIN_IOU);
    if (v >= LOD1_MIN_IOU && (!best || v > best.iou || (v === best.iou && c.lod2.id < best.lod2.id))) best = { lod2: c.lod2, iou: v };
  }
  return best;
};

/** A map element's own roof tags (`roof:shape`, `roof:height`, `roof:levels`, `roof:colour`…). */
export const hasRoofTags = (tags: Readonly<Record<string, string>>): boolean => Object.keys(tags).some((k) => k.startsWith("roof:"));

/**
 * The walls, roof and storeys from LoD2's main eaves and ridge (over the foot): the walls at the
 * eaves, the roof up to the ridge. LoD2 counts from the lowest ground, as LoD1 does, so
 * `building:levels` of the map (`tagged`, fitting from the foot at `MIN_STOREY` each: `withLod2Roof`
 * checks) keeps its storeys, the plinth cut under them where they do not fit over it (G-629,
 * `lod1Massing`). Without the tag the walls are at least a storey over the plinth and the storeys
 * follow them.
 */
export const lod2Massing = (
  b: Pick<BuildingOut, "plinth" | "shopfront">,
  roof: { readonly eaves: number; readonly ridge: number; readonly shape: RoofShape },
  tagged?: number,
): Pick<BuildingOut, "height" | "roof" | "roofShape" | "levels" | "plinth"> => {
  const eaves = r1(roof.eaves);
  const height = tagged !== undefined ? eaves : r1(Math.max(b.plinth + STOREY, eaves));
  const plinth = tagged === undefined || height - b.plinth >= tagged * MIN_STOREY - 1e-9 ? b.plinth : r1(Math.max(0, Math.min(b.plinth, height - tagged * STOREY)));
  const levels = tagged ?? storeysOf(height - plinth, b.shopfront === true);
  return { height, roof: r1(Math.max(0, roof.ridge - height)), roofShape: roof.shape, levels, plinth };
};

/** The shapes whose ridge the renderer lays along the outline's long axis, or across it (`roofAcross`). */
export const RIDGED_SHAPES: ReadonlySet<RoofShape> = new Set(["gabled", "half-hipped", "mansard", "skillion"]);

/**
 * Whether LoD2's ridge (`ridgeDir`, degrees) lies nearer the outline's short axis than its long
 * one, so the renderer's ridge must turn across (G-639: Złota 3's ridge along the street, not
 * across it).
 */
export const lod2Across = (shape: RoofShape, ridgeDir: number | undefined, ring: readonly Pt[]): boolean =>
  RIDGED_SHAPES.has(shape) && ridgeDir !== undefined && lineAngle(ridgeDir, longAxisDegrees(ring)) > 45;

/** What the rule needs of the map's element: its tags and whether parts crown it. */
export interface Lod2Context {
  readonly lod2?: BoxIndex<Indexed>;
  readonly lod1?: ReturnType<typeof lod1Index>;
  readonly tags: Readonly<Record<string, string>>;
  readonly crowned: boolean;
  /** `building:levels` of the map, when the height came from it. */
  readonly tagged?: number;
  /** The whole outline of a building cut at the map's edge (G-556). */
  readonly whole?: readonly Pt[];
}

/**
 * A building with its walls and roof from LoD2 (`source: "lod2"`) where the rule above takes it,
 * else as it is. `b` comes out of LoD1's rule (`withLod1Height`).
 */
export const withLod2Roof = (b: BuildingOut, ctx: Lod2Context): BuildingOut => {
  if (!ctx.lod2 || (b.source !== "default" && b.source !== "levels" && b.source !== "lod1") || hasRoofTags(ctx.tags) || lod1Exempt(b, ctx.crowned) !== undefined) return b;
  const ring = ctx.whole ?? worldRing(b);
  const m = lod2Match(ctx.lod2, ring);
  const eaves = m?.lod2.mainEaves;
  const ridge = m?.lod2.mainRidge;
  const shape = lod2Shape(m?.lod2.roofType);
  if (eaves === undefined || ridge === undefined || !shape || ridge - eaves <= LOD2_MIN_ROOF) return b;
  // The map's storeys that do not fit under LoD2's eaves: the map and LoD2 disagree, LoD1 stays.
  if (ctx.tagged !== undefined && eaves < ctx.tagged * MIN_STOREY - 1e-9) return b;
  const measured = ctx.lod1 && lod1Match(ctx.lod1, ring)?.lod1.height;
  if (measured !== undefined && (measured < eaves - LOD2_LOD1_SLACK || measured > ridge + LOD2_LOD1_SLACK)) return b;
  const across = lod2Across(shape, m?.lod2.ridgeDir, worldRing(b));
  return { ...b, ...lod2Massing(b, { eaves, ridge, shape }, ctx.tagged), ...(across ? { roofAcross: true as const } : {}), source: "lod2" };
};
