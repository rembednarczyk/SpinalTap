import { useEffect, useState } from "react";
import { SHOPS, type ShopId, type ShopTerms, shopTerms } from "@seki/core";
import { formatNumber, useLocale } from "../i18n/number";
import type { Translate } from "../i18n/t";
import { useT } from "../i18n/use-t";
import { useShopIntents, useUi } from "../use-ui";
import { BuyTab, ImplantsTab, RepairTab, SellTab } from "./trade-tabs";

type Tab = "buy" | "implants" | "sell" | "repair";

const TABS: Readonly<Record<ShopId, readonly Tab[]>> = {
  clinic: ["buy", "implants", "sell"],
  oyaji: ["buy", "sell", "repair"],
  // Street food (ADR-0026): Fumiko sells, buys nothing back.
  yatai: ["buy"],
};

/** What the owner's standing with the player does to the prices, or null at list price. */
const termsNote = (t: Translate, terms: ShopTerms, shopId: ShopId): string | null => {
  if (terms.multiplier === 1) return null;
  const pct = Math.round(Math.abs(terms.multiplier - 1) * 100);
  return terms.multiplier < 1 ? t("shop.terms.discount", { pct }) : t("shop.terms.surcharge", { who: t(`shop.${shopId}.surcharge`), pct });
};

/**
 * A shop counter (plan §6): doktor Mori's clinic or Oyaji's stall, with tabs to buy, sell and,
 * per shop, fit implants or mend clothes. Prices follow the owner's opinion of Seki and are
 * quoted with the same core functions the simulation charges with.
 */
export const ShopPanel = () => {
  const open = useUi((s) => s.shopOpen);
  const shopId = useUi((s) => s.shopId);
  const intents = useShopIntents();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "e" || e.key === "E") intents.closeShop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, intents]);

  if (!open) return null;
  // Keyed by shop so every visit starts on the Buy tab.
  return <ShopCounter key={shopId} shopId={shopId} />;
};

const ShopCounter = ({ shopId }: { readonly shopId: ShopId }) => {
  const t = useT();
  const locale = useLocale();
  const eddies = useUi((s) => s.eddies);
  const rep = useUi((s) => s.reputation[SHOPS[shopId].owner]);
  const intents = useShopIntents();
  const [tab, setTab] = useState<Tab>("buy");
  const terms = shopTerms(rep);
  const note = termsNote(t, terms, shopId);
  return (
    <div className={`shop shop--${shopId}`} data-testid="shop" role="dialog" aria-label={t(`shop.${shopId}.label`)}>
      <header className="shop__head">
        <div>
          <div className="shop__eyebrow">{t(`shop.${shopId}.eyebrow`)}</div>
          <h2 className="shop__title">{t(`shop.${shopId}.title`)}</h2>
          <p className="shop__quote">{t(`shop.${shopId}.quote`)}</p>
        </div>
        <div className="shop__wallet">€$ {formatNumber(locale, eddies)}</div>
      </header>
      {note && (
        <div className={`shop__terms${terms.multiplier < 1 ? " shop__terms--good" : ""}`} data-testid="shop-terms">
          {note}
        </div>
      )}
      <div className="shop__tabs" role="tablist">
        {TABS[shopId].map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`shop__tab${tab === id ? " shop__tab--active" : ""}`}
            data-testid={`shop-tab-${id}`}
            onClick={() => setTab(id)}
          >
            {t(`shop.tab.${id}`)}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === "buy" && <BuyTab shopId={shopId} terms={terms} />}
        {tab === "implants" && <ImplantsTab terms={terms} />}
        {tab === "sell" && <SellTab shopId={shopId} terms={terms} />}
        {tab === "repair" && <RepairTab />}
      </div>
      <div className="shop__actions">
        <button type="button" className="shop__talk" onClick={() => intents.talkToShopkeeper()}>
          {t(`shop.${shopId}.talk`)}
        </button>
        <button type="button" className="shop__close" onClick={() => intents.closeShop()}>
          <span className="dialogue__key">E</span> {t(`shop.${shopId}.leave`)}
        </button>
      </div>
    </div>
  );
};
