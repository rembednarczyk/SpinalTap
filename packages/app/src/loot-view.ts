import { AMMO_CATALOG, type DomainState, type LootContainer, type LootLine, STACKABLE_CATALOG, itemSummary } from "@seki/core";
import type { LootLineVm, LootVm } from "@seki/ui";

/** Display name of one loot line. */
export const lootLabel = (l: LootLine): string => {
  switch (l.kind) {
    case "eddies":
      return "€$";
    case "ammo":
      return `Amunicja ${AMMO_CATALOG[l.ammo].name}`;
    case "stack":
      return STACKABLE_CATALOG[l.item].name;
    case "item":
      return itemSummary(l.item).name;
  }
};

const lineVm = (l: LootLine, index: number): LootLineVm => ({ index, kind: l.kind, label: lootLabel(l), qty: l.qty, rarity: l.kind === "item" ? l.rarity : null });

/** The panel view of a bag; "Torba gangera" for an enemy's, "Twoja torba" for a drop. */
export const lootVm = (c: LootContainer): LootVm => ({
  key: c.key,
  title: c.key.startsWith("drop:") ? "Twoja torba" : "Torba gangera",
  lines: c.lines.map(lineVm),
});

/** Short summary of what was taken, for the toast. */
export const lootSummary = (lines: readonly LootLine[]): string =>
  lines.map((l) => (l.kind === "eddies" ? `${l.qty} €$` : l.qty > 1 ? `${lootLabel(l)} × ${l.qty}` : lootLabel(l))).join(", ");

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
