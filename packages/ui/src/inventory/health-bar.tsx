import { type ItemRef, STACKABLE_CATALOG, isConsumableId } from "@seki/core";
import { useT } from "../i18n/use-t";

const pctOf = (n: number, max: number) => Math.max(0, Math.min(100, (n / Math.max(1, max)) * 100));

/** HP the selected piece would bring back now: food and medkits heal up to max, nothing else does. */
export const healPreview = (ref: ItemRef | null, hp: number, maxHp: number): number => {
  if (!ref || !("stack" in ref) || !isConsumableId(ref.stack)) return 0;
  const heal = STACKABLE_CATALOG[ref.stack].heal;
  return Math.max(0, Math.min(maxHp, hp + heal) - hp);
};

/**
 * The HUD's health bar inside the inventory, where Seki eats and patches up while the HUD is
 * hidden. A selected consumable lights the part of the bar it would fill.
 */
export const HealthBar = ({ hp, maxHp, selected }: { readonly hp: number; readonly maxHp: number; readonly selected: ItemRef | null }) => {
  const t = useT();
  const gain = Math.round(healPreview(selected, hp, maxHp));
  const hpPct = pctOf(hp, maxHp);
  return (
    <div className="inv__health" data-testid="inventory-health">
      <div className="inv__hp" role="meter" aria-label={t("hud.health")} aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={Math.ceil(hp)}>
        <div className={`inv__hp-fill${hpPct < 30 ? " inv__hp-fill--low" : ""}`} style={{ width: `${hpPct}%` }} />
        {gain > 0 && <div className="inv__hp-gain" style={{ left: `${hpPct}%`, width: `${pctOf(gain, maxHp)}%` }} />}
      </div>
      <div className="inv__hp-label">
        <span>
          {Math.ceil(hp)} / {maxHp}
        </span>
        {gain > 0 && <span className="inv__hp-plus">{t("inventory.health.gain", { hp: gain })}</span>}
      </div>
    </div>
  );
};
