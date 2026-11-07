import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { StreetPropItem } from "../../../packages/core/src";
import { tree } from "../../../packages/engine/src/renderer/mapcity/prop-green";
import { scaleOf, shapeOf } from "../../../packages/engine/src/renderer/mapcity/prop-shapes";
import { TREE_HEIGHTS } from "../../osm-import/src/tree-heights.ts";

/**
 * Trees drawn far lower than the real ones (G-422, T-195): a tree of the plan with a measured
 * height (`TREE_HEIGHTS`: OSM `height` or the surface model NMPT less the NMT) whose drawn crown,
 * the renderer's model at the piece's size, tops out under `LOW` of it.
 */

/** Drawn lower than this share of the measured height is a glitch: the old spread drew 6.7-12 m for 5-23 m. */
const LOW = 0.6;

/** How far the drawn tree may stand from its node of the plan (m): the import moves trees off walls only a little. */
const REACH = 1.5;

/** A tree of the plan with its measured height. */
export interface MeasuredTree {
  readonly id: string;
  /** The plan's group it is in (`plac-litewski.tree`). */
  readonly group: string;
  readonly x: number;
  readonly z: number;
  readonly height: number;
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

/** The plan's trees (`docs/world/lublin-props.todo.json`) with a height in `heights`, at their nodes. */
export const measuredTrees = (
  plan: { readonly items: readonly { readonly id: string; readonly kind: string; readonly osm?: unknown; readonly points?: readonly (readonly number[])[] }[] },
  heights: Readonly<Record<string, number>>,
): MeasuredTree[] =>
  plan.items.flatMap((item) => {
    if (item.kind !== "tree" || !Array.isArray(item.osm) || !item.points) return [];
    const ids = item.osm as readonly string[];
    return item.points.flatMap((p, k) => {
      const h = heights[ids[k] ?? ""];
      return h === undefined ? [] : [{ id: ids[k]!, group: item.id, x: p[0]!, z: p[1]!, height: h }];
    });
  });

/** The city's measured trees: the plan's with a height in the import's `TREE_HEIGHTS`. */
export const cityMeasuredTrees = (): MeasuredTree[] => measuredTrees(JSON.parse(readFileSync(join(__dirname, "../../../docs/world/lublin-props.todo.json"), "utf8")), TREE_HEIGHTS);
