/**
 * HUD colour tokens by function (ADR-0028), defined as CSS variables `--tok-<id>` in styles.css
 * and swapped by the colour-blind modes. Every token comes with its icon, never colour alone.
 */
export type TokenId = "threat" | "objective" | "friendly" | "loot" | "hack";

export const TOKENS: readonly { readonly id: TokenId; readonly label: string; readonly icon: string }[] = [
  { id: "threat", label: "Zagrożenie", icon: "▲" },
  { id: "objective", label: "Cel", icon: "◆" },
  { id: "friendly", label: "Przyjazny", icon: "●" },
  { id: "loot", label: "Łup", icon: "■" },
  { id: "hack", label: "Hack", icon: "⬡" },
];
