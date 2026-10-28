import {
  EQUIP_SLOTS,
  type EquipSlot,
  type Equipment,
  type InventoryState,
  type ItemDefId,
  type ItemRef,
  STACKABLE_CATALOG,
  type StackableId,
  WEAPON_CATALOG,
  findItem,
  freeCells,
  isConsumableId,
  needsWounds,
  isPlaced,
  isWeaponId,
  slotFor,
  stackCount,
} from "@seki/core";
import { useState } from "react";
import { itemName } from "./item-text";

export type ActionId = "use" | "equip" | "unequip" | "mods" | "drop";

export interface ItemAction {
  readonly id: ActionId;
  readonly label: string;
  /** Why the action cannot be done now; null when it can. */
  readonly blocked: string | null;
  /** Keyboard shortcut shown on the button. */
  readonly key?: string;
}

export interface ActionContext {
  readonly inventory: InventoryState;
  readonly equipment: Equipment;
  readonly hp: number;
  readonly maxHp: number;
}

/** Slot that holds `uid`, if any. */
export const slotHolding = (eq: Equipment, uid: string): EquipSlot | null => EQUIP_SLOTS.find((s) => eq[s] === uid) ?? null;

/**
 * What can be done with the selected piece (plan §7), in button order. The same rules as the
 * commands in core, so a button that is enabled never does nothing.
 */
export const itemActions = (ref: ItemRef, ctx: ActionContext): ItemAction[] => {
  const { inventory: inv, equipment: eq } = ctx;
  if ("stack" in ref) {
    const out: ItemAction[] = [];
    if (isConsumableId(ref.stack)) out.push({ id: "use", label: "Użyj", key: "E", blocked: ctx.hp >= ctx.maxHp && needsWounds(ref.stack) ? "Zdrowie jest pełne" : null });
    out.push({ id: "drop", label: "Wyrzuć", key: "X", blocked: null });
    return out;
  }
  const item = findItem(inv, ref.uid);
  if (!item) return [];
  const out: ItemAction[] = [];
  const held = slotHolding(eq, item.uid);
  const hasMods = isWeaponId(item.def) && WEAPON_CATALOG[item.def].modSlots.length > 0;
  if (held) {
    out.push({ id: "unequip", label: "Zdejmij", blocked: freeCells(inv, eq) < 1 ? "Brak miejsca w torbie" : null });
  } else if (slotFor(item.def) !== null) {
    out.push({ id: "equip", label: "Załóż", key: "E", blocked: null });
  }
  if (hasMods) out.push({ id: "mods", label: "Mody", blocked: null });
  if (!held) {
    const mounted = isPlaced(inv, eq, item.uid);
    const modded = Object.keys(item.mods ?? {}).length > 0;
    out.push({ id: "drop", label: "Wyrzuć", key: "X", blocked: mounted ? "Zamontowany w broni" : modded ? "Najpierw zdejmij mody" : null });
  }
  return out;
};

/** The action a double tap, a right click, Enter or E does: equip or use. */
export const defaultAction = (ref: ItemRef, ctx: ActionContext): ItemAction | null =>
  itemActions(ref, ctx).find((a) => (a.id === "equip" || a.id === "use") && a.blocked === null) ?? null;

export const ActionBar = ({ actions, onAction }: { actions: readonly ItemAction[]; onAction: (id: ActionId) => void }) => {
  const blocked = actions.find((a) => a.blocked)?.blocked ?? null;
  return (
    <div className="inv__actions" data-testid="item-actions">
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          className={`inv__action inv__action--${a.id}`}
          disabled={a.blocked !== null}
          title={a.blocked ?? undefined}
          onClick={() => onAction(a.id)}
        >
          {a.label}
          {a.key && <kbd className="inv__action-key">{a.key}</kbd>}
        </button>
      ))}
      {blocked && <p className="inv__blocked">{blocked}</p>}
    </div>
  );
};

/** How many of a stack to drop. */
export const QuantityPicker = ({ stack, inventory, onConfirm, onCancel }: { stack: StackableId; inventory: InventoryState; onConfirm: (qty: number) => void; onCancel: () => void }) => {
  const total = stackCount(inventory, stack);
  const [qty, setQty] = useState(1);
  return (
    <div className="inv__sheet" role="dialog" aria-label="Ile wyrzucić" data-testid="quantity-picker">
      <p className="inv__sheet-text">
        Ile wyrzucić? {STACKABLE_CATALOG[stack].name}, masz {total}.
      </p>
      <label className="inv__qty">
        <input type="range" min={1} max={total} step={1} value={qty} aria-label="Ilość" onChange={(e) => setQty(Number(e.currentTarget.value))} />
        <span className="inv__qty-value">{qty}</span>
      </label>
      <div className="inv__sheet-actions">
        <button type="button" className="inv__action" onClick={onCancel}>
          Anuluj
        </button>
        <button type="button" className="inv__action inv__action--drop" onClick={() => onConfirm(qty)}>
          Wyrzuć × {qty}
        </button>
      </div>
    </div>
  );
};

/** Asks before a rare or unique piece goes on the street. */
export const ConfirmSheet = ({ def, onConfirm, onCancel }: { def: ItemDefId; onConfirm: () => void; onCancel: () => void }) => (
  <div className="inv__sheet" role="alertdialog" aria-label="Potwierdź wyrzucenie" data-testid="confirm-drop">
    <p className="inv__sheet-text">Wyrzucić {itemName(def)}? Takiej rzeczy łatwo nie znajdziesz drugi raz.</p>
    <div className="inv__sheet-actions">
      <button type="button" className="inv__action" onClick={onCancel}>
        Zostaw
      </button>
      <button type="button" className="inv__action inv__action--drop" onClick={onConfirm}>
        Wyrzuć
      </button>
    </div>
  </div>
);
