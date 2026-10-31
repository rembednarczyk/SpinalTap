import {
  AMMO_CATALOG,
  type Equipment,
  type InventoryState,
  type ItemRef,
  MOD_CATALOG,
  type ModSlot,
  type StatLine,
  compareItems,
  findItem,
  isGarmentId,
  isModId,
  isWeaponId,
  stackCount,
  weaponStatsOf,
} from "@seki/core";
import { useLocale } from "../i18n/number";
import { useT, useText } from "../i18n/use-t";
import { ActionBar, type ActionId, type ItemAction } from "./actions";
import { description, formatDelta, formatStat, itemName, kindLabel, modSlotLabel, rarityLabel, slotNoun, statLabel } from "./item-text";

/** Change against the piece in the slot: arrow and colour, always with the number too. */
export const StatDelta = ({ line }: { line: StatLine }) => {
  const locale = useLocale();
  if (line.current === null) return <span className="stat-delta stat-delta--none">-</span>;
  if (line.trend === null) return <span className="stat-delta stat-delta--same">=</span>;
  const delta = line.value - line.current;
  return (
    <span className={`stat-delta stat-delta--${line.trend}`} data-testid={`delta-${line.key}`}>
      {line.trend === "better" ? "▲" : "▼"} {formatDelta(locale, line.key, delta)}
    </span>
  );
};

/** Name, kind, description, numbers beside the equipped piece, and the actions. */
export const ItemDetail = ({
  selected,
  inventory,
  equipment,
  actions,
  onAction,
}: {
  selected: ItemRef | null;
  inventory: InventoryState;
  equipment: Equipment;
  actions: readonly ItemAction[];
  onAction: (id: ActionId) => void;
}) => {
  const t = useT();
  const tx = useText();
  const locale = useLocale();
  const compare = selected ? compareItems(inventory, equipment, selected) : null;
  if (!selected || !compare) {
    return (
      <div className="inv__detail inv__detail--empty" data-testid="item-detail">
        <p className="inv__hint">{t("inventory.detail.hint")}</p>
      </div>
    );
  }
  const item = "uid" in selected ? findItem(inventory, selected.uid) : undefined;
  const def = item ? item.def : "stack" in selected ? selected.stack : null;
  if (def === null) return null;
  const tier = item ? rarityLabel(t, item.rarity) : null;
  const against = compare.against ? findItem(inventory, compare.against) : undefined;
  const stats = item && isWeaponId(item.def) ? weaponStatsOf(inventory, item.uid) : null;
  const mods = item?.mods ? Object.entries(item.mods) : [];
  return (
    <div className={`inv__detail${item ? ` rarity-text--${item.rarity}` : ""}`} data-testid="item-detail">
      <header className="inv__detail-head">
        <h3 className="inv__detail-name">{itemName(tx, def)}</h3>
        {tier && <span className={`inv__tier inv__tier--${item!.rarity}`}>{tier}</span>}
      </header>
      <div className="inv__kind">
        {kindLabel(t, def)}
        {"stack" in selected && ` · ${t("inventory.detail.have", { count: stackCount(inventory, selected.stack) })}`}
      </div>
      <p className="inv__desc">{description(tx, def)}</p>
      {stats?.ammo && (
        <div className="inv__meta">{t("inventory.detail.loaded", { loaded: item?.loaded ?? 0, magazine: stats.magazine, ammo: tx(AMMO_CATALOG[stats.ammo].name) })}</div>
      )}
      {item && isGarmentId(item.def) && <div className="inv__meta">{t("inventory.detail.condition", { pct: Math.round(item.condition ?? 100) })}</div>}
      {mods.length > 0 && (
        <div className="inv__meta">
          {t("inventory.detail.mods", {
            mods: mods
              .map(([slot, uid]) => {
                const m = findItem(inventory, uid);
                return m && isModId(m.def) ? `${tx(MOD_CATALOG[m.def].name)} (${modSlotLabel(t, slot as ModSlot).toLowerCase()})` : null;
              })
              .filter(Boolean)
              .join(", "),
          })}
        </div>
      )}
      {compare.lines.length > 0 && (
        <table className="inv__compare" data-testid="item-compare">
          {compare.lines.some((l) => l.current !== null) && (
            <thead>
              <tr>
                <th />
                <th>{t("inventory.detail.this")}</th>
                <th>{against ? itemName(tx, against.def) : t("inventory.detail.worn")}</th>
                <th />
              </tr>
            </thead>
          )}
          <tbody>
            {compare.lines.map((l) => (
              <tr key={l.key} className={l.trend ? `inv__row--${l.trend}` : undefined}>
                <th scope="row">{statLabel(t, l.key)}</th>
                <td>{formatStat(locale, l.key, l.value)}</td>
                <td>{l.current === null ? "" : formatStat(locale, l.key, l.current)}</td>
                <td>
                  <StatDelta line={l} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {compare.equipped && <p className="inv__note">{t("inventory.detail.equipped")}</p>}
      {compare.slot && !compare.equipped && !compare.against && <p className="inv__note">{t("inventory.detail.slotEmpty", { slot: slotNoun(t, compare.slot) })}</p>}
      <ActionBar actions={actions} onAction={onAction} />
    </div>
  );
};
