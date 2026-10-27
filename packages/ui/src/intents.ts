import type { CyberwareId, StackableId } from "@seki/core";
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
  buyItem(id: StackableId): void;
  closeShop(): void;
  /** Leaves the clinic counter for a conversation with the ripperdoc. */
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
