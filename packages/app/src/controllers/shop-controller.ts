import type { CyberwareId, CyberwareSlot, ItemRef, ShopId, ShopItemId } from "@seki/core";
import { type ShopIntents, type TradeVm, type UiStore, patchUi } from "@seki/ui";
import { createTradeTracker } from "../trade-view";
import type { Focus, SimRef } from "./shared";

export interface ShopControllerDeps {
  readonly sim: SimRef;
  readonly ui: UiStore;
  readonly focus: Focus;
  /** Opens the conversation with the keeper (ink knot `mori` or `oyaji`). */
  readonly talk: (dialogueId: string) => void;
}

/** The open shop counter: trade commands go out only while it is open, and only to that counter. */
export class ShopController implements ShopIntents {
  private shopOpen = false;
  /** Counter behind the open shop panel, and the ink knot of its keeper ("Porozmawiaj"). */
  private shopId: ShopId = "clinic";
  private shopTalk = "mori";
  private readonly tradeView = createTradeTracker();

  constructor(private readonly deps: ShopControllerDeps) {}

  get isOpen(): boolean {
    return this.shopOpen;
  }

  open(shopId: ShopId, dialogueId: string): void {
    this.shopOpen = true;
    this.shopId = shopId;
    this.shopTalk = dialogueId;
    patchUi(this.deps.ui, { shopOpen: true, shopId, trade: this.tradeView(this.deps.sim().domain), prompt: null });
    this.deps.focus.panel();
  }

  /** The bag as the counter sees it, for the HUD frame; nothing while no shop is open. */
  tradeFrame(): { trade?: TradeVm } {
    return this.shopOpen ? { trade: this.tradeView(this.deps.sim().domain) } : {};
  }

  buyCyberware(id: CyberwareId): void {
    if (this.atCounter("clinic")) this.deps.sim().enqueue({ type: "buy-cyberware", cyberwareId: id });
  }

  buyItem(id: ShopItemId): void {
    if (this.shopOpen) this.deps.sim().enqueue({ type: "buy-item", itemId: id, shopId: this.shopId });
  }

  sellItem(ref: ItemRef, qty: number): void {
    if (this.shopOpen) this.deps.sim().enqueue({ type: "sell-item", shopId: this.shopId, ref, qty });
  }

  repairItem(uid: string, useParts: number): void {
    if (this.atCounter("oyaji")) this.deps.sim().enqueue({ type: "repair-item", uid, useParts });
  }

  upgradeBackpack(): void {
    if (this.atCounter("oyaji")) this.deps.sim().enqueue({ type: "upgrade-capacity" });
  }

  installCyberwareItem(uid: string): void {
    if (this.atCounter("clinic")) this.deps.sim().enqueue({ type: "install-cyberware-item", uid });
  }

  removeCyberware(slot: CyberwareSlot): void {
    if (this.atCounter("clinic")) this.deps.sim().enqueue({ type: "remove-cyberware", slot });
  }

  /** From the counter straight into a conversation with its keeper. */
  talkToShopkeeper(): void {
    if (!this.shopOpen) return;
    this.shopOpen = false;
    patchUi(this.deps.ui, { shopOpen: false });
    this.deps.talk(this.shopTalk);
  }

  closeShop(): void {
    if (!this.shopOpen) return;
    this.shopOpen = false;
    patchUi(this.deps.ui, { shopOpen: false });
    this.deps.sim().enqueue({ type: "end-dialogue" });
    this.deps.focus.settle();
  }

  /** Closes the panel without telling the simulation. */
  closeSilently(): void {
    this.shopOpen = false;
    patchUi(this.deps.ui, { shopOpen: false });
  }

  /** Trade commands go out only while that counter is open. */
  private atCounter(shop: ShopId): boolean {
    return this.shopOpen && this.shopId === shop;
  }
}
