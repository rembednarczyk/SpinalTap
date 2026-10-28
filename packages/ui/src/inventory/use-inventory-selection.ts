import { type Equipment, type InventoryState, type ItemRef, findItem, isPlaced } from "@seki/core";
import { useEffect, useState } from "react";
import type { CharacterIntents } from "../intents";
import { type ActionContext, type ActionId, type ItemAction, defaultAction, itemActions, slotHolding } from "./actions";

interface Selection {
  readonly ref: ItemRef;
  /** Grid cell, for stacks spread over several cells and for arrow keys; null for a slot. */
  readonly index: number | null;
}

/** The sheet over the tab: how many to drop, a rare drop to confirm, or the mods of a weapon. */
export type InventorySheet =
  | { readonly kind: "quantity"; readonly ref: Extract<ItemRef, { stack: unknown }> }
  | { readonly kind: "confirm"; readonly ref: Extract<ItemRef, { uid: string }> }
  | { readonly kind: "mods"; readonly uid: string };

export interface InventorySelection {
  /** The selected piece, while it is still in the inventory. */
  readonly ref: ItemRef | null;
  /** Grid cell of the selection; null for a slot or a piece that moved into one. */
  readonly gridIndex: number | null;
  readonly selectedUid: string | null;
  readonly actions: readonly ItemAction[];
  /** Narrow screens show the details over the grid only when asked to. */
  readonly detailOpen: boolean;
  readonly sheet: InventorySheet | null;
  /** Selects a piece and opens the details. */
  select(ref: ItemRef, at: number | null): void;
  closeDetail(): void;
  closeSheet(): void;
  act(id: ActionId, target?: ItemRef | null): void;
  runDefault(target: ItemRef): void;
}

/**
 * Selection and actions of the inventory tab: what is selected, the sheet over it, the item
 * actions through the intents, and the E (equip or use) and X (drop) keys (plan §7). Arrows and
 * Enter live on the grid itself.
 */
export const useInventorySelection = (intents: CharacterIntents, inventory: InventoryState, equipment: Equipment, ctx: ActionContext): InventorySelection => {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sheet, setSheet] = useState<InventorySheet | null>(null);

  // A piece that left the inventory (used up, dropped) is no longer selected.
  const ref = selection && ("uid" in selection.ref ? findItem(inventory, selection.ref.uid) !== undefined : (inventory.stacks[selection.ref.stack] ?? 0) > 0) ? selection.ref : null;
  const index = ref && selection ? selection.index : null;
  // After equipping, the piece is in its slot: keep it selected there.
  const gridIndex = ref && index !== null && "uid" in ref && isPlaced(inventory, equipment, ref.uid) ? null : index;

  const act = (id: ActionId, target: ItemRef | null = ref) => {
    if (!target) return;
    if ("stack" in target) {
      if (id === "use") intents.useItem(target);
      else if (id === "drop") {
        if ((inventory.stacks[target.stack] ?? 0) > 1) setSheet({ kind: "quantity", ref: target });
        else intents.dropItem(target, 1);
      }
      return;
    }
    const item = findItem(inventory, target.uid);
    if (!item) return;
    switch (id) {
      case "equip":
        intents.equip(item.uid);
        break;
      case "unequip": {
        const slot = slotHolding(equipment, item.uid);
        if (slot) intents.unequip(slot);
        break;
      }
      case "mods":
        setSheet({ kind: "mods", uid: item.uid });
        break;
      case "drop":
        if (item.rarity === "rare" || item.rarity === "unique") setSheet({ kind: "confirm", ref: target });
        else intents.dropItem(target, 1);
        break;
      case "use":
        break;
    }
  };

  const runDefault = (target: ItemRef) => {
    const a = defaultAction(target, ctx);
    if (a) act(a.id, target);
  };

  const actions = ref ? itemActions(ref, ctx) : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet || !ref || e.repeat) return;
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === "KeyE") {
        e.preventDefault();
        runDefault(ref);
      } else if (e.code === "KeyX") {
        const drop = actions.find((a) => a.id === "drop" && a.blocked === null);
        if (drop) {
          e.preventDefault();
          act("drop");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return {
    ref,
    gridIndex,
    selectedUid: ref && "uid" in ref ? ref.uid : null,
    actions,
    detailOpen,
    sheet,
    select: (next, at) => {
      setSelection({ ref: next, index: at });
      setDetailOpen(true);
    },
    closeDetail: () => setDetailOpen(false),
    closeSheet: () => setSheet(null),
    act,
    runDefault,
  };
};
