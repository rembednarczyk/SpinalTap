import { CYBERWARE_CATALOG, type PurchaseFailure, type ShopId, itemSummary, shopItemName } from "@seki/core";
import type { Presenter } from "./context";

/** Who shakes their head when a trade does not happen. */
const SHOPKEEPER: Readonly<Record<ShopId, string>> = { clinic: "Mori", oyaji: "Oyaji", yatai: "Fumiko" };

const FAILURE_TEXT: Readonly<Record<PurchaseFailure, string>> = {
  "insufficient-funds": "Za mało eddies.",
  "already-installed": "To już masz.",
  "inventory-full": "Nie uniesiesz więcej.",
  refused: "Nie obsługuję takich jak ty.",
  closed: "Zamknięte. Wróć za dnia.",
  "not-found": "Nie masz tego przy sobie.",
  "in-use": "Najpierw to zdejmij.",
  "not-sold-here": "Tego tu nie ma.",
  "not-bought-here": "Tego nie skupuję.",
  worthless: "Nikt za to nie zapłaci.",
  "not-damaged": "Tu nie ma czego naprawiać.",
  "max-capacity": "Większego plecaka nie mam.",
  "empty-slot": "Tam nic nie siedzi.",
  "over-capacity": "Twoje ciało więcej nie uciągnie. Za mało pojemności cyberware.",
};

/** Trade and money: purchases, sales, repairs, implants, transfers and refusals at the counter. */
export const presentTrade: Presenter = ({ bus, audio, toast }) => [
  bus.on("EddiesChanged", (e) => {
    if (e.delta > 0 && e.source === undefined) toast("money", `+${e.delta.toLocaleString("pl-PL")} €$`, "Przelew");
  }),
  bus.on("CyberwareInstalled", (e) => {
    const def = CYBERWARE_CATALOG[e.cyberwareId];
    const old = e.replaced ? CYBERWARE_CATALOG[e.replaced].name : null;
    const text = old === null ? def.description : e.stowed ? `${old} wraca do plecaka` : `Usunięto: ${old}`;
    toast("cyberware", `Wszczepiono: ${def.name}`, text);
    audio.play("purchase");
  }),
  bus.on("CyberwareRemoved", (e) => {
    toast("cyberware", `Wymontowano: ${CYBERWARE_CATALOG[e.cyberwareId].name}`, "Implant w plecaku");
    audio.play("ui-select");
  }),
  bus.on("ItemBought", (e) => {
    const qty = (e.qty ?? 1) > 1 ? ` × ${e.qty}` : "";
    toast("system", `Kupiono: ${shopItemName(e.itemId)}${qty}`, `-${e.price} €$`);
    audio.play("purchase");
  }),
  bus.on("ItemSold", (e) => {
    toast("money", `Sprzedano: ${itemSummary(e.defId).name}${e.qty > 1 ? ` × ${e.qty}` : ""}`, `+${e.price} €$`);
    audio.play("sell");
  }),
  bus.on("ItemRepaired", (e) => {
    toast("system", `Naprawiono: ${itemSummary(e.defId).name}`, e.parts > 0 ? `-${e.price} €$, części: ${e.parts}` : `-${e.price} €$`);
    audio.play("repair");
  }),
  bus.on("CapacityUpgraded", (e) => {
    toast("system", "Większy plecak", `Miejsc: ${e.capacity}`);
    audio.play("purchase");
  }),
  bus.on("PurchaseFailed", (e) => {
    toast("system", `${SHOPKEEPER[e.shopId ?? "clinic"]} kręci głową`, FAILURE_TEXT[e.reason]);
    audio.play("denied");
  }),
];
