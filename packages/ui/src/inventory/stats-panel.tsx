import type { Locale } from "@seki/core";
import { formatNumber, useLocale } from "../i18n/number";
import { useT } from "../i18n/use-t";
import type { CharacterStatsVm } from "../store/ui-store";

const pct = (n: number) => `${Math.round(n * 100)}%`;
const oneIn = (locale: Locale) => (n: number) => formatNumber(locale, n, { maximumFractionDigits: 1 });

/** HP, armor per zone, crits and the aim cone of the weapon in hand, as the game counts them. */
export const StatsPanel = ({ stats }: { stats: CharacterStatsVm | null }) => {
  const t = useT();
  const one = oneIn(useLocale());
  if (!stats) return null;
  const a = stats.armor;
  return (
    <dl className="inv__stats" data-testid="stats-panel">
      <div className="inv__stat">
        <dt>HP</dt>
        <dd>
          {Math.ceil(stats.hp)}/{stats.maxHp}
        </dd>
      </div>
      <div className="inv__stat" title={t("inventory.stats.armorHint")}>
        <dt>{t("inventory.stats.armor")}</dt>
        <dd>{t("inventory.stats.armorValue", { head: one(a.head), torso: one(a.torso), arm: one(a.arm), leg: one(a.leg) })}</dd>
      </div>
      <div className="inv__stat">
        <dt>{t("inventory.stats.crit")}</dt>
        <dd>
          {pct(stats.critChance)} ×{one(stats.critMultiplier)}
        </dd>
      </div>
      <div className="inv__stat">
        <dt>{t("inventory.stats.spread")}</dt>
        <dd>{stats.spread === null ? t("inventory.stats.none") : `${one(stats.spread)}°`}</dd>
      </div>
    </dl>
  );
};
