import { type AudioPort, CorruptSaveError, type PersistencePort, type SaveSnapshot } from "@seki/core";
import type { NarrativeRuntime } from "@seki/narrative";
import { type UiStore, patchUi } from "@seki/ui";
import { describeObjective, saveLabel } from "../objective";
import { type SimRef, pushToastTimed } from "./shared";

export interface SaveControllerDeps {
  readonly persistence: PersistencePort;
  readonly ui: UiStore;
  readonly audio: AudioPort;
  readonly narrative: NarrativeRuntime;
  readonly sim: SimRef;
  readonly now: () => Date;
  /** A save is allowed now: no conversation, shop or bag open, and a game running. */
  readonly canSave: () => boolean;
  /** Replaces the running game with a loaded snapshot. */
  readonly restore: (snapshot: SaveSnapshot) => void;
}

/** Saves, loads and the slot list (asynchronous persistence around the running game). */
export class SaveController {
  constructor(private readonly deps: SaveControllerDeps) {}

  save(slot: string): void {
    void this.saveAsync(slot);
  }

  load(slot: string): void {
    void this.loadAsync(slot);
  }

  snapshot(): SaveSnapshot {
    const sim = this.deps.sim();
    const { objective } = describeObjective(sim.domain);
    return sim.snapshot(this.deps.narrative.saveState(), saveLabel(this.deps.now()), objective ?? "");
  }

  async saveAsync(slot: string): Promise<boolean> {
    const { ui } = this.deps;
    if (!this.deps.canSave()) {
      pushToastTimed(ui, "system", "Nie można teraz zapisać");
      return false;
    }
    patchUi(ui, { busy: true });
    try {
      await this.deps.persistence.save(slot, this.snapshot());
      this.deps.audio.play("save");
      pushToastTimed(ui, "system", "Zapisano grę", slot === "quick" ? "Szybki zapis" : slot);
      return true;
    } catch (e) {
      pushToastTimed(ui, "system", "Zapis nieudany", String(e));
      return false;
    } finally {
      patchUi(ui, { busy: false });
      await this.refreshSlots();
    }
  }

  async loadAsync(slot: string): Promise<boolean> {
    const { ui } = this.deps;
    patchUi(ui, { busy: true });
    try {
      const snapshot = await this.deps.persistence.load(slot);
      if (!snapshot) {
        pushToastTimed(ui, "system", "Pusty slot", slot);
        return false;
      }
      this.deps.restore(snapshot);
      pushToastTimed(ui, "system", "Wczytano grę", snapshot.meta.label);
      return true;
    } catch (e) {
      const text = e instanceof CorruptSaveError ? "Plik zapisu jest uszkodzony." : String(e);
      pushToastTimed(ui, "system", "Nie udało się wczytać", text);
      return false;
    } finally {
      patchUi(ui, { busy: false });
    }
  }

  async refreshSlots(): Promise<void> {
    try {
      const slots = await this.deps.persistence.list();
      patchUi(this.deps.ui, { slots, hasSaves: slots.length > 0 });
    } catch {
      patchUi(this.deps.ui, { slots: [], hasSaves: false });
    }
  }
}
