import { CorruptSaveError, type PersistencePort, type SaveSlotInfo, type SaveSnapshot } from "@seki/core";
import { decodeSave, encodeSave } from "./save-codec";

/** Raw key-value storage the save system sits on. */
export interface SaveStore {
  get(slot: string): Promise<string | undefined>;
  put(slot: string, value: string): Promise<void>;
  keys(): Promise<string[]>;
}

/**
 * The objective of an unreadable slot in the slot list: a catalog key, not a text, so the UI
 * says it in the player's language (ADR-0056). The save format does not change.
 */
export const CORRUPT_SLOT_OBJECTIVE = "save.corrupt";

/** PersistencePort over any SaveStore: encoding, checksums and migrations live here, storage stays dumb. */
export class SavePersistence implements PersistencePort {
  constructor(private readonly store: SaveStore) {}

  async save(slot: string, snapshot: SaveSnapshot): Promise<void> {
    await this.store.put(slot, encodeSave(snapshot));
  }

  async load(slot: string): Promise<SaveSnapshot | null> {
    const raw = await this.store.get(slot);
    return raw === undefined ? null : decodeSave(slot, raw);
  }

  async list(): Promise<SaveSlotInfo[]> {
    const slots = (await this.store.keys()).sort();
    const out: SaveSlotInfo[] = [];
    for (const slot of slots) {
      try {
        const s = await this.load(slot);
        if (s) out.push({ slot, savedAtLabel: s.meta.label, objective: s.meta.objective });
      } catch (e) {
        if (!(e instanceof CorruptSaveError)) throw e;
        out.push({ slot, savedAtLabel: "—", objective: CORRUPT_SLOT_OBJECTIVE });
      }
    }
    return out;
  }
}

export class MemorySaveStore implements SaveStore {
  readonly data = new Map<string, string>();
  async get(slot: string) {
    return this.data.get(slot);
  }
  async put(slot: string, value: string) {
    this.data.set(slot, value);
  }
  async keys() {
    return [...this.data.keys()];
  }
}
