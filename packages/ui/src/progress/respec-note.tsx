import { INITIAL_PROGRESSION, SHOPS, canRespec, fullService, respecPrice, shopTerms } from "@seki/core";
import { formatNumber, useLocale } from "../i18n/number";
import { useT } from "../i18n/use-t";
import { useUi } from "../use-ui";

/**
 * The respec on the Progress tab (ADR-0059, stages 3 and 7): a clinic service, so the tab only
 * says where and for how much, quoted with the core function Mori's counter charges with.
 */
export const RespecNote = () => {
  const t = useT();
  const locale = useLocale();
  const level = useUi((s) => s.level);
  const attributes = useUi((s) => s.attributes);
  const perks = useUi((s) => s.perks);
  const standing = useUi((s) => s.reputation[SHOPS.clinic.owner]);
  const terms = shopTerms(standing);
  const something = canRespec({ ...INITIAL_PROGRESSION, level, attributes, perks });
  const text = !fullService(terms)
    ? t("progress.respecTerms")
    : something
      ? t("progress.respec", { price: `${formatNumber(locale, respecPrice(level, terms))} €$` })
      : t("respec.nothing");
  return (
    <section className="progress__respec" data-testid="progress-respec">
      <h3 className="sheet__h">{t("respec.heading")}</h3>
      <p className="progress__respec-text">{text}</p>
    </section>
  );
};
