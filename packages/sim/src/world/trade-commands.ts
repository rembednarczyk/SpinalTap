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
import { oyajiStallOpen } from "../content/schedules";
import { deadFlag } from "../systems/death-system";
import type { SimContext } from "./context";
import { applyReputationCause, raiseProgress } from "./domain-ops";

const TRADE_COMMANDS = ["buy-cyberware", "buy-item", "sell-item", "repair-item", "upgrade-capacity", "install-cyberware-item", "remove-cyberware"] as const;

type TradeCommand = Extract<GameCommand, { type: (typeof TRADE_COMMANDS)[number] }>;

export const isTradeCommand = (cmd: GameCommand): cmd is TradeCommand => (TRADE_COMMANDS as readonly string[]).includes(cmd.type);

/** Mori's clinic never closes; Oyaji trades while his stall is up and he is alive. */
export const shopOpen = (domain: DomainState, shop: ShopId): boolean =>
  shop === "clinic" || (oyajiStallOpen(domain.clock) && !hasFlag(domain.flags, deadFlag(PROTECTEE_KEY)));

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
  const terms = termsAt(domain, shopId);
  const pockets = { wallet: domain.wallet, inventory: domain.inventory, equipment: domain.equipment, ammo: domain.ammo };
  const charged = (wallet: DomainState["wallet"], price: number) => {
    if (price > 0) ctx.bus.emit("EddiesChanged", { balance: wallet.eddies, delta: -price });
  };
  switch (cmd.type) {
    case "buy-cyberware": {
      const r = buyCyberware(domain.wallet, domain.character, cmd.cyberwareId, terms);
      if (!r.ok) return fail(r.reason);
      const stowed = r.replaced ? stowImplant(domain.inventory, domain.equipment, r.replaced) : { inventory: domain.inventory, item: null };
      ctx.state.domain = { ...domain, wallet: r.wallet, character: r.character, inventory: stowed.inventory };
      charged(r.wallet, r.price);
      if (stowed.item) ctx.bus.emit("ItemAdded", { ref: { uid: stowed.item.uid }, defId: stowed.item.def, qty: 1, source: "clinic" });
      ctx.bus.emit("CyberwareInstalled", { cyberwareId: cmd.cyberwareId, replaced: r.replaced, price: r.price, stowed: stowed.item !== null });
      if (r.price > 0) applyReputationCause(ctx, { type: "clinic-purchase", kind: "cyberware" });
      raiseProgress(ctx, "cyberware_installed");
      return;
    }
    case "install-cyberware-item": {
      const r = installCyberwareItem(domain.wallet, domain.character, domain.inventory, domain.equipment, cmd.uid, terms);
      if (!r.ok) return fail(r.reason);
      ctx.state.domain = { ...domain, wallet: r.wallet, character: r.character, inventory: r.inventory };
      charged(r.wallet, r.fee);
      ctx.bus.emit("ItemRemoved", { ref: { uid: cmd.uid }, qty: 1, reason: "installed" });
      if (r.returned) ctx.bus.emit("ItemAdded", { ref: { uid: r.returned.uid }, defId: r.returned.def, qty: 1, source: "clinic" });
      ctx.bus.emit("CyberwareInstalled", { cyberwareId: r.cyberwareId, replaced: r.replaced, price: r.fee, fromBag: true, stowed: r.returned !== null });
      if (r.fee > 0) applyReputationCause(ctx, { type: "clinic-purchase", kind: "cyberware" });
      raiseProgress(ctx, "cyberware_installed");
      return;
    }
    case "remove-cyberware": {
      const r = removeCyberware(domain.character, domain.inventory, domain.equipment, cmd.slot);
      if (!r.ok) return fail(r.reason);
      ctx.state.domain = { ...domain, character: r.character, inventory: r.inventory };
      ctx.bus.emit("ItemAdded", { ref: { uid: r.item.uid }, defId: r.item.def, qty: 1, source: "clinic" });
      ctx.bus.emit("CyberwareRemoved", { cyberwareId: r.cyberwareId, slot: cmd.slot });
      return;
    }
    case "buy-item": {
      const r = buyStock(pockets, shopId, cmd.itemId, terms);
      if (!r.ok) return fail(r.reason);
      ctx.state.domain = { ...domain, wallet: r.wallet, inventory: r.inventory, ammo: r.ammo };
      charged(r.wallet, r.price);
      if (r.added) ctx.bus.emit("ItemAdded", { ref: { uid: r.added.uid }, defId: r.added.def, qty: 1, source: "shop" });
      ctx.bus.emit("ItemBought", { itemId: cmd.itemId, price: r.price, shopId, qty: r.qty });
      if (shopId === "clinic") applyReputationCause(ctx, { type: "clinic-purchase", kind: "item" });
      return;
    }
    case "sell-item": {
      const r = sell(pockets, shopId, cmd.ref, cmd.qty, terms);
      if (!r.ok) return fail(r.reason);
      ctx.state.domain = { ...domain, wallet: r.wallet, inventory: r.inventory, ammo: r.ammo };
      ctx.bus.emit("ItemRemoved", { ref: cmd.ref, qty: r.qty, reason: "sold" });
      ctx.bus.emit("ItemSold", { shopId, defId: r.defId, qty: r.qty, price: r.price });
      ctx.bus.emit("EddiesChanged", { balance: r.wallet.eddies, delta: r.price, source: "sale" });
      return;
    }
    case "repair-item": {
      const item = findItem(domain.inventory, cmd.uid);
      const r = repair(domain.wallet, domain.inventory, cmd.uid, cmd.useParts, terms);
      if (!r.ok || !item) return fail(r.ok ? "not-found" : r.reason);
      ctx.state.domain = { ...domain, wallet: r.wallet, inventory: r.inventory };
      charged(r.wallet, r.price);
      if (r.parts > 0) ctx.bus.emit("ItemRemoved", { ref: { stack: "weapon_parts" }, qty: r.parts, reason: "repair" });
      ctx.bus.emit("ItemRepaired", { uid: cmd.uid, defId: item.def, price: r.price, parts: r.parts });
      return;
    }
    case "upgrade-capacity": {
      const r = upgradeBackpack(domain.wallet, domain.inventory, terms);
      if (!r.ok) return fail(r.reason);
      ctx.state.domain = { ...domain, wallet: r.wallet, inventory: r.inventory };
      charged(r.wallet, r.price);
      ctx.bus.emit("CapacityUpgraded", { capacity: r.inventory.capacity, price: r.price });
      return;
    }
  }
};
