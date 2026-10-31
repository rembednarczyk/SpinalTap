/**
 * HUD colour tokens by function (ADR-0028), defined as CSS variables `--tok-<id>` in styles.css
 * and swapped by the colour-blind modes. Every token comes with its icon, never colour alone.
 */
export type TokenId = "threat" | "objective" | "friendly" | "loot" | "hack";

/** The legend names are `settings.token.<id>` in the catalogs (ADR-0056). */
export const TOKENS: readonly { readonly id: TokenId; readonly icon: string }[] = [
  { id: "threat", icon: "▲" },
  { id: "objective", icon: "◆" },
  { id: "friendly", icon: "●" },
  { id: "loot", icon: "■" },
  { id: "hack", icon: "⬡" },
];
