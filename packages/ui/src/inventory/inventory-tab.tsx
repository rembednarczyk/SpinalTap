import { type ItemRef, bagCells, findItem, isPlaced, usedCells } from "@seki/core";
import { useEffect, useMemo, useState } from "react";
import { useIntents, useUi } from "../use-ui";
import { type ActionContext, type ActionId, ConfirmSheet, QuantityPicker, defaultAction, itemActions, slotHolding } from "./actions";
import { CharacterPreview } from "./character-preview";
import { EquipmentSlots } from "./equipment-slots";
import { ItemDetail } from "./item-detail";
import { type GridSort, GridFilters, ItemGrid, NEXT_SORT, SORT_LABEL, arrangeCells, refKey } from "./item-grid";
import type { GridFilter } from "./item-text";
import { ModOverlay } from "./mod-overlay";
import { StatsPanel } from "./stats-panel";

interface Selection {
  readonly ref: ItemRef;
  /** Grid cell, for stacks spread over several cells and for arrow keys; null for a slot. */
  readonly index: number | null;
}

type Sheet = { readonly kind: "quantity"; readonly ref: Extract<ItemRef, { stack: unknown }> } | { readonly kind: "confirm"; readonly ref: Extract<ItemRef, { uid: string }> } | { readonly kind: "mods"; readonly uid: string };

/**
 * Inventory tab of the character screen (plan §7): preview and worn pieces on the left, the
 * bag in the middle, details with the comparison and the actions on the right. Every action
 * goes through an intent and applies at once; the clock stands meanwhile.
 */
export const InventoryTab = () => {
  const intents = useIntents();
  const inventory = useUi((s) => s.inventory);
  const equipment = useUi((s) => s.equipment);
  const stats = useUi((s) => s.characterStats);
  const [filter, setFilter] = useState<GridFilter>("all");
  const [sort, setSort] = useState<GridSort>("category");
  const [selection, setSelection] = useState<Selection | null>(null);
  /** Narrow screens show the details over the grid only when asked to. */
  const [detailOpen, setDetailOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);

  const cells = useMemo(() => arrangeCells(bagCells(inventory, equipment), filter, sort), [inventory, equipment, filter, sort]);
  const ctx: ActionContext = { inventory, equipment, hp: stats?.hp ?? 0, maxHp: stats?.maxHp ?? 0 };

  // A piece that left the inventory (used up, dropped) is no longer selected.
  const ref = selection && ("uid" in selection.ref ? findItem(inventory, selection.ref.uid) !== undefined : (inventory.stacks[selection.ref.stack] ?? 0) > 0) ? selection.ref : null;
  const index = ref && selection ? selection.index : null;
  // After equipping, the piece is in its slot: keep it selected there.
  const gridIndex = ref && index !== null && "uid" in ref && isPlaced(inventory, equipment, ref.uid) ? null : index;

  const select = (next: ItemRef, at: number | null) => setSelection({ ref: next, index: at });

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

  // E: equip or use, X: drop (plan §7). Arrows and Enter live on the grid itself.
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

  const used = usedCells(inventory, equipment);
  const confirmDef = sheet?.kind === "confirm" ? findItem(inventory, sheet.ref.uid)?.def : undefined;
  const selectedUid = ref && "uid" in ref ? ref.uid : null;
  const selectSlot = (uid: string) => {
    select({ uid }, null);
    setDetailOpen(true);
  };

  return (
    <div className={`inv${ref && detailOpen ? " inv--detail" : ""}`} data-testid="inventory-tab">
      <section className="inv__left" aria-label="Postać">
        <div className="inv__stage">
          <EquipmentSlots kind="garments" inventory={inventory} equipment={equipment} selectedUid={selectedUid} onSelect={selectSlot} />
          <CharacterPreview />
        </div>
        <EquipmentSlots kind="weapons" inventory={inventory} equipment={equipment} selectedUid={selectedUid} onSelect={selectSlot} />
        <StatsPanel stats={stats} />
      </section>
      <section className="inv__mid" aria-label="Torba">
        <GridFilters value={filter} onChange={setFilter} />
        <ItemGrid
          cells={cells}
          capacity={inventory.capacity}
          selectedKey={ref ? refKey(ref) : null}
          selectedIndex={gridIndex}
          handlers={{
            onSelect: (r, i) => {
              select(r, i);
              setDetailOpen(true);
            },
            onDefault: runDefault,
            onDetails: (r, i) => {
              select(r, i);
              setDetailOpen(true);
            },
          }}
        />
        <footer className="inv__foot">
          <span className={`inv__count${used >= inventory.capacity ? " inv__count--full" : ""}`} data-testid="inventory-count">
            {used} / {inventory.capacity}
          </span>
          <button type="button" className="inv__sort" onClick={() => setSort(NEXT_SORT[sort])}>
            Sortuj: {SORT_LABEL[sort]}
          </button>
        </footer>
      </section>
      <section className="inv__right" aria-label="Szczegóły">
        <button type="button" className="inv__back" aria-label="Zamknij szczegóły" onClick={() => setDetailOpen(false)}>
          ✕
        </button>
        <ItemDetail selected={ref} inventory={inventory} equipment={equipment} actions={actions} onAction={(id) => act(id)} />
      </section>
      {sheet?.kind === "mods" && (
        <ModOverlay
          weaponUid={sheet.uid}
          inventory={inventory}
          equipment={equipment}
          onInstall={(modUid) => intents.installMod(sheet.uid, modUid)}
          onRemove={(slot) => intents.removeMod(sheet.uid, slot)}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === "quantity" && (
        <QuantityPicker
          stack={sheet.ref.stack}
          inventory={inventory}
          onCancel={() => setSheet(null)}
          onConfirm={(qty) => {
            intents.dropItem(sheet.ref, qty);
            setSheet(null);
          }}
        />
      )}
      {sheet?.kind === "confirm" && confirmDef && (
        <ConfirmSheet
          def={confirmDef}
          onCancel={() => setSheet(null)}
          onConfirm={() => {
            intents.dropItem(sheet.ref, 1);
            setSheet(null);
          }}
        />
      )}
    </div>
  );
};
