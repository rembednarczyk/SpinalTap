import { type Equipment, type InventoryState, bagCells, findItem, usedCells } from "@seki/core";
import { useMemo, useState } from "react";
import { useLocale } from "../i18n/number";
import { useT } from "../i18n/use-t";
import type { CharacterIntents } from "../intents";
import type { CharacterStatsVm } from "../store/ui-store";
import { useCharacterIntents, useUi } from "../use-ui";
import { type ActionContext, ConfirmSheet, QuantityPicker } from "./actions";
import { CharacterPreview } from "./character-preview";
import { EquipmentSlots } from "./equipment-slots";
import { ItemDetail } from "./item-detail";
import { type GridSort, GridFilters, ItemGrid, NEXT_SORT, arrangeCells, refKey } from "./item-grid";
import type { GridFilter } from "./item-text";
import { ModOverlay } from "./mod-overlay";
import { StatsPanel } from "./stats-panel";
import { type InventorySelection, useInventorySelection } from "./use-inventory-selection";

interface PanelProps {
  readonly inventory: InventoryState;
  readonly equipment: Equipment;
  readonly sel: InventorySelection;
}

/** Left: the worn pieces around the 3D preview, the weapon slots and the stats. */
const PaperDoll = ({ inventory, equipment, sel, stats }: PanelProps & { readonly stats: CharacterStatsVm | null }) => {
  const t = useT();
  const selectSlot = (uid: string) => sel.select({ uid }, null);
  return (
    <section className="inv__left" aria-label={t("inventory.section.character")}>
      <div className="inv__stage">
        <EquipmentSlots kind="garments" inventory={inventory} equipment={equipment} selectedUid={sel.selectedUid} onSelect={selectSlot} />
        <CharacterPreview />
      </div>
      <EquipmentSlots kind="weapons" inventory={inventory} equipment={equipment} selectedUid={sel.selectedUid} onSelect={selectSlot} />
      <StatsPanel stats={stats} />
    </section>
  );
};

/** Middle: the bag with its filters, the grid, the cell count and the sort button. */
const BagPanel = ({ inventory, equipment, sel }: PanelProps) => {
  const t = useT();
  const locale = useLocale();
  const [filter, setFilter] = useState<GridFilter>("all");
  const [sort, setSort] = useState<GridSort>("category");
  const cells = useMemo(() => arrangeCells(bagCells(inventory, equipment), filter, sort, locale), [inventory, equipment, filter, sort, locale]);
  const used = usedCells(inventory, equipment);
  return (
    <section className="inv__mid" aria-label={t("inventory.section.bag")}>
      <GridFilters value={filter} onChange={setFilter} />
      <ItemGrid
        cells={cells}
        capacity={inventory.capacity}
        selectedKey={sel.ref ? refKey(sel.ref) : null}
        selectedIndex={sel.gridIndex}
        handlers={{ onSelect: sel.select, onDefault: sel.runDefault, onDetails: sel.select }}
      />
      <footer className="inv__foot">
        <span className={`inv__count${used >= inventory.capacity ? " inv__count--full" : ""}`} data-testid="inventory-count">
          {used} / {inventory.capacity}
        </span>
        <button type="button" className="inv__sort" onClick={() => setSort(NEXT_SORT[sort])}>
          {t("inventory.sort", { order: t(`inventory.sort.${sort}`) })}
        </button>
      </footer>
    </section>
  );
};

/** Right: details of the selection with the comparison and the actions. */
const DetailPanel = ({ inventory, equipment, sel }: PanelProps) => {
  const t = useT();
  return (
    <section className="inv__right" aria-label={t("inventory.section.details")}>
      <button type="button" className="inv__back" aria-label={t("inventory.closeDetails")} onClick={sel.closeDetail}>
        ✕
      </button>
      <ItemDetail selected={sel.ref} inventory={inventory} equipment={equipment} actions={sel.actions} onAction={(id) => sel.act(id)} />
    </section>
  );
};

/** The sheet over the tab: mods of a weapon, how many to drop, or a rare drop to confirm. */
const InventorySheets = ({ inventory, equipment, sel, intents }: PanelProps & { readonly intents: CharacterIntents }) => {
  const sheet = sel.sheet;
  if (sheet?.kind === "mods") {
    return (
      <ModOverlay
        weaponUid={sheet.uid}
        inventory={inventory}
        equipment={equipment}
        onInstall={(modUid) => intents.installMod(sheet.uid, modUid)}
        onRemove={(slot) => intents.removeMod(sheet.uid, slot)}
        onClose={sel.closeSheet}
      />
    );
  }
  if (sheet?.kind === "quantity") {
    return (
      <QuantityPicker
        stack={sheet.ref.stack}
        inventory={inventory}
        onCancel={sel.closeSheet}
        onConfirm={(qty) => {
          intents.dropItem(sheet.ref, qty);
          sel.closeSheet();
        }}
      />
    );
  }
  const confirmDef = sheet?.kind === "confirm" ? findItem(inventory, sheet.ref.uid)?.def : undefined;
  if (sheet?.kind !== "confirm" || !confirmDef) return null;
  return (
    <ConfirmSheet
      def={confirmDef}
      onCancel={sel.closeSheet}
      onConfirm={() => {
        intents.dropItem(sheet.ref, 1);
        sel.closeSheet();
      }}
    />
  );
};

/**
 * Inventory tab of the character screen (plan §7): preview and worn pieces on the left, the
 * bag in the middle, details with the comparison and the actions on the right. Every action
 * goes through an intent and applies at once; the clock stands meanwhile.
 */
export const InventoryTab = () => {
  const intents = useCharacterIntents();
  const inventory = useUi((s) => s.inventory);
  const equipment = useUi((s) => s.equipment);
  const stats = useUi((s) => s.characterStats);
  const ctx: ActionContext = { inventory, equipment, hp: stats?.hp ?? 0, maxHp: stats?.maxHp ?? 0 };
  const sel = useInventorySelection(intents, inventory, equipment, ctx);
  const props = { inventory, equipment, sel };
  return (
    <div className={`inv${sel.ref && sel.detailOpen ? " inv--detail" : ""}`} data-testid="inventory-tab">
      <PaperDoll {...props} stats={stats} />
      <BagPanel {...props} />
      <DetailPanel {...props} />
      <InventorySheets {...props} intents={intents} />
    </div>
  );
};
