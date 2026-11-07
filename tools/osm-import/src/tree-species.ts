/**
 * The species of the city's trees from their OSM tags (G-423, T-196): `genus`, else the first word
 * of `species` or `taxon` (`data/osm/points/trees.json`, `pnpm osm:trees`). A genus the renderer
 * has a model of takes it; another known one, the nearest model by its crown (an ash or a plane
 * the maple's, a beech the oak's, a willow or a birch the poplar's); a tree with no genus, or one
 * of no likeness here (the conifers), keeps the species of its seed. `leaf_type` alone says nothing
 * the five models tell apart.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TREE_KIND } from "../../../packages/core/src/world/trees.ts";
import type { Tags } from "./osm.ts";
import { REPO } from "./paths.ts";

/** The renderer's tree model (`TREE_KIND`) of a genus. */
const GENUS: Readonly<Record<string, number>> = {
  Tilia: TREE_KIND.lime,
  Carpinus: TREE_KIND.lime,
  Ulmus: TREE_KIND.lime,
  Robinia: TREE_KIND.lime,
  Sorbus: TREE_KIND.lime,
  Prunus: TREE_KIND.lime,
  Malus: TREE_KIND.lime,
  Pyrus: TREE_KIND.lime,
  Acer: TREE_KIND.maple,
  Fraxinus: TREE_KIND.maple,
  Platanus: TREE_KIND.maple,
  Gleditsia: TREE_KIND.maple,
  Aesculus: TREE_KIND.chestnut,
  Castanea: TREE_KIND.chestnut,
  Catalpa: TREE_KIND.chestnut,
  Quercus: TREE_KIND.oak,
  Fagus: TREE_KIND.oak,
  Juglans: TREE_KIND.oak,
  Populus: TREE_KIND.poplar,
  Salix: TREE_KIND.poplar,
  Betula: TREE_KIND.poplar,
};

/** The genus of a tree's tags, capitalised as in the tables. */
export const genusOf = (tags: Tags | undefined): string | undefined => {
  const name = tags?.genus ?? tags?.species ?? tags?.taxon;
  const word = name?.trim().split(/\s+/)[0];
  return word ? word[0]!.toUpperCase() + word.slice(1).toLowerCase() : undefined;
};

/** A tree's species (`TREE_KIND`) by its tags, or undefined for one its seed picks. */
export const treeSpeciesOf = (tags: Tags | undefined): number | undefined => GENUS[genusOf(tags) ?? ""];

/** The tags of the plan's trees from `data/osm/points/trees.json` by node id (`n123`). */
export const loadTreeTags = (root = REPO): ReadonlyMap<string, Tags> => {
  const file = JSON.parse(readFileSync(join(root, "data/osm/points/trees.json"), "utf8")) as { header: { row: string[] }; trees: string[][] };
  const keys = file.header.row.slice(1);
  const out = new Map<string, Tags>();
  for (const [id, ...values] of file.trees) {
    const tags: Record<string, string> = {};
    keys.forEach((k, i) => {
      if (values[i]) tags[k] = values[i]!;
    });
    out.set(id!, tags);
  }
  return out;
};
