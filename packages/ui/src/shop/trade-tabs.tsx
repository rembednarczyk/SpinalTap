import { useState } from "react";
import {
  CYBERWARE_CATALOG,
  type CyberwareId,
  type CyberwareSlot,
  type ItemCategory,
  type Locale,
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
import { formatNumber, useLocale } from "../i18n/number";
import type { Translate } from "../i18n/t";
import { useT } from "../i18n/use-t";
import { rarityLabel } from "../inventory/item-text";
import type { TradeItemVm } from "../store/ui-store";
import { useShopIntents, useUi } from "../use-ui";
import { CapacityBar, CapacityCost, useCapacityFit } from "./capacity-bar";

const slotLabel = (t: Translate, slot: CyberwareSlot): string => t(`character.slot.${slot}`);
const SLOTS: readonly CyberwareSlot[] = ["optics", "nervous", "skeleton", "arms"];

const CATEGORIES = ["weapon", "consumable", "garment", "cyberware", "mod", "junk"] as const;
const hasLabel = (c: ItemCategory): c is (typeof CATEGORIES)[number] => (CATEGORIES as readonly string[]).includes(c);
/** A category as the counter names it; ammo has no label. */
const categoryLabel = (t: Translate, c: ItemCategory): string => (hasLabel(c) ? t(`shop.category.${c}`) : "");

const IMPLANTS = (Object.keys(CYBERWARE_CATALOG) as CyberwareId[]).filter((id) => CYBERWARE_CATALOG[id].price > 0);

const eur = (locale: Locale, n: number) => `${formatNumber(locale, n)} €$`;

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

const ImplantOffers = ({ terms }: { readonly terms: ShopTerms }) => (
  <>
    <CapacityBar />
    {IMPLANTS.map((id) => (
      <ImplantOffer key={id} id={id} terms={terms} />
    ))}
  </>
);

/** One implant on offer, with its capacity cost; one over the limit cannot be bought (ADR-0032). */
const ImplantOffer = ({ id, terms }: { readonly id: CyberwareId; readonly terms: ShopTerms }) => {
  const t = useT();
  const locale = useLocale();
  const eddies = useUi((s) => s.eddies);
  const loadout = useUi((s) => s.cyberware);
  const freeCells = useUi((s) => s.trade.freeCells);
  const intents = useShopIntents();
  const fit = useCapacityFit(id);
  const def = CYBERWARE_CATALOG[id];
  const price = priceWithTerms(def.price, terms);
  const installed = loadout[def.slot] === id;
  const replaces = !installed ? loadout[def.slot] : undefined;
  return (
    <article className={`shop__item${installed ? " shop__item--installed" : ""}`} data-testid={`implant-${id}`}>
      <div className="shop__slot">{slotLabel(t, def.slot)}</div>
      <h3 className="shop__name">{def.name}</h3>
      <p className="shop__desc">{def.description}</p>
      <CapacityCost fit={fit} />
      {replaces && <p className="shop__warn">{t("shop.replaces", { name: CYBERWARE_CATALOG[replaces].name })}</p>}
      {replaces && freeCells < 1 && <p className="shop__warn">{t("shop.noRoomImplant")}</p>}
      <button type="button" className="shop__buy" disabled={installed || eddies < price || fit.over} onClick={() => intents.buyCyberware(id)}>
        {installed ? t("shop.installed") : fit.over ? t("shop.overLimit") : t("shop.implant", { price: eur(locale, price) })}
      </button>
    </article>
  );
};

const StockOffer = ({ entry, terms }: { readonly entry: StockEntry; readonly terms: ShopTerms }) => {
  const t = useT();
  const locale = useLocale();
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
    slot = t("shop.stack", { count: have });
    room = entry.item === "medkit" ? medkitRoom > 0 : room || have % STACKABLE_CATALOG[entry.item].stack !== 0;
  } else if (entry.kind === "ammo") {
    slot = t("shop.ammo");
    room = true;
  } else {
    slot = `${categoryLabel(t, itemSummary(entry.item).category)} · ${rarityLabel(t, entry.rarity)}`;
  }
  const description = entry.kind === "stack" && entry.item === "medkit" ? `${shopItemDescription(entry.item)} ${t("shop.medkitUse")}` : shopItemDescription(entry.item);
  return (
    <article className={`shop__item${entry.kind === "item" ? rarityClass(entry) : ""}`}>
      <div className="shop__slot">{slot}</div>
      <h3 className="shop__name">{stockName(entry)}</h3>
      <p className="shop__desc">{description}</p>
      <button type="button" className="shop__buy" disabled={eddies < price || !room} onClick={() => intents.buyItem(entry.item)}>
        {t("shop.buy", { price: eur(locale, price) })}
      </button>
    </article>
  );
};

const BackpackOffer = () => {
  const t = useT();
  const locale = useLocale();
  const eddies = useUi((s) => s.eddies);
  const capacity = useUi((s) => s.trade.capacity);
  const intents = useShopIntents();
  const price = backpackPrice({ capacity });
  return (
    <article className="shop__item" data-testid="shop-backpack">
      <div className="shop__slot">{t("shop.backpack.slot", { count: capacity })}</div>
      <h3 className="shop__name">{t("shop.backpack.name")}</h3>
      <p className="shop__desc">{t("shop.backpack.desc")}</p>
      <button type="button" className="shop__buy" disabled={price === null || eddies < price} onClick={() => intents.upgradeBackpack()}>
        {price === null ? t("shop.backpack.max") : t("shop.buy", { price: eur(locale, price) })}
      </button>
    </article>
  );
};

/** What Seki carries that this trader buys, with the price per piece (and for a whole stack). */
export const SellTab = ({ shopId, terms }: { readonly shopId: ShopId; readonly terms: ShopTerms }) => {
  const t = useT();
  const locale = useLocale();
  const items = useUi((s) => s.trade.items).filter((i) => shopBuys(shopId, i.defId));
  const intents = useShopIntents();
  if (items.length === 0) return <p className="shop__empty">{t("shop.sell.none")}</p>;
  return (
    <ul className="shop__lines" data-testid="shop-sell">
      {items.map((item) => {
        const unit = sellPrice({ def: item.defId, rarity: item.rarity ?? "common", ...(item.condition === null ? {} : { condition: item.condition }) }, terms);
        const blocked = item.inUse ? t("shop.inUse") : unit === 0 ? t("shop.worthless") : null;
        return (
          <li key={item.key} className={`shop__line${rarityClass(item)}`} data-testid="shop-sell-line">
            <span className="shop__line-name">
              {item.name}
              {item.qty > 1 && ` × ${item.qty}`}
            </span>
            <span className="shop__line-meta">
              {item.rarity ? rarityLabel(t, item.rarity) : categoryLabel(t, item.category)}
              {item.condition !== null && ` · ${t("shop.condition", { pct: item.condition })}`}
            </span>
            <button type="button" className="shop__buy" disabled={blocked !== null} onClick={() => intents.sellItem(item.ref, 1)}>
              {blocked ?? t("shop.sell", { price: eur(locale, unit) })}
            </button>
            {blocked === null && item.qty > 1 && (
              <button type="button" className="shop__buy" onClick={() => intents.sellItem(item.ref, item.qty)}>
                {t("shop.sellAll", { price: eur(locale, unit * item.qty) })}
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
  const t = useT();
  const locale = useLocale();
  const eddies = useUi((s) => s.eddies);
  const trade = useUi((s) => s.trade);
  const intents = useShopIntents();
  const [useParts, setUseParts] = useState(true);
  const damaged = trade.items.filter((i) => i.category === "garment" && i.condition !== null && i.condition < 100);
  if (damaged.length === 0) return <p className="shop__empty">{t("shop.repair.none")}</p>;
  return (
    <>
      <label className="shop__parts">
        <input type="checkbox" checked={useParts} disabled={trade.weaponParts === 0} onChange={(e) => setUseParts(e.target.checked)} />{" "}
        {t("shop.repair.parts", { count: trade.weaponParts })}
      </label>
      <ul className="shop__lines" data-testid="shop-repair">
        {damaged.map((item) => {
          const parts = useParts ? trade.weaponParts : 0;
          const quote = repairQuote({ def: item.defId, rarity: item.rarity ?? "common", condition: item.condition ?? 100 }, parts, parts);
          return (
            <li key={item.key} className={`shop__line${rarityClass(item)}`} data-testid="shop-repair-line">
              <span className="shop__line-name">{item.name}</span>
              <span className="shop__line-meta">
                {t("shop.condition", { pct: item.condition ?? 100 })}
                {quote.parts > 0 && ` · ${t("shop.repair.partsUsed", { count: quote.parts })}`}
              </span>
              <button type="button" className="shop__buy" disabled={eddies < quote.price} onClick={() => intents.repairItem(item.key, parts)}>
                {t("shop.repair", { price: eur(locale, quote.price) })}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
};

/** Implants in Seki's body (taken out free) and in her bag (fitted for a quarter of the value). */
/** An implant in the bag, fitted for a fee unless it would go over the capacity (ADR-0032). */
const BagImplant = ({ item, terms }: { readonly item: TradeItemVm & { defId: CyberwareId }; readonly terms: ShopTerms }) => {
  const t = useT();
  const locale = useLocale();
  const eddies = useUi((s) => s.eddies);
  const loadout = useUi((s) => s.cyberware);
  const intents = useShopIntents();
  const fit = useCapacityFit(item.defId);
  const def = CYBERWARE_CATALOG[item.defId];
  const fee = installFee({ def: item.defId, rarity: item.rarity ?? "common" }, terms);
  const installed = loadout[def.slot] === item.defId;
  const replaces = installed ? undefined : loadout[def.slot];
  return (
    <li className={`shop__line${rarityClass(item)}`} data-testid="shop-bag-implant">
      <span className="shop__line-name">{def.name}</span>
      <span className="shop__line-meta">
        {slotLabel(t, def.slot)}
        {replaces && ` · ${t("shop.replacesStowed", { name: CYBERWARE_CATALOG[replaces].name })}`}
      </span>
      <CapacityCost fit={fit} />
      <button type="button" className="shop__buy" disabled={installed || eddies < fee || fit.over} onClick={() => intents.installCyberwareItem(item.key)}>
        {installed ? t("shop.alreadyInstalled") : fit.over ? t("shop.overLimit") : t("shop.mount", { price: eur(locale, fee) })}
      </button>
    </li>
  );
};

export const ImplantsTab = ({ terms }: { readonly terms: ShopTerms }) => {
  const t = useT();
  const loadout = useUi((s) => s.cyberware);
  const trade = useUi((s) => s.trade);
  const intents = useShopIntents();
  const bag = trade.items.filter((i): i is TradeItemVm & { defId: CyberwareId } => isCyberwareId(i.defId));
  return (
    <>
      <CapacityBar />
      <h3 className="shop__section">{t("shop.fromBag")}</h3>
      {bag.length === 0 ? (
        <p className="shop__empty">{t("shop.bag.none")}</p>
      ) : (
        <ul className="shop__lines" data-testid="shop-bag-implants">
          {bag.map((item) => (
            <BagImplant key={item.key} item={item} terms={terms} />
          ))}
        </ul>
      )}
      <h3 className="shop__section">{t("shop.implanted")}</h3>
      <ul className="shop__lines" data-testid="shop-installed">
        {SLOTS.map((slot) => {
          const id = loadout[slot];
          return (
            <li key={slot} className="shop__line">
              <span className="shop__line-name">{id ? CYBERWARE_CATALOG[id].name : t("shop.empty")}</span>
              <span className="shop__line-meta">{slotLabel(t, slot)}</span>
              {id && (
                <button type="button" className="shop__buy" disabled={trade.freeCells < 1} onClick={() => intents.removeCyberware(slot)}>
                  {trade.freeCells < 1 ? t("shop.noRoom") : t("shop.remove")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
};
