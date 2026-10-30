import { AMMO_CATALOG, type DomainState, type LootContainer, type LootLine, STACKABLE_CATALOG, itemSummary } from "@seki/core";
import type { LootLineVm, LootVm, Translate } from "@seki/ui";

/** Catalog name of one loot line; for ammo the round's name, which the UI puts in a sentence. */
const lootName = (l: LootLine): string => {
  switch (l.kind) {
    case "eddies":
      return "€$";
    case "ammo":
      return AMMO_CATALOG[l.ammo].name;
    case "stack":
      return STACKABLE_CATALOG[l.item].name;
    case "item":
      return itemSummary(l.item).name;
  }
};

/** Display name of one loot line in the player's language ("9mm ammo"). */
export const lootLabel = (t: Translate, l: LootLine): string => (l.kind === "ammo" ? t("loot.ammo", { name: lootName(l) }) : lootName(l));

const lineVm = (l: LootLine, index: number): LootLineVm => ({ index, kind: l.kind, label: lootName(l), qty: l.qty, rarity: l.kind === "item" ? l.rarity : null });

/** The panel view of a bag: the player's own drop or an enemy's, which the panel names. */
export const lootVm = (c: LootContainer): LootVm => ({
  key: c.key,
  owner: c.key.startsWith("drop:") ? "own" : "ganger",
  lines: c.lines.map(lineVm),
});

/** Short summary of what was taken, for the toast. */
export const lootSummary = (t: Translate, lines: readonly LootLine[]): string =>
  lines.map((l) => (l.kind === "eddies" ? `${l.qty} €$` : l.qty > 1 ? `${lootLabel(t, l)} × ${l.qty}` : lootLabel(t, l))).join(", ");

/** Tracks the open bag's view; returns the same object while the container is unchanged. */
export const createLootTracker = () => {
  let lastLines: readonly LootLine[] | null = null;
  let last: LootVm | null = null;
  return (domain: DomainState, key: string | null): LootVm | null => {
    const c = key === null ? undefined : domain.loot.containers.find((x) => x.key === key);
    if (!c) {
      lastLines = null;
      return (last = null);
    }
    if (c.lines !== lastLines || last?.key !== c.key) {
      lastLines = c.lines;
      last = lootVm(c);
    }
    return last;
  };
};
