import type { Rarity } from "@seki/core";

/**
 * Colour of an icon's outline and frame per rarity (ADR-0073): the hues of the rarity frames in
 * `styles.css` and of the loot bag's strip (`LOOT_STRIP` in engine), opaque so the contrast test
 * can measure them. Common is the neutral ink. The rarity is always written out too.
 */
export const RARITY_INK: Readonly<Record<Rarity, string>> = {
  common: "#c9d1e0",
  uncommon: "#5ff2ff",
  rare: "#ff3d8b",
  epic: "#b26eff",
  legendary: "#ff8a1f",
  unique: "#ffbf4a",
};

/**
 * What an icon sits on, flattened over the menu's background (`PREVIEW_BACKGROUND`, #070b10):
 * a bag cell, a selected cell (`inv__cell--on`) and a card on the counter (`shop__item`).
 */
export const ICON_BACKGROUNDS: Readonly<Record<"cell" | "selected" | "card", string>> = {
  cell: "#080d13",
  selected: "#2f1324",
  card: "#091617",
};
