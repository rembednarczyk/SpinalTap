import { useState } from "react";
import {
  CYBERWARE_CATALOG,
  type CyberwareId,
  type CyberwareSlot,
  RARITY,
  SHOPS,
  STACKABLE_CATALOG,
  type ShopId,
  type ShopTerms,
  type StockEntry,
  backpackPrice,
  installFee,
  isCyberwareId,
  itemSummary,
  priceWithTerms,
  repairQuote,
  sellPrice,
  shopBuys,
  shopItemDescription,
  stockListPrice,
  stockName,
} from "@seki/core";
import type { TradeItemVm } from "../store/ui-store";
import { useShopIntents, useUi } from "../use-ui";

const SLOT_LABEL: Readonly<Record<CyberwareSlot, string>> = { optics: "Optyka", nervous: "Układ nerwowy", skeleton: "Szkielet", arms: "Ramiona" };
const SLOTS: readonly CyberwareSlot[] = ["optics", "nervous", "skeleton", "arms"];

const CATEGORY_LABEL: Readonly<Record<string, string>> = {
  weapon: "Broń",
  consumable: "Medycyna",
  garment: "Odzież",
  cyberware: "Wszczep",
  mod: "Modyfikacja",
  junk: "Złom",
};

const IMPLANTS = (Object.keys(CYBERWARE_CATALOG) as CyberwareId[]).filter((id) => CYBERWARE_CATALOG[id].price > 0);

const eur = (n: number) => `${n.toLocaleString("pl-PL")} €$`;

const rarityClass = (item: { readonly rarity: TradeItemVm["rarity"] }) => (item.rarity && item.rarity !== "common" ? ` rarity--${item.rarity}` : "");

/** What the counter sells; at the clinic the implants first (bought and installed on the spot). */
export const BuyTab = ({ shopId, terms }: { readonly shopId: ShopId; readonly terms: ShopTerms }) => {
  const shop = SHOPS[shopId];
  return (
    <div className="shop__grid">
      {shop.implants && <ImplantOffers terms={terms} />}
      {shop.stock.map((entry) => (
        <StockOffer key={entry.item} entry={entry} terms={terms} />
      ))}
      {shop.backpacks && <BackpackOffer />}
    </div>
  );
};

const ImplantOffers = ({ terms }: { readonly terms: ShopTerms }) => {
  const eddies = useUi((s) => s.eddies);
  const loadout = useUi((s) => s.cyberware);
  const freeCells = useUi((s) => s.trade.freeCells);
  const intents = useShopIntents();
  return (
    <>
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
            {replaces && freeCells < 1 && <p className="shop__warn">Brak miejsca: stary implant przepadnie</p>}
            <button type="button" className="shop__buy" disabled={installed || eddies < price} onClick={() => intents.buyCyberware(id)}>
              {installed ? "Zainstalowane" : `Wszczep · ${eur(price)}`}
            </button>
          </article>
        );
      })}
    </>
  );
};

const StockOffer = ({ entry, terms }: { readonly entry: StockEntry; readonly terms: ShopTerms }) => {
  const eddies = useUi((s) => s.eddies);
  const medkits = useUi((s) => s.medkits);
  const medkitRoom = useUi((s) => s.medkitRoom);
  const trade = useUi((s) => s.trade);
  const intents = useShopIntents();
  const price = priceWithTerms(stockListPrice(entry), terms);
  let slot: string;
  let room = trade.freeCells > 0;
  if (entry.kind === "stack") {
    const have = entry.item === "medkit" ? medkits : (trade.items.find((i) => i.key === entry.item)?.qty ?? 0);
    slot = `Ekwipunek · masz ${have}`;
    room = entry.item === "medkit" ? medkitRoom > 0 : room || have % STACKABLE_CATALOG[entry.item].stack !== 0;
  } else if (entry.kind === "ammo") {
    slot = "Amunicja";
    room = true;
  } else {
    slot = `${CATEGORY_LABEL[itemSummary(entry.item).category]} · ${RARITY[entry.rarity].label}`;
  }
  const description = entry.kind === "stack" && entry.item === "medkit" ? `${shopItemDescription(entry.item)} Użycie: [H].` : shopItemDescription(entry.item);
  return (
    <article className={`shop__item${entry.kind === "item" ? rarityClass(entry) : ""}`}>
      <div className="shop__slot">{slot}</div>
      <h3 className="shop__name">{stockName(entry)}</h3>
      <p className="shop__desc">{description}</p>
      <button type="button" className="shop__buy" disabled={eddies < price || !room} onClick={() => intents.buyItem(entry.item)}>
        Kup · {eur(price)}
      </button>
    </article>
  );
};

const BackpackOffer = () => {
  const eddies = useUi((s) => s.eddies);
  const capacity = useUi((s) => s.trade.capacity);
  const intents = useShopIntents();
  const price = backpackPrice({ capacity });
  return (
    <article className="shop__item" data-testid="shop-backpack">
      <div className="shop__slot">Plecak · {capacity} miejsc</div>
      <h3 className="shop__name">Większy plecak</h3>
      <p className="shop__desc">Sześć miejsc więcej. Oyaji ma dwa rozmiary, potem już tylko walizki.</p>
      <button type="button" className="shop__buy" disabled={price === null || eddies < price} onClick={() => intents.upgradeBackpack()}>
        {price === null ? "Największy plecak" : `Kup · ${eur(price)}`}
      </button>
    </article>
  );
};

/** What Seki carries that this trader buys, with the price per piece (and for a whole stack). */
export const SellTab = ({ shopId, terms }: { readonly shopId: ShopId; readonly terms: ShopTerms }) => {
  const items = useUi((s) => s.trade.items).filter((i) => shopBuys(shopId, i.defId));
  const intents = useShopIntents();
  if (items.length === 0) return <p className="shop__empty">Nie masz nic, co by tu kupili.</p>;
  return (
    <ul className="shop__lines" data-testid="shop-sell">
      {items.map((item) => {
        const unit = sellPrice({ def: item.defId, rarity: item.rarity ?? "common", ...(item.condition === null ? {} : { condition: item.condition }) }, terms);
        const blocked = item.inUse ? "W użyciu" : unit === 0 ? "Bez wartości" : null;
        return (
          <li key={item.key} className={`shop__line${rarityClass(item)}`} data-testid="shop-sell-line">
            <span className="shop__line-name">
              {item.name}
              {item.qty > 1 && ` × ${item.qty}`}
            </span>
            <span className="shop__line-meta">
              {item.rarity ? RARITY[item.rarity].label : CATEGORY_LABEL[item.category]}
              {item.condition !== null && ` · stan ${item.condition}%`}
            </span>
            <button type="button" className="shop__buy" disabled={blocked !== null} onClick={() => intents.sellItem(item.ref, 1)}>
              {blocked ?? `Sprzedaj · ${eur(unit)}`}
            </button>
            {blocked === null && item.qty > 1 && (
              <button type="button" className="shop__buy" onClick={() => intents.sellItem(item.ref, item.qty)}>
                Wszystkie · {eur(unit * item.qty)}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
};

/** Damaged clothes, worn or in the bag; weapon parts can go into the repair. */
export const RepairTab = () => {
  const eddies = useUi((s) => s.eddies);
  const trade = useUi((s) => s.trade);
  const intents = useShopIntents();
  const [useParts, setUseParts] = useState(true);
  const damaged = trade.items.filter((i) => i.category === "garment" && i.condition !== null && i.condition < 100);
  if (damaged.length === 0) return <p className="shop__empty">Ubrania całe. Wróć, jak cię ktoś podziurawi.</p>;
  return (
    <>
      <label className="shop__parts">
        <input type="checkbox" checked={useParts} disabled={trade.weaponParts === 0} onChange={(e) => setUseParts(e.target.checked)} /> Użyj części broni (masz{" "}
        {trade.weaponParts}, każda −25 €$)
      </label>
      <ul className="shop__lines" data-testid="shop-repair">
        {damaged.map((item) => {
          const parts = useParts ? trade.weaponParts : 0;
          const quote = repairQuote({ def: item.defId, rarity: item.rarity ?? "common", condition: item.condition ?? 100 }, parts, parts);
          return (
            <li key={item.key} className={`shop__line${rarityClass(item)}`} data-testid="shop-repair-line">
              <span className="shop__line-name">{item.name}</span>
              <span className="shop__line-meta">
                stan {item.condition}%{quote.parts > 0 && ` · części: ${quote.parts}`}
              </span>
              <button type="button" className="shop__buy" disabled={eddies < quote.price} onClick={() => intents.repairItem(item.key, parts)}>
                Napraw · {eur(quote.price)}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
};

/** Implants in Seki's body (taken out free) and in her bag (fitted for a quarter of the value). */
export const ImplantsTab = ({ terms }: { readonly terms: ShopTerms }) => {
  const eddies = useUi((s) => s.eddies);
  const loadout = useUi((s) => s.cyberware);
  const trade = useUi((s) => s.trade);
  const intents = useShopIntents();
  const bag = trade.items.filter((i): i is TradeItemVm & { defId: CyberwareId } => isCyberwareId(i.defId));
  return (
    <>
      <h3 className="shop__section">Z plecaka</h3>
      {bag.length === 0 ? (
        <p className="shop__empty">W plecaku nie masz żadnego wszczepu.</p>
      ) : (
        <ul className="shop__lines" data-testid="shop-bag-implants">
          {bag.map((item) => {
            const def = CYBERWARE_CATALOG[item.defId];
            const fee = installFee({ def: item.defId, rarity: item.rarity ?? "common" }, terms);
            const installed = loadout[def.slot] === item.defId;
            const replaces = installed ? undefined : loadout[def.slot];
            return (
              <li key={item.key} className={`shop__line${rarityClass(item)}`} data-testid="shop-bag-implant">
                <span className="shop__line-name">{def.name}</span>
                <span className="shop__line-meta">
                  {SLOT_LABEL[def.slot]}
                  {replaces && ` · zastąpi: ${CYBERWARE_CATALOG[replaces].name} (wróci do plecaka)`}
                </span>
                <button type="button" className="shop__buy" disabled={installed || eddies < fee} onClick={() => intents.installCyberwareItem(item.key)}>
                  {installed ? "Już wszczepiony" : `Zamontuj · ${eur(fee)}`}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <h3 className="shop__section">Wszczepione</h3>
      <ul className="shop__lines" data-testid="shop-installed">
        {SLOTS.map((slot) => {
          const id = loadout[slot];
          return (
            <li key={slot} className="shop__line">
              <span className="shop__line-name">{id ? CYBERWARE_CATALOG[id].name : "pusto"}</span>
              <span className="shop__line-meta">{SLOT_LABEL[slot]}</span>
              {id && (
                <button type="button" className="shop__buy" disabled={trade.freeCells < 1} onClick={() => intents.removeCyberware(slot)}>
                  {trade.freeCells < 1 ? "Brak miejsca" : "Wymontuj · za darmo"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
};
