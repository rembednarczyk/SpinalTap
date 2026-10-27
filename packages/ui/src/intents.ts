import type { CyberwareId, CyberwareSlot, ItemRef, ShopItemId } from "@seki/core";
import type { SettingsVm } from "./store/ui-store";

/** Everything the UI can ask the game to do. Implemented by the app composition root. */
export interface UiIntents {
  newGame(): void;
  resume(): void;
  pause(): void;
  save(slot: string): void;
  load(slot: string): void;
  choose(index: number): void;
  closeDialogue(): void;
  quitToTitle(): void;
  buyCyberware(id: CyberwareId): void;
  /** Buys one entry of the open shop's stock. */
  buyItem(id: ShopItemId): void;
  /** Sells `qty` of a stack, or one piece, to the open shop. */
  sellItem(ref: ItemRef, qty: number): void;
  /** Mends a garment at the stall, spending up to `useParts` weapon parts. */
  repairItem(uid: string, useParts: number): void;
  /** The next backpack upgrade at the stall. */
  upgradeBackpack(): void;
  /** Doktor Mori fits an implant from the bag. */
  installCyberwareItem(uid: string): void;
  /** Doktor Mori takes an implant out into the bag. */
  removeCyberware(slot: CyberwareSlot): void;
  closeShop(): void;
  /** Leaves the counter for a conversation with the shopkeeper (Mori or Oyaji). */
  talkToShopkeeper(): void;
  /** Saves the changed settings; look sensitivity applies at once. */
  changeSettings(patch: Partial<SettingsVm>): void;
  /** Reloads the game so settings that need a restart take effect. */
  reload(): void;
  /** Takes one line of the open bag, or everything that fits. */
  takeLoot(line: number | "all"): void;
  /** Leaves the bag as it is. */
  closeLoot(): void;
}
