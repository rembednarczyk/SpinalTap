import type { CyberwareId, CyberwareSlot, EquipSlot, ItemRef, ModSlot, ShopItemId } from "@seki/core";
import type { CharacterTab, SettingsVm } from "./store/ui-store";

/** Where the 3D preview of the character screen is drawn, in CSS pixels of the page. */
export interface PreviewRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

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
  /** Binds a key (KeyboardEvent.code, "MouseN", "WheelUp"/"WheelDown") to a control, taking it off any other. */
  bindKey(action: string, code: string): void;
  /** Every control back to its default keys. */
  resetControls(): void;
  /** Reloads the game so settings that need a restart take effect. */
  reload(): void;
  /** Takes one line of the open bag, or everything that fits. */
  takeLoot(line: number | "all"): void;
  /** Leaves the bag as it is. */
  closeLoot(): void;
  // Character screen (plan §7 and §8.5). The clock stands while it is open.
  /** The screen opened on `tab`, or moved to it. */
  openCharacterScreen(tab: CharacterTab): void;
  closeCharacterScreen(): void;
  /** Rectangle of the 3D preview; null hides it. */
  setPreviewViewport(rect: PreviewRect | null): void;
  /** Turns the previewed character by `deltaYaw` radians. */
  rotatePreview(deltaYaw: number): void;
  /** Back to the front view. */
  resetPreview(): void;
  // Menu actions; each one applies at once.
  equip(uid: string, slot?: EquipSlot): void;
  unequip(slot: EquipSlot): void;
  useItem(ref: ItemRef): void;
  dropItem(ref: ItemRef, qty: number): void;
  installMod(weaponUid: string, modUid: string): void;
  removeMod(weaponUid: string, slot: ModSlot): void;
}
