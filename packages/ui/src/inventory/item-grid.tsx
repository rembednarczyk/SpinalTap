import { type BagCell, type ItemRef, type Locale, RARITIES, type Rarity, itemIcon } from "@seki/core";
import { type CSSProperties, type KeyboardEvent, type PointerEvent, useRef } from "react";
import { compareText } from "../i18n/number";
import { type Translate, type TranslateText, textTranslator } from "../i18n/t";
import { useT, useText } from "../i18n/use-t";
import { ItemIcon } from "../icons/item-icon";
import { RARITY_INK, SELECT_INK } from "../icons/rarity-ink";
import { CATEGORY_ORDER, FILTERS, type GridFilter, categoryOf, itemName, matchesFilter, rarityLabel, shortName } from "./item-text";

export type GridSort = "category" | "rarity" | "name";

export const NEXT_SORT: Readonly<Record<GridSort, GridSort>> = { category: "rarity", rarity: "name", name: "category" };

/** Grid columns (plan §7: 6 × 4 cells of 52 px). */
export const GRID_COLUMNS = 6;
/** A press held this long opens the details (touch). */
export const LONG_PRESS_MS = 400;
/** Two taps on the same cell within this window are the default action. */
export const DOUBLE_TAP_MS = 350;

export const refOf = (cell: BagCell): ItemRef => (cell.kind === "item" ? { uid: cell.item.uid } : { stack: cell.id });
export const refKey = (ref: ItemRef): string => ("uid" in ref ? `u:${ref.uid}` : `s:${ref.stack}`);

const defOf = (cell: BagCell) => (cell.kind === "item" ? cell.item.def : cell.id);
const rarityOf = (cell: BagCell): Rarity => (cell.kind === "item" ? cell.item.rarity : "common");

/** The bag filtered and sorted for the grid. Order within equal keys stays pick-up order. */
export const arrangeCells = (cells: readonly BagCell[], filter: GridFilter, sort: GridSort, locale: Locale): BagCell[] => {
  const shown = cells.filter((c) => matchesFilter(defOf(c), filter));
  const tx = textTranslator(locale);
  const byName = (a: BagCell, b: BagCell) => compareText(locale, itemName(tx, defOf(a)), itemName(tx, defOf(b)));
  const byCategory = (a: BagCell, b: BagCell) => CATEGORY_ORDER.indexOf(categoryOf(defOf(a))) - CATEGORY_ORDER.indexOf(categoryOf(defOf(b)));
  const byRarity = (a: BagCell, b: BagCell) => RARITIES.indexOf(rarityOf(b)) - RARITIES.indexOf(rarityOf(a));
  const order = sort === "category" ? [byCategory] : sort === "rarity" ? [byRarity, byCategory] : [byName];
  return shown
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      for (const f of order) {
        const d = f(a.c, b.c);
        if (d !== 0) return d;
      }
      return a.i - b.i;
    })
    .map((x) => x.c);
};

export const GridFilters = ({ value, onChange }: { value: GridFilter; onChange: (f: GridFilter) => void }) => {
  const t = useT();
  return (
    <div className="inv__filters" role="tablist" aria-label={t("inventory.filters")}>
      {FILTERS.map((id) => (
        <button key={id} type="button" role="tab" aria-selected={value === id} className={`inv__filter${value === id ? " inv__filter--on" : ""}`} onClick={() => onChange(id)}>
          {t(`inventory.filter.${id}`)}
        </button>
      ))}
    </div>
  );
};

export interface CellHandlers {
  readonly onSelect: (ref: ItemRef, index: number) => void;
  readonly onDefault: (ref: ItemRef) => void;
  readonly onDetails: (ref: ItemRef, index: number) => void;
}

/** Rarity label short enough for a cell corner; the full one is in the details and the cell's name. */
const tierShort = (t: Translate, rarity: Exclude<Rarity, "common">): string => t(`inventory.rarityShort.${rarity}`);

const label = (t: Translate, tx: TranslateText, cell: BagCell): string => {
  const name = itemName(tx, defOf(cell));
  const qty = cell.kind === "stack" ? ` × ${cell.qty}` : "";
  const tier = cell.kind === "item" && cell.item.rarity !== "common" ? `, ${rarityLabel(t, cell.item.rarity)}` : "";
  return `${name}${qty}${tier}`;
};

/**
 * Frame of a cell with an icon (ADR-0073), inline because `.inv__cell` comes after `.rarity--*`
 * in styles.css and would win: the rarity's colour on the 2 px border, and when selected a white
 * ring inside it instead of the magenta outline over it (a rare frame is magenta too).
 */
export const iconCellStyle = (rarity: Rarity, selected: boolean, icon = true): CSSProperties | undefined => {
  // Text cells keep their frame from CSS (G-410) but take the same white ring when selected, so
  // one grid has one sign of a selection and magenta only ever means rare.
  const frame = !icon || rarity === "common" ? {} : { borderColor: RARITY_INK[rarity] };
  const ring = selected ? { outline: "none", boxShadow: `inset 0 0 0 2px ${SELECT_INK}` } : {};
  const style = { ...frame, ...ring };
  return Object.keys(style).length > 0 ? style : undefined;
};

/**
 * One cell. A tap or click selects; a second one soon after on the same cell, a right click or
 * Enter does the default action; a held touch opens the details. No dragging.
 */
export const ItemCell = ({ cell, index, selected, handlers }: { cell: BagCell; index: number; selected: boolean; handlers: CellHandlers }) => {
  const t = useT();
  const tx = useText();
  const press = useRef<{ timer: ReturnType<typeof setTimeout> | null; type: string; long: boolean }>({ timer: null, type: "mouse", long: false });
  const lastTap = useRef(-Infinity);
  const ref = refOf(cell);
  const stop = () => {
    if (press.current.timer) clearTimeout(press.current.timer);
    press.current.timer = null;
  };
  const rarity = cell.kind === "item" ? cell.item.rarity : null;
  // Kinds without an icon yet keep the text cell (ADR-0073: `itemIcon` gives null).
  const icon = itemIcon(defOf(cell));
  return (
    <button
      type="button"
      className={`inv__cell${icon ? " inv__cell--icon" : ""}${selected ? " inv__cell--on" : ""}${rarity && rarity !== "common" ? ` rarity--${rarity}` : ""}`}
      style={iconCellStyle(rarityOf(cell), selected, icon !== null)}
      data-testid="item-cell"
      data-def={defOf(cell)}
      aria-pressed={selected}
      aria-label={label(t, tx, cell)}
      onPointerDown={(e: PointerEvent) => {
        stop();
        press.current = { type: e.pointerType, long: false, timer: null };
        if (e.pointerType === "mouse") return;
        press.current.timer = setTimeout(() => {
          press.current.long = true;
          handlers.onDetails(ref, index);
        }, LONG_PRESS_MS);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onClick={() => {
        if (press.current.long) {
          press.current.long = false;
          return;
        }
        const now = performance.now();
        const double = now - lastTap.current < DOUBLE_TAP_MS;
        lastTap.current = double ? -Infinity : now;
        if (double) handlers.onDefault(ref);
        else handlers.onSelect(ref, index);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        // A held finger raises contextmenu on Android; only the mouse's right button acts.
        if (press.current.type !== "mouse") return;
        handlers.onSelect(ref, index);
        handlers.onDefault(ref);
      }}
    >
      {icon && <ItemIcon icon={icon} rarity={rarityOf(cell)} />}
      <span className="inv__cell-name">{shortName(tx, defOf(cell))}</span>
      {cell.kind === "stack" && <span className="inv__cell-qty">{cell.qty}</span>}
      {rarity && rarity !== "common" && <span className="inv__cell-tier">{tierShort(t, rarity)}</span>}
    </button>
  );
};

/**
 * The bag as a 6-column grid with empty cells up to the capacity. Arrow keys move the
 * selection, Enter does the default action.
 */
export const ItemGrid = ({
  cells,
  capacity,
  selectedKey,
  selectedIndex,
  handlers,
}: {
  cells: readonly BagCell[];
  capacity: number;
  selectedKey: string | null;
  selectedIndex: number | null;
  handlers: CellHandlers;
}) => {
  const t = useT();
  const empty = Math.max(0, capacity - cells.length);
  const onKey = (e: KeyboardEvent) => {
    if (cells.length === 0) return;
    const at = selectedIndex ?? -1;
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -GRID_COLUMNS, ArrowDown: GRID_COLUMNS };
    const d = step[e.key];
    if (d !== undefined) {
      e.preventDefault();
      const next = Math.max(0, Math.min(cells.length - 1, at < 0 ? 0 : at + d));
      handlers.onSelect(refOf(cells[next]!), next);
    } else if (e.key === "Enter" && at >= 0 && cells[at]) {
      e.preventDefault();
      handlers.onDefault(refOf(cells[at]));
    }
  };
  return (
    <div className="inv__grid" data-testid="item-grid" role="group" aria-label={t("inventory.section.bag")} onKeyDown={onKey}>
      {cells.map((c, i) => {
        const key = refKey(refOf(c));
        const selected = selectedKey === key && (c.kind === "item" || selectedIndex === null || selectedIndex === i);
        return <ItemCell key={c.kind === "item" ? c.item.uid : `${c.id}#${i}`} cell={c} index={i} selected={selected} handlers={handlers} />;
      })}
      {Array.from({ length: empty }, (_, i) => (
        <div key={`empty${i}`} className="inv__cell inv__cell--empty" aria-hidden="true" />
      ))}
    </div>
  );
};
