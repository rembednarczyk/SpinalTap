export interface ItemDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly price: number;
  /** HP restored when used. */
  readonly heal: number;
}

export const ITEM_CATALOG = {
  medkit: {
    id: "medkit",
    name: "Apteczka",
    description: "Iniektor z biożelem. Przywraca 40 HP.",
    price: 90,
    heal: 40,
  },
} as const satisfies Record<string, ItemDefinition>;

export type ItemId = keyof typeof ITEM_CATALOG;

export const isItemId = (id: string): id is ItemId => Object.hasOwn(ITEM_CATALOG, id);

export const MAX_STACK = 9;

/** Item counts by id. Missing ids mean zero. */
export type Inventory = Readonly<Partial<Record<ItemId, number>>>;

export const itemCount = (inv: Inventory, id: ItemId): number => inv[id] ?? 0;

export const addItem = (inv: Inventory, id: ItemId, qty = 1): Inventory | null => {
  const next = itemCount(inv, id) + qty;
  return qty > 0 && next <= MAX_STACK ? { ...inv, [id]: next } : null;
};

/** Returns null when there is nothing to take. */
export const takeItem = (inv: Inventory, id: ItemId): Inventory | null =>
  itemCount(inv, id) > 0 ? { ...inv, [id]: itemCount(inv, id) - 1 } : null;
