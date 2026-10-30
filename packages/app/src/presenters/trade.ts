import { CYBERWARE_CATALOG, itemSummary, shopItemName } from "@seki/core";
import { type Translate, type UiStore, formatNumber, translator } from "@seki/ui";
import type { Presenter } from "./context";

/** The toasts' texts in the language of the settings at the moment of the event (ADR-0056). */
export const uiText = (ui: UiStore): Translate => translator(ui.getState().settings.locale);

/** Trade and money: purchases, sales, repairs, implants, transfers and refusals at the counter. */
export const presentTrade: Presenter = ({ bus, audio, toast, ui }) => [
  bus.on("EddiesChanged", (e) => {
    if (e.delta > 0 && e.source === undefined) toast("money", `+${formatNumber(ui.getState().settings.locale, e.delta)} €$`, uiText(ui)("shop.toast.transfer"));
  }),
  bus.on("CyberwareInstalled", (e) => {
    const t = uiText(ui);
    const def = CYBERWARE_CATALOG[e.cyberwareId];
    const old = e.replaced ? CYBERWARE_CATALOG[e.replaced].name : null;
    const text = old === null ? def.description : t(e.stowed ? "shop.toast.stowed" : "shop.toast.replaced", { name: old });
    toast("cyberware", t("shop.toast.implanted", { name: def.name }), text);
    audio.play("purchase");
  }),
  bus.on("CyberwareRemoved", (e) => {
    const t = uiText(ui);
    toast("cyberware", t("shop.toast.removed", { name: CYBERWARE_CATALOG[e.cyberwareId].name }), t("shop.toast.inBackpack"));
    audio.play("ui-select");
  }),
  bus.on("ItemBought", (e) => {
    const qty = (e.qty ?? 1) > 1 ? ` × ${e.qty}` : "";
    toast("system", `${uiText(ui)("shop.toast.bought", { name: shopItemName(e.itemId) })}${qty}`, `-${e.price} €$`);
    audio.play("purchase");
  }),
  bus.on("ItemSold", (e) => {
    toast("money", `${uiText(ui)("shop.toast.sold", { name: itemSummary(e.defId).name })}${e.qty > 1 ? ` × ${e.qty}` : ""}`, `+${e.price} €$`);
    audio.play("sell");
  }),
  bus.on("ItemRepaired", (e) => {
    const t = uiText(ui);
    toast("system", t("shop.toast.repaired", { name: itemSummary(e.defId).name }), e.parts > 0 ? t("shop.toast.repairParts", { price: e.price, parts: e.parts }) : `-${e.price} €$`);
    audio.play("repair");
  }),
  bus.on("CapacityUpgraded", (e) => {
    const t = uiText(ui);
    toast("system", t("shop.backpack.name"), t("shop.toast.slots", { count: e.capacity }));
    audio.play("purchase");
  }),
  bus.on("PurchaseFailed", (e) => {
    const t = uiText(ui);
    toast("system", t(`shop.refused.${e.shopId ?? "clinic"}`), t(`shop.failure.${e.reason}`));
    audio.play("denied");
  }),
];
