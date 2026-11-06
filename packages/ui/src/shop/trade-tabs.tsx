import { useState } from "react";
import {
  CYBERWARE_CATALOG,
  type CyberwareId,
  type CyberwareSlot,
  type ItemCategory,
  type ItemIconKey,
  type Locale,
  MIN_ITEM_LEVEL,
  type Rarity,
  SHOPS,
  STACKABLE_CATALOG,
  type ShopId,
  type ShopTerms,
  type StockEntry,
  ammoIcon,
  backpackPrice,
  fullService,
  implantOffer,
  installFee,
  installedGrade,
  isCyberwareId,
  isGradedImplant,
  isInstalled,
  isPreciousGrade,
  itemIcon,
  itemSummary,
  offersEntry,
  priceWithTerms,
  repairQuote,
  sellPrice,
  shopBuys,
  shopItemDescription,
  stockGrade,
  stockName,
  stockPrice,
} from "@seki/core";
import { formatNumber, useLocale } from "../i18n/number";
import type { Translate } from "../i18n/t";
import { useT, useText } from "../i18n/use-t";
import { ItemDefIcon, ItemIcon } from "../icons/item-icon";
import { DeckLine } from "../inventory/deck-line";
import { rarityLabel } from "../inventory/item-text";
import { RespecSection } from "./respec-section";
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

/** The level of a piece for the price functions, when it has one (ADR-0059). */
const levelOf = (item: TradeItemVm): { level?: number } => (item.level === undefined ? {} : { level: item.level });

const rarityClass = (item: { readonly rarity: TradeItemVm["rarity"] }) => (item.rarity && item.rarity !== "common" ? ` rarity--${item.rarity}` : "");

/** Why an offer is greyed out: on basic terms it stays under the counter (ADR-0070). */
const LockedWhy = () => {
  const t = useT();
  return (
    <p className="shop__warn" data-testid="shop-locked-why">
      {t("shop.locked.reason")}
    </p>
  );
};

const lockedClass = (locked: boolean) => (locked ? " shop__item--locked" : "");

/** The icon of an offer (ADR-0073): the ammo box's or the item's; every kind has one since stage 2. */
const offerIcon = (entry: StockEntry): ItemIconKey => (entry.kind === "ammo" ? ammoIcon(entry.item) : itemIcon(entry.item));

/** What the counter sells; at the clinic the implants first (bought and installed on the spot). */
export const BuyTab = ({ shopId, terms }: { readonly shopId: ShopId; readonly terms: ShopTerms }) => {
  const shop = SHOPS[shopId];
  return (
    <div className="shop__grid">
      {shop.implants && <ImplantOffers terms={terms} />}
      {shop.stock.map((entry) => (
        <StockOffer key={entry.item} entry={entry} terms={terms} />
      ))}
      {shop.backpacks && <BackpackOffer terms={terms} />}
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

/**
 * One implant on offer, with its capacity cost; one over the limit cannot be bought (ADR-0032). A
 * cyberdeck comes in the tier of the standing and at the player's level, priced like the core does.
 */
const ImplantOffer = ({ id, terms }: { readonly id: CyberwareId; readonly terms: ShopTerms }) => {
  const t = useT();
  const tx = useText();
  const locale = useLocale();
  const eddies = useUi((s) => s.eddies);
  const loadout = useUi((s) => s.cyberware);
  const implantGrades = useUi((s) => s.implantGrades);
  const level = useUi((s) => s.level);
  const freeCells = useUi((s) => s.trade.freeCells);
  const intents = useShopIntents();
  const fit = useCapacityFit(id);
  const def = CYBERWARE_CATALOG[id];
  const offer = implantOffer(id, terms.tier, level);
  const price = priceWithTerms(offer.listPrice, terms);
  const installed = isInstalled({ cyberware: loadout, implantGrades }, id, offer.grade);
  const replaces = !installed ? loadout[def.slot] : undefined;
  // The simulation refuses to drop a graded deck for want of a cell (ADR-0059), so the offer waits.
  const keepsDeck = replaces !== undefined && freeCells < 1 && isPreciousGrade(installedGrade({ cyberware: loadout, implantGrades }, def.slot));
  const locked = !installed && !fullService(terms);
  return (
    <article className={`shop__item shop__item--icon${installed ? " shop__item--installed" : ""}${lockedClass(locked)}`} data-testid={`implant-${id}`}>
      <ItemIcon icon={itemIcon(id)} framed />
      <div className="shop__slot">
        {slotLabel(t, def.slot)}
        {offer.grade && ` · ${rarityLabel(t, offer.grade.rarity)} · ${t("inventory.detail.level", { level: offer.grade.level })}`}
      </div>
      <h3 className="shop__name">{tx(def.name)}</h3>
      <p className="shop__desc">{tx(def.description)}</p>
      {offer.grade && <DeckLine id={id} grade={offer.grade} className="shop__desc" />}
      <CapacityCost fit={fit} />
      {replaces && <p className="shop__warn">{t("shop.replaces", { name: tx(CYBERWARE_CATALOG[replaces].name) })}</p>}
      {replaces && freeCells < 1 && <p className="shop__warn">{t(keepsDeck ? "shop.noRoomDeck" : "shop.noRoomImplant")}</p>}
      {locked && <LockedWhy />}
      <button type="button" className="shop__buy" disabled={installed || locked || eddies < price || fit.over || keepsDeck} onClick={() => intents.buyCyberware(id)}>
        {installed
          ? t("shop.installed")
          : locked
            ? t("shop.locked")
            : fit.over
              ? t("shop.overLimit")
              : keepsDeck
                ? t("shop.noRoom")
                : t("shop.implant", { price: eur(locale, price) })}
      </button>
    </article>
  );
};

const StockOffer = ({ entry, terms }: { readonly entry: StockEntry; readonly terms: ShopTerms }) => {
  const t = useT();
  const tx = useText();
  const locale = useLocale();
  const eddies = useUi((s) => s.eddies);
  const medkits = useUi((s) => s.medkits);
  const medkitRoom = useUi((s) => s.medkitRoom);
  const trade = useUi((s) => s.trade);
  const level = useUi((s) => s.level);
  const intents = useShopIntents();
  const price = stockPrice(entry, terms, level);
  const locked = !offersEntry(entry, terms);
  const icon = offerIcon(entry);
  let slot: string;
  let rarity: Rarity = "common";
  let room = trade.freeCells > 0;
  if (entry.kind === "stack") {
    const have = entry.item === "medkit" ? medkits : (trade.items.find((i) => i.key === entry.item)?.qty ?? 0);
    slot = t("shop.stack", { count: have });
    room = entry.item === "medkit" ? medkitRoom > 0 : room || have % STACKABLE_CATALOG[entry.item].stack !== 0;
  } else if (entry.kind === "ammo") {
    slot = t("shop.ammo");
    room = true;
  } else {
    // The tier the standing brings out and the player's level (ADR-0059).
    const grade = stockGrade(entry, terms.tier, level);
    rarity = grade.rarity;
    const lvl = grade.level === undefined ? "" : ` · ${t("inventory.detail.level", { level: grade.level })}`;
    slot = `${categoryLabel(t, itemSummary(entry.item).category)} · ${rarityLabel(t, grade.rarity)}${lvl}`;
  }
  const description = entry.kind === "stack" && entry.item === "medkit" ? `${tx(shopItemDescription(entry.item))} ${t("shop.medkitUse")}` : tx(shopItemDescription(entry.item));
  return (
    <article className={`shop__item shop__item--icon${rarityClass({ rarity })}${lockedClass(locked)}`} data-testid={`stock-${entry.item}`}>
      <ItemIcon icon={icon} rarity={rarity} framed />
      <div className="shop__slot">{slot}</div>
      <h3 className="shop__name">{tx(stockName(entry))}</h3>
      <p className="shop__desc">{description}</p>
      {locked && <LockedWhy />}
      <button type="button" className="shop__buy" disabled={locked || eddies < price || !room} onClick={() => intents.buyItem(entry.item)}>
        {locked ? t("shop.locked") : t("shop.buy", { price: eur(locale, price) })}
      </button>
    </article>
  );
};

const BackpackOffer = ({ terms }: { readonly terms: ShopTerms }) => {
  const t = useT();
  const locale = useLocale();
  const eddies = useUi((s) => s.eddies);
  const capacity = useUi((s) => s.trade.capacity);
  const intents = useShopIntents();
  const price = backpackPrice({ capacity });
  const locked = price !== null && !fullService(terms);
  return (
    <article className={`shop__item${lockedClass(locked)}`} data-testid="shop-backpack">
      <div className="shop__slot">{t("shop.backpack.slot", { count: capacity })}</div>
      <h3 className="shop__name">{t("shop.backpack.name")}</h3>
      <p className="shop__desc">{t("shop.backpack.desc")}</p>
      {locked && <LockedWhy />}
      <button type="button" className="shop__buy" disabled={price === null || locked || eddies < price} onClick={() => intents.upgradeBackpack()}>
        {price === null ? t("shop.backpack.max") : locked ? t("shop.locked") : t("shop.buy", { price: eur(locale, price) })}
      </button>
    </article>
  );
};

/** What Seki carries that this trader buys, with the price per piece (and for a whole stack). */
export const SellTab = ({ shopId, terms }: { readonly shopId: ShopId; readonly terms: ShopTerms }) => {
  const t = useT();
  const tx = useText();
  const locale = useLocale();
  const items = useUi((s) => s.trade.items).filter((i) => shopBuys(shopId, i.defId));
  const intents = useShopIntents();
  if (items.length === 0) return <p className="shop__empty">{t("shop.sell.none")}</p>;
  return (
    <ul className="shop__lines" data-testid="shop-sell">
      {items.map((item) => {
        const unit = sellPrice({ def: item.defId, rarity: item.rarity ?? "common", ...(item.condition === null ? {} : { condition: item.condition }), ...levelOf(item) }, terms);
        const blocked = item.inUse ? t("shop.inUse") : unit === 0 ? t("shop.worthless") : null;
        return (
          <li key={item.key} className={`shop__line${rarityClass(item)}`} data-testid="shop-sell-line">
            <ItemDefIcon def={item.defId} rarity={item.rarity ?? "common"} className="shop__line-icon" />
            <span className="shop__line-name">
              {tx(item.name)}
              {item.qty > 1 && ` × ${item.qty}`}
            </span>
            <span className="shop__line-meta">
              {item.rarity ? rarityLabel(t, item.rarity) : categoryLabel(t, item.category)}
              {item.level !== undefined && ` · ${t("inventory.detail.level", { level: item.level })}`}
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
export const RepairTab = ({ terms }: { readonly terms: ShopTerms }) => {
  const t = useT();
  const tx = useText();
  const locale = useLocale();
  const eddies = useUi((s) => s.eddies);
  const trade = useUi((s) => s.trade);
  const intents = useShopIntents();
  const [useParts, setUseParts] = useState(true);
  const damaged = trade.items.filter((i) => i.category === "garment" && i.condition !== null && i.condition < 100);
  if (damaged.length === 0) return <p className="shop__empty">{t("shop.repair.none")}</p>;
  const locked = !fullService(terms);
  return (
    <>
      {locked && <LockedWhy />}
      <label className="shop__parts">
        <input type="checkbox" checked={useParts} disabled={trade.weaponParts === 0} onChange={(e) => setUseParts(e.target.checked)} />{" "}
        {t("shop.repair.parts", { count: trade.weaponParts })}
      </label>
      <ul className="shop__lines" data-testid="shop-repair">
        {damaged.map((item) => {
          const parts = useParts ? trade.weaponParts : 0;
          const quote = repairQuote({ def: item.defId, rarity: item.rarity ?? "common", condition: item.condition ?? 100, ...levelOf(item) }, parts, parts);
          return (
            <li key={item.key} className={`shop__line${rarityClass(item)}`} data-testid="shop-repair-line">
              <span className="shop__line-name">{tx(item.name)}</span>
              <span className="shop__line-meta">
                {t("shop.condition", { pct: item.condition ?? 100 })}
                {quote.parts > 0 && ` · ${t("shop.repair.partsUsed", { count: quote.parts })}`}
              </span>
              <button type="button" className="shop__buy" disabled={locked || eddies < quote.price} onClick={() => intents.repairItem(item.key, parts)}>
                {locked ? t("shop.locked") : t("shop.repair", { price: eur(locale, quote.price) })}
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
  const tx = useText();
  const locale = useLocale();
  const eddies = useUi((s) => s.eddies);
  const loadout = useUi((s) => s.cyberware);
  const implantGrades = useUi((s) => s.implantGrades);
  const intents = useShopIntents();
  const fit = useCapacityFit(item.defId);
  const def = CYBERWARE_CATALOG[item.defId];
  const rarity = item.rarity ?? "common";
  const fee = installFee({ def: item.defId, rarity, ...levelOf(item) }, terms);
  const grade = isGradedImplant(item.defId) ? { rarity, level: item.level ?? MIN_ITEM_LEVEL } : undefined;
  const installed = isInstalled({ cyberware: loadout, implantGrades }, item.defId, grade);
  const replaces = installed ? undefined : loadout[def.slot];
  const locked = !installed && !fullService(terms);
  return (
    <li className={`shop__line${rarityClass(item)}`} data-testid="shop-bag-implant">
      <span className="shop__line-name">{tx(def.name)}</span>
      <span className="shop__line-meta">
        {slotLabel(t, def.slot)}
        {replaces && ` · ${t("shop.replacesStowed", { name: tx(CYBERWARE_CATALOG[replaces].name) })}`}
      </span>
      <CapacityCost fit={fit} />
      <button type="button" className="shop__buy" disabled={installed || locked || eddies < fee || fit.over} onClick={() => intents.installCyberwareItem(item.key)}>
        {installed ? t("shop.alreadyInstalled") : locked ? t("shop.locked") : fit.over ? t("shop.overLimit") : t("shop.mount", { price: eur(locale, fee) })}
      </button>
    </li>
  );
};

export const ImplantsTab = ({ terms }: { readonly terms: ShopTerms }) => {
  const t = useT();
  const tx = useText();
  const loadout = useUi((s) => s.cyberware);
  const trade = useUi((s) => s.trade);
  const intents = useShopIntents();
  const bag = trade.items.filter((i): i is TradeItemVm & { defId: CyberwareId } => isCyberwareId(i.defId));
  const locked = !fullService(terms);
  return (
    <>
      <CapacityBar />
      {locked && <LockedWhy />}
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
              <span className="shop__line-name">{id ? tx(CYBERWARE_CATALOG[id].name) : t("shop.empty")}</span>
              <span className="shop__line-meta">{slotLabel(t, slot)}</span>
              {id && (
                <button type="button" className="shop__buy" disabled={locked || trade.freeCells < 1} onClick={() => intents.removeCyberware(slot)}>
                  {locked ? t("shop.locked") : trade.freeCells < 1 ? t("shop.noRoom") : t("shop.remove")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <RespecSection terms={terms} />
    </>
  );
};
