import type { SaveSnapshot } from "../save/save-snapshot";

export interface SaveSlotInfo {
  readonly slot: string;
  readonly savedAtLabel: string;
  readonly objective: string;
}

export interface PersistencePort {
  save(slot: string, snapshot: SaveSnapshot): Promise<void>;
  /** Resolves null when the slot is empty. Rejects with CorruptSaveError when unreadable. */
  load(slot: string): Promise<SaveSnapshot | null>;
  list(): Promise<SaveSlotInfo[]>;
}

export class CorruptSaveError extends Error {
  constructor(
    readonly slot: string,
    reason: string,
  ) {
    super(`Save "${slot}" is corrupt: ${reason}`);
    this.name = "CorruptSaveError";
  }
}
