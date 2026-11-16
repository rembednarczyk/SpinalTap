import type { LootLine } from "../items/types";
import { sellPrice } from "../shop/trade";

// Apart from `sabotage-loud.ts`: the shop's prices reach the domain state, which holds the contracts (no cycle).

/**
 * The chest of armoury S, opened with the charges' case (ADR-0082 §1 p. 2, cut to the band's
 * 450 €$ of loot): Tessen's AR-5, a belt of 5.56 for it and a medkit. The DMR and the Tessen vest
 * of the ADR's list stay for armoury N (with them the loot sells for some 1300 €$).
 */
export const W3_ARMOURY_LOOT: readonly LootLine[] = [
  { kind: "item", item: "tessen_ar5", rarity: "common", qty: 1 },
  { kind: "ammo", ammo: "556", qty: 90 },
  { kind: "stack", item: "medkit", qty: 1 },
];

/**
 * What the chest is worth to her at level 1: the AR-5 and the medkit sold to a trader at standard
 * terms. The ammunition is not counted: it goes on the waves (ADR-0082 balance, "minus ammo").
 */
export const armouryLootValue = (lines: readonly LootLine[] = W3_ARMOURY_LOOT): number =>
  lines.reduce((sum, l) => sum + (l.kind === "item" || l.kind === "stack" ? l.qty * sellPrice({ def: l.item, rarity: l.kind === "item" ? l.rarity : "common" }) : l.kind === "eddies" ? l.qty : 0), 0);
