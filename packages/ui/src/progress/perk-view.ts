import {
  ATTRIBUTE_IDS,
  type AttributeId,
  type Attributes,
  PERK_IDS,
  PERK_TIERS,
  type PerkId,
  type PerkRanks,
  type PerkTier,
  missingTier,
  perkDef,
  perkRank,
  perkUnlocked,
} from "@seki/core";

/** The perks of one attribute's tree, tier by tier (the table's order). */
export const treeOf = (tree: AttributeId): readonly PerkId[] => PERK_IDS.filter((id) => perkDef(id).tree === tree);

/** The tree's perks grouped by tier, lowest first; every tier of `PERK_TIERS` has a group. */
export const tiersOf = (tree: AttributeId): readonly (readonly PerkId[])[] =>
  PERK_TIERS.map((_, tier) => treeOf(tree).filter((id) => perkDef(id).tier === (tier as PerkTier)));

/** What a perk's row shows: its rank, what still shuts it and whether a point buys a rank now. */
export interface PerkView {
  readonly rank: number;
  readonly ranks: number;
  /** The attribute opens the perk's tier. */
  readonly attributeOk: boolean;
  /** The lowest empty tier below it in the tree (stage 3c), or null when the path is whole. */
  readonly missing: PerkTier | null;
  /** A point would buy a rank now: points left, the tier open, the path whole, a rank left. */
  readonly canBuy: boolean;
}

/** The same rules the simulation's `spend-perk-point` applies, read for one row. */
export const perkView = (attributes: Attributes, perks: PerkRanks, points: number, id: PerkId): PerkView => {
  const ranks = perkDef(id).ranks;
  const rank = perkRank(perks, id);
  const attributeOk = perkUnlocked(attributes, id);
  const missing = missingTier(perks, id);
  return { rank, ranks, attributeOk, missing, canBuy: points > 0 && attributeOk && missing === null && rank < ranks };
};

/** Ranks bought in a tree, for the tree's button. */
export const ranksIn = (perks: PerkRanks, tree: AttributeId): number => treeOf(tree).reduce((sum, id) => sum + perkRank(perks, id), 0);

/** The trees in the attributes' order. */
export const TREES: readonly AttributeId[] = ATTRIBUTE_IDS;
