import { INITIAL_PROGRESSION, type ShopTerms, canRespec, fullService, respecPrice } from "@seki/core";
import { formatNumber, useLocale } from "../i18n/number";
import { useT } from "../i18n/use-t";
import { useShopIntents, useUi } from "../use-ui";

/**
 * The respec at Mori's clinic (ADR-0059, stage 3): every attribute point and perk rank back to
 * spend, for a price that grows with the level. Quoted with the core function the simulation
 * charges with; the button is shut on basic terms, without the money or with nothing to reset.
 */
export const RespecSection = ({ terms }: { readonly terms: ShopTerms }) => {
  const t = useT();
  const locale = useLocale();
  const intents = useShopIntents();
  const level = useUi((s) => s.level);
  const attributes = useUi((s) => s.attributes);
  const perks = useUi((s) => s.perks);
  const eddies = useUi((s) => s.eddies);
  const price = respecPrice(level, terms);
  const something = canRespec({ ...INITIAL_PROGRESSION, level, attributes, perks });
  const locked = !fullService(terms);
  return (
    <section data-testid="shop-respec">
      <h3 className="shop__section">{t("respec.heading")}</h3>
      <p className="shop__empty">{t("respec.note")}</p>
      <button type="button" className="shop__buy" disabled={locked || !something || eddies < price} onClick={() => intents.respec()}>
        {locked ? t("shop.locked") : something ? t("respec.buy", { price: `${formatNumber(locale, price)} €$` }) : t("respec.nothing")}
      </button>
    </section>
  );
};
