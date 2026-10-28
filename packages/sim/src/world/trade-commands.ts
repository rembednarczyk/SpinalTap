import {
  type DomainState,
  type GameCommand,
  type PurchaseFailure,
  PROTECTEE_KEY,
  SHOPS,
  type ShopId,
  type ShopTerms,
  buyCyberware,
  buyStock,
  findItem,
  hasFlag,
  installCyberwareItem,
  removeCyberware,
  repair,
  sell,
  shopTerms,
  stowImplant,
  upgradeBackpack,
} from "@seki/core";
import { oyajiStallOpen, yataiOpen } from "../content/schedules";
import { deadFlag } from "../systems/death-system";
import type { SimContext } from "./context";
import { applyReputationCause, raiseProgress } from "./domain-ops";

type TradeCommand = Extract<
  GameCommand,
  { type: "buy-cyberware" | "buy-item" | "sell-item" | "repair-item" | "upgrade-capacity" | "install-cyberware-item" | "remove-cyberware" }
>;

/**
 * Mori's clinic never closes; Oyaji trades while his stall is up and he is alive; Fumiko's
 * ramen stall from the afternoon to the small hours (ADR-0026).
 */
export const shopOpen = (domain: DomainState, shop: ShopId): boolean => {
  switch (shop) {
    case "clinic":
      return true;
    case "oyaji":
      return oyajiStallOpen(domain.clock) && !hasFlag(domain.flags, deadFlag(PROTECTEE_KEY));
    case "yatai":
      return yataiOpen(domain.clock);
  }
};

const termsAt = (domain: DomainState, shop: ShopId): ShopTerms => shopTerms(domain.reputation[SHOPS[shop].owner]);

/** The shop a command is for: buying names it, selling must; the rest belong to one shop. */
const shopOf = (cmd: TradeCommand): ShopId => {
  switch (cmd.type) {
    case "buy-item":
      return cmd.shopId ?? "clinic";
    case "sell-item":
      return cmd.shopId;
    case "repair-item":
    case "upgrade-capacity":
      return "oyaji";
    default:
      return "clinic";
  }
};

type Command<K extends TradeCommand["type"]> = Extract<TradeCommand, { type: K }>;

/** What every trade at an open shop works with: the domain before it, the shop, its prices and the two reports. */
interface Counter {
  readonly domain: DomainState;
  readonly shopId: ShopId;
  readonly terms: ShopTerms;
  readonly pockets: Pick<DomainState, "wallet" | "inventory" | "equipment" | "ammo">;
  /** Says why the trade was refused. */
  readonly fail: (reason: PurchaseFailure) => void;
  /** Reports a payment, if anything was paid. */
  readonly charged: (wallet: DomainState["wallet"], price: number) => void;
}

const counterAt = (ctx: SimContext, domain: DomainState, shopId: ShopId, fail: Counter["fail"]): Counter => ({
  domain,
  shopId,
  fail,
  terms: termsAt(domain, shopId),
  pockets: { wallet: domain.wallet, inventory: domain.inventory, equipment: domain.equipment, ammo: domain.ammo },
  charged: (wallet, price) => {
    if (price > 0) ctx.bus.emit("EddiesChanged", { balance: wallet.eddies, delta: -price });
  },
});

const buyImplant = (ctx: SimContext, cmd: Command<"buy-cyberware">, { domain, terms, fail, charged }: Counter): void => {
  const r = buyCyberware(domain.wallet, domain.character, cmd.cyberwareId, terms);
  if (!r.ok) return fail(r.reason);
  const stowed = r.replaced ? stowImplant(domain.inventory, domain.equipment, r.replaced) : { inventory: domain.inventory, item: null };
  ctx.state.domain = { ...domain, wallet: r.wallet, character: r.character, inventory: stowed.inventory };
  charged(r.wallet, r.price);
  if (stowed.item) ctx.bus.emit("ItemAdded", { ref: { uid: stowed.item.uid }, defId: stowed.item.def, qty: 1, source: "clinic" });
  ctx.bus.emit("CyberwareInstalled", { cyberwareId: cmd.cyberwareId, replaced: r.replaced, price: r.price, stowed: stowed.item !== null });
  if (r.price > 0) applyReputationCause(ctx, { type: "clinic-purchase", kind: "cyberware" });
  raiseProgress(ctx, "cyberware_installed");
};

const installImplantFromBag = (ctx: SimContext, cmd: Command<"install-cyberware-item">, { domain, terms, fail, charged }: Counter): void => {
  const r = installCyberwareItem(domain.wallet, domain.character, domain.inventory, domain.equipment, cmd.uid, terms);
  if (!r.ok) return fail(r.reason);
  ctx.state.domain = { ...domain, wallet: r.wallet, character: r.character, inventory: r.inventory };
  charged(r.wallet, r.fee);
  ctx.bus.emit("ItemRemoved", { ref: { uid: cmd.uid }, qty: 1, reason: "installed" });
  if (r.returned) ctx.bus.emit("ItemAdded", { ref: { uid: r.returned.uid }, defId: r.returned.def, qty: 1, source: "clinic" });
  ctx.bus.emit("CyberwareInstalled", { cyberwareId: r.cyberwareId, replaced: r.replaced, price: r.fee, fromBag: true, stowed: r.returned !== null });
  if (r.fee > 0) applyReputationCause(ctx, { type: "clinic-purchase", kind: "cyberware" });
  raiseProgress(ctx, "cyberware_installed");
};

const removeImplant = (ctx: SimContext, cmd: Command<"remove-cyberware">, { domain, fail }: Counter): void => {
  const r = removeCyberware(domain.character, domain.inventory, domain.equipment, cmd.slot);
  if (!r.ok) return fail(r.reason);
  ctx.state.domain = { ...domain, character: r.character, inventory: r.inventory };
  ctx.bus.emit("ItemAdded", { ref: { uid: r.item.uid }, defId: r.item.def, qty: 1, source: "clinic" });
  ctx.bus.emit("CyberwareRemoved", { cyberwareId: r.cyberwareId, slot: cmd.slot });
};

const buyItem = (ctx: SimContext, cmd: Command<"buy-item">, { domain, shopId, terms, pockets, fail, charged }: Counter): void => {
  const r = buyStock(pockets, shopId, cmd.itemId, terms);
  if (!r.ok) return fail(r.reason);
  ctx.state.domain = { ...domain, wallet: r.wallet, inventory: r.inventory, ammo: r.ammo };
  charged(r.wallet, r.price);
  if (r.added) ctx.bus.emit("ItemAdded", { ref: { uid: r.added.uid }, defId: r.added.def, qty: 1, source: "shop" });
  ctx.bus.emit("ItemBought", { itemId: cmd.itemId, price: r.price, shopId, qty: r.qty });
  if (shopId === "clinic") applyReputationCause(ctx, { type: "clinic-purchase", kind: "item" });
};

const sellItem = (ctx: SimContext, cmd: Command<"sell-item">, { domain, shopId, terms, pockets, fail }: Counter): void => {
  const r = sell(pockets, shopId, cmd.ref, cmd.qty, terms);
  if (!r.ok) return fail(r.reason);
  ctx.state.domain = { ...domain, wallet: r.wallet, inventory: r.inventory, ammo: r.ammo };
  ctx.bus.emit("ItemRemoved", { ref: cmd.ref, qty: r.qty, reason: "sold" });
  ctx.bus.emit("ItemSold", { shopId, defId: r.defId, qty: r.qty, price: r.price });
  ctx.bus.emit("EddiesChanged", { balance: r.wallet.eddies, delta: r.price, source: "sale" });
};

const repairItem = (ctx: SimContext, cmd: Command<"repair-item">, { domain, terms, fail, charged }: Counter): void => {
  const item = findItem(domain.inventory, cmd.uid);
  const r = repair(domain.wallet, domain.inventory, cmd.uid, cmd.useParts, terms);
  if (!r.ok || !item) return fail(r.ok ? "not-found" : r.reason);
  ctx.state.domain = { ...domain, wallet: r.wallet, inventory: r.inventory };
  charged(r.wallet, r.price);
  if (r.parts > 0) ctx.bus.emit("ItemRemoved", { ref: { stack: "weapon_parts" }, qty: r.parts, reason: "repair" });
  ctx.bus.emit("ItemRepaired", { uid: cmd.uid, defId: item.def, price: r.price, parts: r.parts });
};

const upgradeCapacity = (ctx: SimContext, { domain, terms, fail, charged }: Counter): void => {
  const r = upgradeBackpack(domain.wallet, domain.inventory, terms);
  if (!r.ok) return fail(r.reason);
  ctx.state.domain = { ...domain, wallet: r.wallet, inventory: r.inventory };
  charged(r.wallet, r.price);
  ctx.bus.emit("CapacityUpgraded", { capacity: r.inventory.capacity, price: r.price });
};

/**
 * Shop commands (plan §6, ADR-0015): buying, selling, repairs, the backpack and implants from
 * the bag. Prices come from the same core functions the shop panel quotes with. None of them
 * consumes randomness; a refused trade changes nothing and says why.
 */
export const applyTradeCommand = (ctx: SimContext, cmd: TradeCommand): void => {
  const domain = ctx.state.domain;
  const shopId = shopOf(cmd);
  const fail = (reason: PurchaseFailure) => ctx.bus.emit("PurchaseFailed", { reason, shopId });
  if (!shopOpen(domain, shopId)) {
    fail("closed");
    return;
  }
  const counter = counterAt(ctx, domain, shopId, fail);
  switch (cmd.type) {
    case "buy-cyberware":
      return buyImplant(ctx, cmd, counter);
    case "install-cyberware-item":
      return installImplantFromBag(ctx, cmd, counter);
    case "remove-cyberware":
      return removeImplant(ctx, cmd, counter);
    case "buy-item":
      return buyItem(ctx, cmd, counter);
    case "sell-item":
      return sellItem(ctx, cmd, counter);
    case "repair-item":
      return repairItem(ctx, cmd, counter);
    case "upgrade-capacity":
      return upgradeCapacity(ctx, counter);
  }
};
