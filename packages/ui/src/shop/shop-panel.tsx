import { useEffect } from "react";
import { CYBERWARE_CATALOG, type CyberwareId, ITEM_CATALOG, MAX_STACK, type ShopTerms, priceWithTerms, shopTerms } from "@seki/core";
import { useIntents, useUi } from "../use-ui";

const SLOT_LABEL: Record<string, string> = { optics: "Optyka", nervous: "Układ nerwowy", skeleton: "Szkielet", arms: "Ramiona" };

const IMPLANTS = (Object.keys(CYBERWARE_CATALOG) as CyberwareId[]).filter((id) => CYBERWARE_CATALOG[id].price > 0);

/** What Mori's standing with the player does to the prices, or null at list price. */
const termsNote = (terms: ShopTerms): string | null => {
  if (terms.multiplier === 1) return null;
  const pct = Math.round(Math.abs(terms.multiplier - 1) * 100);
  return terms.multiplier < 1 ? `Stała klientka · rabat ${pct}%` : `Klinika ci nie ufa · dopłata ${pct}%`;
};

/** Doktor Mori's clinic: buy-and-install implants, medkits. Prices follow the clinic's opinion of Seki. */
export const ShopPanel = () => {
  const open = useUi((s) => s.shopOpen);
  const eddies = useUi((s) => s.eddies);
  const loadout = useUi((s) => s.cyberware);
  const medkits = useUi((s) => s.medkits);
  const clinicRep = useUi((s) => s.reputation.clinic);
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
  const terms = shopTerms(clinicRep);
  const note = termsNote(terms);
  const medkitPrice = priceWithTerms(ITEM_CATALOG.medkit.price, terms);
  return (
    <div className="shop" data-testid="shop" role="dialog" aria-label="Klinika doktora Mori">
      <header className="shop__head">
        <div>
          <div className="shop__eyebrow">Klinika · Shinsekai 7</div>
          <h2 className="shop__title">Doktor Mori</h2>
          <p className="shop__quote">„Płacisz z góry. Znieczulenie wliczone, gwarancja nie.”</p>
        </div>
        <div className="shop__wallet">€$ {eddies.toLocaleString("pl-PL")}</div>
      </header>
      {note && (
        <div className={`shop__terms${terms.multiplier < 1 ? " shop__terms--good" : ""}`} data-testid="shop-terms">
          {note}
        </div>
      )}
      <div className="shop__grid">
        {IMPLANTS.map((id) => {
          const def = CYBERWARE_CATALOG[id];
          const price = priceWithTerms(def.price, terms);
          const installed = loadout[def.slot] === id;
          const replaces = !installed ? loadout[def.slot] : undefined;
          return (
            <article key={id} className={`shop__item${installed ? " shop__item--installed" : ""}`}>
              <div className="shop__slot">{SLOT_LABEL[def.slot]}</div>
              <h3 className="shop__name">{def.name}</h3>
              <p className="shop__desc">{def.description}</p>
              {replaces && <p className="shop__warn">Zastąpi: {CYBERWARE_CATALOG[replaces].name}</p>}
              <button
                type="button"
                className="shop__buy"
                disabled={installed || eddies < price}
                onClick={() => intents.buyCyberware(id)}
              >
                {installed ? "Zainstalowane" : `Wszczep · ${price} €$`}
              </button>
            </article>
          );
        })}
        <article className="shop__item">
          <div className="shop__slot">Ekwipunek · masz {medkits}</div>
          <h3 className="shop__name">{ITEM_CATALOG.medkit.name}</h3>
          <p className="shop__desc">{ITEM_CATALOG.medkit.description} Użycie: [H].</p>
          <button
            type="button"
            className="shop__buy"
            disabled={eddies < medkitPrice || medkits >= MAX_STACK}
            onClick={() => intents.buyItem("medkit")}
          >
            Kup · {medkitPrice} €$
          </button>
        </article>
      </div>
      <div className="shop__actions">
        <button type="button" className="shop__talk" onClick={() => intents.talkToShopkeeper()}>
          Porozmawiaj z Mori
        </button>
        <button type="button" className="shop__close" onClick={() => intents.closeShop()}>
          <span className="dialogue__key">E</span> Wyjdź z kliniki
        </button>
      </div>
    </div>
  );
};
