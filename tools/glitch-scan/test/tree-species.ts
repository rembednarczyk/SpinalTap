import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { StreetPropItem } from "../../../packages/core/src";
import { TREE_SHAPE, shapeOf } from "../../../packages/engine/src/renderer/mapcity/prop-shapes";

/**
 * Trees drawn as another species than OSM names (G-423, T-196): a tree of the plan whose node has a
 * `genus` (or `species`, `taxon`) of one of the renderer's models in `data/osm/points/trees.json`
 * (`pnpm osm:trees`), drawn as another model. The genera the renderer only likens to a model (an
 * ash, a beech) and the trees with no genus are not counted.
 */

/** The genera the renderer has a model of, by the model's name in `TREE_SHAPE`. */
const MODELLED: Readonly<Record<string, keyof typeof TREE_SHAPE>> = { Tilia: "lime", Acer: "maple", Aesculus: "chestnut", Quercus: "oak", Populus: "poplar" };

/** How far the drawn tree may stand from its node of the plan (m), as for the heights (`tree-heights.ts`). */
const REACH = 1.5;

/** A tree of the plan with the genus OSM gives it. */
export interface NamedTree {
  readonly id: string;
  readonly genus: string;
  readonly x: number;
  readonly z: number;
}

type Plan = { readonly items: readonly { readonly kind: string; readonly osm?: unknown; readonly points?: readonly (readonly number[])[] }[] };

/** The plan's trees whose node has a genus in `genera` (by node id), at their nodes. */
export const namedTrees = (plan: Plan, genera: ReadonlyMap<string, string>): NamedTree[] =>
  plan.items.flatMap((item) => {
    if (item.kind !== "tree" || !Array.isArray(item.osm) || !item.points) return [];
    const ids = item.osm as readonly string[];
    return item.points.flatMap((p, k) => {
      const genus = genera.get(ids[k] ?? "");
      return genus === undefined ? [] : [{ id: ids[k]!, genus, x: p[0]!, z: p[1]! }];
    });
  });

/** Named trees of a modelled genus whose nearest drawn tree within `REACH` is drawn as another model. */
export const treesOfOtherSpecies = (named: readonly NamedTree[], pieces: readonly StreetPropItem[]): { readonly at: string; readonly what: string }[] => {
  const trees = pieces.filter((i) => i.prop === "tree");
  return named.flatMap((n) => {
    const want = MODELLED[n.genus];
    if (want === undefined) return [];
    let best: StreetPropItem | null = null;
    let d = REACH;
    for (const t of trees) {
      const e = Math.hypot(t.x - n.x, t.z - n.z);
      if (e <= d) [best, d] = [t, e];
    }
    const shape = best ? shapeOf("tree", best.variant) : null;
    if (shape === null || shape === TREE_SHAPE[want]) return [];
    const drawn = Object.entries(TREE_SHAPE).find(([, s]) => s === shape)?.[0] ?? `shape ${shape}`;
    return [{ at: `${n.x.toFixed(0)},${n.z.toFixed(0)}`, what: `${n.id} ${n.genus} drawn as ${drawn}, not ${want}` }];
  });
};

const ROOT = join(__dirname, "../../..");

/** The genus of each tagged tree of `data/osm/points/trees.json`: `genus`, else the first word of `species` or `taxon`. */
export const cityTreeGenera = (): Map<string, string> => {
  const file = JSON.parse(readFileSync(join(ROOT, "data/osm/points/trees.json"), "utf8")) as { header: { row: string[] }; trees: string[][] };
  const col = (k: string) => file.header.row.indexOf(k);
  const out = new Map<string, string>();
  for (const r of file.trees) {
    const name = [r[col("genus")], r[col("species")], r[col("taxon")]].find((v) => v);
    if (name) out.set(r[0]!, name.split(/\s+/)[0]!);
  }
  return out;
};

/** The city's trees OSM names a genus of. */
export const cityNamedTrees = (): NamedTree[] => namedTrees(JSON.parse(readFileSync(join(ROOT, "docs/world/lublin-props.todo.json"), "utf8")), cityTreeGenera());
