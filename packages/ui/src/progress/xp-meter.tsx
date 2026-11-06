import { formatNumber, useLocale } from "../i18n/number";
import { useT } from "../i18n/use-t";
import { useUi } from "../use-ui";
import { xpProgress } from "./xp";
import "./progress.css";

/**
 * The XP bar (ADR-0059, stage 7): the share of the way to the next level, with the numbers in
 * its label. The HUD draws it under the health bar, the Progress tab at its top.
 */
export const XpMeter = ({ className, testId, showValue = true }: { readonly className: string; readonly testId: string; readonly showValue?: boolean }) => {
  const t = useT();
  const locale = useLocale();
  const level = useUi((s) => s.level);
  const xp = useUi((s) => s.xp);
  const p = xpProgress(level, xp);
  const value = p.top ? t("progress.xpMax") : t("progress.xpValue", { xp: formatNumber(locale, p.into), next: formatNumber(locale, p.span) });
  return (
    <div className={className} data-testid={testId}>
      <div
        className={`${className}-bar`}
        role="meter"
        aria-label={`${t("progress.xp")}: ${value}`}
        aria-valuemin={0}
        aria-valuemax={p.top ? 1 : p.span}
        aria-valuenow={p.top ? 1 : p.into}
      >
        <div className={`${className}-fill`} style={{ width: `${(p.share * 100).toFixed(1)}%` }} />
      </div>
      {showValue && <div className={`${className}-value`}>{value}</div>}
    </div>
  );
};
