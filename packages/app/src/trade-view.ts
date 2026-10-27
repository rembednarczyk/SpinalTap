import { type DomainState, type StackableId, STACKABLE_CATALOG, freeCells, isPlaced, itemSummary, stackCount } from "@seki/core";
import { EMPTY_TRADE, type TradeItemVm, type TradeVm } from "@seki/ui";

/** The bag as a shop counter shows it: loose and worn pieces (in pick-up order), then stacks. */
export const tradeVm = (domain: DomainState): TradeVm => {
  const { inventory, equipment } = domain;
  const items: TradeItemVm[] = inventory.items.map((i) => ({
    key: i.uid,
    ref: { uid: i.uid },
    defId: i.def,
    name: itemSummary(i.def).name,
    category: itemSummary(i.def).category,
    rarity: i.rarity,
    qty: 1,
    condition: i.condition ?? null,
    inUse: isPlaced(inventory, equipment, i.uid) || Object.keys(i.mods ?? {}).length > 0,
  }));
  for (const id of Object.keys(inventory.stacks) as StackableId[]) {
    const qty = stackCount(inventory, id);
    if (qty <= 0) continue;
    const def = STACKABLE_CATALOG[id];
    items.push({ key: id, ref: { stack: id }, defId: id, name: def.name, category: def.category, rarity: null, qty, condition: null, inUse: false });
  }
  return { items, capacity: inventory.capacity, freeCells: freeCells(inventory, equipment), weaponParts: stackCount(inventory, "weapon_parts") };
};

/** Rebuilds the view only when the bag or what is worn changed, so the store stays quiet otherwise. */
export const createTradeTracker = () => {
  let inventory: DomainState["inventory"] | null = null;
  let equipment: DomainState["equipment"] | null = null;
  let last: TradeVm = EMPTY_TRADE;
  return (domain: DomainState): TradeVm => {
    if (domain.inventory === inventory && domain.equipment === equipment) return last;
    inventory = domain.inventory;
    equipment = domain.equipment;
    last = tradeVm(domain);
    return last;
  };
};
