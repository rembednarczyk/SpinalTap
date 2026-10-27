import type { CyberwareId, ItemId } from "@seki/core";

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
  buyItem(id: ItemId): void;
  closeShop(): void;
  /** Leaves the clinic counter for a conversation with the ripperdoc. */
  talkToShopkeeper(): void;
}
