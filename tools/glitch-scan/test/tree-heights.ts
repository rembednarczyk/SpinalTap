import { type StreetPropItem, plainTreeVariant } from "../../../packages/core/src";
import { tree } from "../../../packages/engine/src/renderer/mapcity/prop-green";
import { scaleOf, shapeOf } from "../../../packages/engine/src/renderer/mapcity/prop-shapes";
import { LUBLIN_CHUNKS } from "../../../packages/sim/src/content/lublin";
import { DISTRICTS } from "../../osm-import/src/config.ts";
import { type FurniturePoint, loadFurniture } from "../../osm-import/src/furniture.ts";
import { Site } from "../../osm-import/src/props-site.ts";
import { type TreeHeight, type TreeHeightFrom, measureTree } from "../../osm-import/src/tree-heights.ts";

/**
 * Trees drawn far lower than the real ones (G-422, T-195): a tree of OSM with a measured height
 * (the import's rule `measureTree`: OSM `height`, else the surface model NMPT less the NMT around
 * its node) whose drawn crown, the renderer's model at the piece's size, tops out under `LOW` of it.
 */

/** Drawn lower than this share of the measured height is a glitch: the old spread drew 6.7-12 m for 5-23 m. */
const LOW = 0.6;

/** How far the drawn tree may stand from its node of the plan (m): the import moves trees off walls only a little. */
const REACH = 1.5;

/** A tree of OSM with its measured height. */
export interface MeasuredTree {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly height: number;
  readonly from?: TreeHeightFrom;
}

const TOPS = new Map<number, number>();

/** The top of the renderer's tree model of a species at size 1 (m over its foot). */
const modelTop = (shape: number): number => {
  const known = TOPS.get(shape);
  if (known !== undefined) return known;
  const p = tree(shape).positions;
  let top = 0;
  for (let i = 1; i < p.length; i += 3) top = Math.max(top, p[i]!);
  TOPS.set(shape, top);
  return top;
};

/** How tall the renderer draws a tree piece (m over its foot). */
export const drawnTreeHeight = (i: StreetPropItem): number => modelTop(shapeOf("tree", i.variant)) * scaleOf("tree", i.variant);

/** Each measured tree with the drawn tree nearest its node within `REACH`: the drawn and the measured height. */
export const treeHeights = (measured: readonly MeasuredTree[], pieces: readonly StreetPropItem[]): { readonly tree: MeasuredTree; readonly drawn: number }[] => {
  const trees = pieces.filter((i) => i.prop === "tree");
  return measured.flatMap((m) => {
    let best: StreetPropItem | null = null;
    let d = REACH;
    for (const t of trees) {
      const e = Math.hypot(t.x - m.x, t.z - m.z);
      if (e <= d) [best, d] = [t, e];
    }
    return best ? [{ tree: m, drawn: drawnTreeHeight(best) }] : [];
  });
};

/** Measured trees the renderer draws lower than `LOW` of their height. */
export const treesBelowMeasured = (measured: readonly MeasuredTree[], pieces: readonly StreetPropItem[]): { readonly at: string; readonly what: string }[] =>
  treeHeights(measured, pieces)
    .filter((h) => h.drawn < LOW * h.tree.height)
    .map((h) => ({ at: `${h.tree.x.toFixed(0)},${h.tree.z.toFixed(0)}`, what: `${h.tree.id} drawn ${h.drawn.toFixed(1)} m, measured ${h.tree.height} m` }));

const inMap = (p: { readonly x: number; readonly z: number }): boolean => DISTRICTS.some(({ rect: r }) => p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ);

let site: Site | null = null;
/** The import's site of the city's chunks, built once. */
const citySite = (): Site => (site ??= new Site(LUBLIN_CHUNKS));

let trees: FurniturePoint[] | null = null;
/** The trees of the current OSM extract in the map (`furniture.json`), their detail OSM `height`. */
const osmTrees = (): FurniturePoint[] => (trees ??= loadFurniture().filter((f) => f.tag === "natural=tree" && inMap(f.p)));

/** The height the import's rule gives a tree at p with the OSM `height` of `node` (none without one). */
const measureAt = (p: { readonly x: number; readonly z: number }, node?: FurniturePoint): TreeHeight | null => measureTree(citySite(), p, node?.detail ? { height: node.detail } : undefined);

/** The city's measured trees: the OSM trees in the map with a height by the import's rule, at their nodes. */
export const cityMeasuredTrees = (): MeasuredTree[] =>
  osmTrees().flatMap((f) => {
    const m = measureAt(f.p, f);
    return m ? [{ id: f.id, x: f.p.x, z: f.p.z, height: m.height, from: m.from }] : [];
  });

/** The game's trees with a height by the import's rule where they stand, the OSM `height` of the node within `REACH` (rows of trees have none). */
export const cityMeasuredPieces = (pieces: readonly StreetPropItem[]): MeasuredTree[] =>
  pieces.flatMap((t) => {
    if (t.prop !== "tree") return [];
    const node = osmTrees().find((f) => Math.hypot(f.p.x - t.x, f.p.z - t.z) <= REACH);
    const m = measureAt(t, node);
    return m ? [{ id: `${t.x},${t.z}`, x: t.x, z: t.z, height: m.height, from: m.from }] : [];
  });

/**
 * Trees of the game drawn with no height from the data (audit of ADR-0077 14.11, gap 4): a tree
 * piece with no measured tree within `REACH` of it, or one whose variant is still its seed's
 * (`plainTreeVariant`: the random size), as where its crown cannot grow clear of a wall.
 */
export const treesUnmeasured = (measured: readonly { readonly x: number; readonly z: number }[], pieces: readonly StreetPropItem[]): { readonly at: string; readonly what: string }[] =>
  pieces.flatMap((t) => {
    if (t.prop !== "tree") return [];
    const at = `${t.x.toFixed(0)},${t.z.toFixed(0)}`;
    const drawn = drawnTreeHeight(t).toFixed(1);
    if (!measured.some((m) => Math.hypot(t.x - m.x, t.z - m.z) <= REACH)) return [{ at, what: `tree drawn ${drawn} m with no height from OSM or NMPT` }];
    return plainTreeVariant(t.variant) === t.variant ? [{ at, what: `tree drawn ${drawn} m at its seed's size, though measured` }] : [];
  });

/** The buffer off the buildings' outlines the roof check reads with (m): eaves reach 1-2 m past the OSM outlines. */
const ROOF_CHECK = 2;
/** A tree's height over its reading off the roofs by more than this (m) is a roof's. */
const CAPTURE = 3;

/**
 * Trees of OSM sized from the surface model by a roof (`tree-roof-capture`): the import's height
 * exceeds by over `CAPTURE` what the surface model gives with the cells within `ROOF_CHECK` of a
 * building left out (eaves past the outline read as a crown; the seedlings of n9254081961...67).
 */
export const treesRoofCaptured = (): { readonly at: string; readonly what: string }[] =>
  osmTrees().flatMap((f) => {
    const used = measureAt(f.p, f);
    if (!used || used.from !== "nmpt") return [];
    const off = measureTree(citySite(), f.p, undefined, undefined, ROOF_CHECK)?.height ?? 0;
    return used.height - off > CAPTURE ? [{ at: `${f.p.x.toFixed(0)},${f.p.z.toFixed(0)}`, what: `${f.id} measured ${used.height} m, ${off} m off the roofs` }] : [];
  });
