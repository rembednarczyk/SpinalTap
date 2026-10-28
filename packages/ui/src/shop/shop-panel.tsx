import { useEffect, useState } from "react";
import { SHOPS, type ShopId, type ShopTerms, shopTerms } from "@seki/core";
import { useIntents, useUi } from "../use-ui";
import { BuyTab, ImplantsTab, RepairTab, SellTab } from "./trade-tabs";

type Tab = "buy" | "implants" | "sell" | "repair";

const TABS: Readonly<Record<ShopId, readonly { readonly id: Tab; readonly label: string }[]>> = {
  clinic: [
    { id: "buy", label: "Kup" },
    { id: "implants", label: "Wszczepy" },
    { id: "sell", label: "Sprzedaj" },
  ],
  oyaji: [
    { id: "buy", label: "Kup" },
    { id: "sell", label: "Sprzedaj" },
    { id: "repair", label: "Naprawa" },
  ],
  // Street food (ADR-0026): Fumiko sells, buys nothing back.
  yatai: [{ id: "buy", label: "Kup" }],
};

interface Counter {
  readonly label: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly quote: string;
  readonly talk: string;
  readonly leave: string;
  readonly surcharge: string;
}

const COUNTER: Readonly<Record<ShopId, Counter>> = {
  clinic: {
    label: "Klinika doktora Mori",
    eyebrow: "Klinika · Shinsekai 7",
    title: "Doktor Mori",
    quote: "„Płacisz z góry. Znieczulenie wliczone, gwarancja nie.”",
    talk: "Porozmawiaj z Mori",
    leave: "Wyjdź z kliniki",
    surcharge: "Klinika ci nie ufa",
  },
  oyaji: {
    label: "Stragan Oyajiego",
    eyebrow: "Stragan · Targ pod estakadą",
    title: "Oyaji",
    quote: "„Wszystko działa. Prawie wszystko. Skupuję, naprawiam, nie pytam skąd.”",
    talk: "Porozmawiaj z Oyajim",
    leave: "Odejdź od straganu",
    surcharge: "Oyaji ci nie ufa",
  },
  yatai: {
    label: "Ramen u Fumiko",
    eyebrow: "Stragan z ramenem · Targ pod estakadą",
    title: "Fumiko",
    quote: "„Tonkotsu albo yakitori. Innego menu nie ma i nie będzie.”",
    talk: "Porozmawiaj z Fumiko",
    leave: "Odejdź od straganu",
    surcharge: "Fumiko ci nie ufa",
  },
};

/** What the owner's standing with the player does to the prices, or null at list price. */
const termsNote = (terms: ShopTerms, counter: Counter): string | null => {
  if (terms.multiplier === 1) return null;
  const pct = Math.round(Math.abs(terms.multiplier - 1) * 100);
  return terms.multiplier < 1 ? `Stała klientka · rabat ${pct}%` : `${counter.surcharge} · dopłata ${pct}%`;
};

/**
 * A shop counter (plan §6): doktor Mori's clinic or Oyaji's stall, with tabs to buy, sell and,
 * per shop, fit implants or mend clothes. Prices follow the owner's opinion of Seki and are
 * quoted with the same core functions the simulation charges with.
 */
export const ShopPanel = () => {
  const open = useUi((s) => s.shopOpen);
  const shopId = useUi((s) => s.shopId);
  const intents = useIntents();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "e" || e.key === "E") intents.closeShop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, intents]);

  if (!open) return null;
  // Keyed by shop so every visit starts on the "Kup" tab.
  return <ShopCounter key={shopId} shopId={shopId} />;
};

const ShopCounter = ({ shopId }: { readonly shopId: ShopId }) => {
  const eddies = useUi((s) => s.eddies);
  const rep = useUi((s) => s.reputation[SHOPS[shopId].owner]);
  const intents = useIntents();
  const [tab, setTab] = useState<Tab>("buy");
  const counter = COUNTER[shopId];
  const terms = shopTerms(rep);
  const note = termsNote(terms, counter);
  return (
    <div className={`shop shop--${shopId}`} data-testid="shop" role="dialog" aria-label={counter.label}>
      <header className="shop__head">
        <div>
          <div className="shop__eyebrow">{counter.eyebrow}</div>
          <h2 className="shop__title">{counter.title}</h2>
          <p className="shop__quote">{counter.quote}</p>
        </div>
        <div className="shop__wallet">€$ {eddies.toLocaleString("pl-PL")}</div>
      </header>
      {note && (
        <div className={`shop__terms${terms.multiplier < 1 ? " shop__terms--good" : ""}`} data-testid="shop-terms">
          {note}
        </div>
      )}
      <div className="shop__tabs" role="tablist">
        {TABS[shopId].map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`shop__tab${tab === t.id ? " shop__tab--active" : ""}`}
            data-testid={`shop-tab-${t.id}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
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
          {counter.talk}
        </button>
        <button type="button" className="shop__close" onClick={() => intents.closeShop()}>
          <span className="dialogue__key">E</span> {counter.leave}
        </button>
      </div>
    </div>
  );
};
