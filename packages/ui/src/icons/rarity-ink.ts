import type { Rarity } from "@seki/core";
import type { CSSProperties } from "react";

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
 * Frame of a bag cell or an equipment slot in its rarity's ink; common keeps the panel's edge.
 * Inline, because `.inv__cell` and `.inv__slot` come after `.rarity--*` in styles.css and set
 * the border too: by the order of the rules the rarity's colour lost (G-410).
 */
export const rarityFrame = (rarity: Rarity): CSSProperties => (rarity === "common" ? {} : { borderColor: RARITY_INK[rarity] });

/**
 * The ring of a selected cell with an icon: white, a colour no rarity has, drawn inside the
 * rarity frame instead of over it, so the selection and the tier both stay readable.
 */
export const SELECT_INK = "#ffffff";

/**
 * What an icon sits on, for the contrast test: hand copies of the backgrounds in `styles.css`
 * (`.inv__cell` rgba(8, 14, 20, 0.8), `.inv__cell--on` rgba(255, 61, 139, 0.16), `.shop__item`
 * rgba(57, 255, 208, 0.04) over `.shop` rgba(6, 12, 14, 0.94)), flattened over the menu's
 * background (`PREVIEW_BACKGROUND`, #070b10). The HUD's weapon strip (`--panel`, rgba(8, 14, 20,
 * 0.72)) lies over the street instead: flattened over a light grey (#c8c8c8), brighter than the
 * night city behind it nearly everywhere. A change there has to come here too.
 */
export const ICON_BACKGROUNDS: Readonly<Record<"cell" | "selected" | "card" | "hud", string>> = {
  cell: "#080d13",
  selected: "#2f1324",
  card: "#091617",
  hud: "#3e4246",
};
