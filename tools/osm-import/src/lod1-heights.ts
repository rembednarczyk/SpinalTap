/**
 * Building heights from GUGiK LoD1 2024 (ADR-0077 step 3). Where the map gives no `height`, a
 * building stood at its district's default storeys or at `building:levels × 3.2 m`, a guess
 * off by 7.3 m and more at p90 (the GUGiK report; Cicha 6 at 16.3 m against LoD1 8.6 m, Cicha 8
 * at 12.8 m against 18.8 m, G-601). LoD1 `measuredHeight` lies between the eaves and the ridge (median
 * 1 m over the LoD2 eaves and 1 m under the ridge), so it stands for the middle of the roof: the
 * eaves go to `measuredHeight − roof / 2` with the roof the tag rules give, the change capped at
 * `LOD1_MAX_CHANGE` either way.
 *
 * Only for a building matched one to one by footprint (IoU ≥ `LOD1_MIN_IOU`) whose height was
 * `default` or `levels`. Kept as they are: a measured `height` of the map or a correction, churches
 * (their towers and helmets are not a prism), towers, the landmarks of the list (`landmark-ids.ts`),
 * buildings crowned by parts of their own and the parts themselves, buildings whose storeys or roof
 * a correction sets by hand, and areas added by hand. Historic buildings without a tower (palaces,
 * tenements of the Rynek, G-632) take LoD1 like the rest.
 */
import { type Lod1Building } from "../../gugik/src/extracts.ts";
import { BoxIndex, type Footprint, footprint, iou } from "../../gugik/src/overlap.ts";
import { SHOP_STOREY, STOREY } from "./building-tags.ts";
import { TAG_CORRECTIONS } from "./corrections.ts";
import { isListedLandmark } from "./landmark-ids.ts";
import { type Pt, r1 } from "./geometry.ts";
import { type BuildingOut } from "./model.ts";

/** The least footprint overlap for a building to take its height from LoD1. */
export const LOD1_MIN_IOU = 0.7;
/** The most the eaves move either way, metres. */
export const LOD1_MAX_CHANGE = 10;
/**
 * The least walls over the plinth: one storey. LoD1 counts from the lowest ground (its ground is
 * the game's foot, median 0.3 m apart), so on a slope its height takes in the plinth. A house whose
 * `building:levels` fit from the foot keeps them, its plinth cut to what is left under them (the
 * rest buried in the slope: Kowalska 7 on the Old Town's scarp, plinth 12.1 m from the terrain
 * model, LoD1 14.2 m, four storeys seen from the street, G-629); other houses keep a storey over it.
 */
const MIN_WALLS = STOREY;
/** The lowest storey `building:levels` keeps: lower walls take fewer storeys. */
export const MIN_STOREY = 2.6;

const HEIGHT_TAGS = ["height", "building:height", "building:levels", "roof:height", "roof:levels", "min_height"];

/** Map ids whose height, storeys or roof a correction sets by hand (`corrections.ts`). */
export const HAND_HEIGHTS: ReadonlySet<string> = new Set(TAG_CORRECTIONS.filter((c) => HEIGHT_TAGS.some((k) => c.tags[k] !== undefined)).map((c) => c.id));

type Candidate = Pick<BuildingOut, "id" | "soffit" | "tower" | "mappedTower"> & { readonly use: string };

/**
 * Why a building keeps its own height whatever LoD1 says (undefined: it does not). `crowned` is a
 * building with parts of its own standing on it, or a part standing as a building (orphan part).
 */
export const lod1Exempt = (b: Candidate, crowned = false): string | undefined => {
  if (b.soffit !== undefined) return "part";
  if (crowned) return "parts";
  if (b.use === "church") return b.use;
  if (b.tower || b.mappedTower) return "tower";
  if (isListedLandmark(b.id)) return "landmark";
  if (!/^[wr]\d/.test(b.id)) return "added";
  if (HAND_HEIGHTS.has(b.id.split("/")[0]!)) return "hand";
  return undefined;
};

type Indexed = Footprint & { readonly lod1: Lod1Building };

/** LoD1 buildings indexed for the footprint match. */
export const lod1Index = (lod1: readonly Lod1Building[]): BoxIndex<Indexed> => new BoxIndex(lod1.filter((b) => b.ring.length >= 3).map((b) => ({ ...footprint(b.ring), lod1: b })));

/** The game's outline of a building in world metres. */
export const worldRing = (b: Pick<BuildingOut, "x" | "z" | "outline">): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < b.outline.length; i += 2) out.push({ x: b.outline[i]! + b.x, z: b.outline[i + 1]! + b.z });
  return out;
};

/**
 * The LoD1 building over a game outline, with their IoU, when it is at least `min`. With `min` ≥
 * 0.5 the match is one to one by itself: two outlines apart cannot both overlap one LoD1
 * building by more than half their union.
 */
export const lod1Match = (index: BoxIndex<Indexed>, ring: readonly Pt[], min = LOD1_MIN_IOU): { readonly lod1: Lod1Building; readonly iou: number } | undefined => {
  const f = footprint(ring);
  let best: { lod1: Lod1Building; iou: number } | undefined;
  for (const c of index.near(f.box)) {
    const v = iou(f, c, min);
    if (v >= min && (!best || v > best.iou || (v === best.iou && c.lod1.id < best.lod1.id))) best = { lod1: c.lod1, iou: v };
  }
  return best;
};

/** Storeys of walls this high over the plinth, a shop floor of 4 m first when it has shops. */
export const storeysOf = (walls: number, shops: boolean): number => Math.max(1, shops && walls >= SHOP_STOREY + STOREY / 2 ? 1 + Math.round((walls - SHOP_STOREY) / STOREY) : Math.round(walls / STOREY));

/**
 * The eaves and storeys from LoD1 `measuredHeight` (`measured`): the eaves at `measured −
 * roof / 2`, at most `LOD1_MAX_CHANGE` from where they were and at least `MIN_WALLS` over the
 * plinth. Storeys follow the walls for a default height; `building:levels` of the map keeps its
 * own where they fit from the foot at `MIN_STOREY` each (the plinth cut to make room), fewer only
 * where they do not.
 */
export const lod1Massing = (
  b: Pick<BuildingOut, "height" | "plinth" | "roof" | "levels" | "shopfront" | "source">,
  measured: number,
): { readonly height: number; readonly levels: number; readonly plinth: number } => {
  const want = measured - (b.roof ?? 0) / 2;
  const capped = Math.min(b.height + LOD1_MAX_CHANGE, Math.max(b.height - LOD1_MAX_CHANGE, want));
  const height = r1(Math.max(b.plinth + MIN_WALLS, capped));
  const walls = height - b.plinth;
  // The map's storeys fit only from the foot, or a storey over the plinth tops LoD1: they stay,
  // over what is left of the plinth.
  const fits = r1(capped);
  const room = (h: number) => h >= b.levels * MIN_STOREY - 1e-9;
  if (b.source === "levels" && room(fits) && (!room(walls) || height > fits)) return { height: fits, levels: b.levels, plinth: r1(Math.max(0, Math.min(b.plinth, fits - b.levels * STOREY))) };
  const levels = b.source === "levels" ? Math.max(1, Math.min(b.levels, Math.floor(walls / MIN_STOREY + 1e-9))) : storeysOf(walls, b.shopfront === true);
  return { height, levels, plinth: b.plinth };
};

/**
 * A building with its height from LoD1 (`source: "lod1"`) where the rule above takes it, else as it
 * is. `whole` is the map's outline of a building cut at the map's edge (G-556): LoD1 holds the whole
 * building, so the match is on it, the height going to the part on the map.
 */
export const withLod1Height = (b: BuildingOut, index: BoxIndex<Indexed> | undefined, crowned: boolean, whole?: readonly Pt[]): BuildingOut => {
  if (!index || (b.source !== "default" && b.source !== "levels") || lod1Exempt(b, crowned) !== undefined) return b;
  const m = lod1Match(index, whole ?? worldRing(b));
  return m ? { ...b, ...lod1Massing(b, m.lod1.height), source: "lod1" } : b;
};
