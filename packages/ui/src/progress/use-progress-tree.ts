import type { AttributeId, Attributes, PerkRanks } from "@seki/core";
import { useState } from "react";
import { useUi } from "../use-ui";
import { TREES, perkView, ranksIn, treeOf } from "./perk-view";

/**
 * The tree the tab opens on: the first where a perk point buys a rank now, else the one with the
 * most ranks bought, else the first (Might).
 */
export const firstTree = (attributes: Attributes, perks: PerkRanks, points: number): AttributeId => {
  const buyable = TREES.find((tree) => treeOf(tree).some((id) => perkView(attributes, perks, points, id).canBuy));
  if (buyable) return buyable;
  let best: AttributeId = TREES[0]!;
  for (const tree of TREES) if (ranksIn(perks, tree) > ranksIn(perks, best)) best = tree;
  return best;
};

/** The perk tree on show on the Progress tab, chosen once when the tab opens and then by the player. */
export const useProgressTree = (): readonly [AttributeId, (tree: AttributeId) => void] => {
  const attributes = useUi((s) => s.attributes);
  const perks = useUi((s) => s.perks);
  const points = useUi((s) => s.perkPoints);
  const [tree, setTree] = useState<AttributeId>(() => firstTree(attributes, perks, points));
  return [tree, setTree] as const;
};
