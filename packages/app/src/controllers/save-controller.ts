import { type AudioPort, CorruptSaveError, type Locale, type PersistencePort, type SaveSnapshot } from "@seki/core";
import type { NarrativeRuntime } from "@seki/narrative";
import { encodeSave } from "@seki/persistence";
import { type MessageKey, type MessageParams, type UiStore, patchUi, translate } from "@seki/ui";
import { describeObjective } from "../objective";
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
  /** Hands a file to the player (a download in the browser); without it a slot cannot be exported. */
  readonly download?: (fileName: string, text: string) => void;
}

/** The file name of an exported slot: the game, the slot and the day, e.g. `seki-senshi-slot-1-2026-10-31.json`. */
export const exportFileName = (slot: string, date: Date): string =>
  `seki-senshi-${slot}-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}.json`;

/**
 * When a slot was saved, as its label shows it: day, month and time, written as the language
 * writes dates. Polish keeps the format the game always had (pl-PL), English is en-GB.
 */
export const slotDateLabel = (date: Date, locale: Locale): string =>
  date.toLocaleString(locale === "pl" ? "pl-PL" : "en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Saves, loads and the slot list (asynchronous persistence around the running game). */
export class SaveController {
  constructor(private readonly deps: SaveControllerDeps) {}

  private get locale(): Locale {
    return this.deps.ui.getState().settings.locale;
  }

  /** The toasts speak the language of the moment (ADR-0056). */
  private t(key: MessageKey, params?: MessageParams): string {
    return translate(this.locale, key, params);
  }

  save(slot: string): void {
    void this.saveAsync(slot);
  }

  load(slot: string): void {
    void this.loadAsync(slot);
  }

  exportSave(slot: string): void {
    void this.exportAsync(slot);
  }

  /**
   * Writes a slot to a file the player keeps (gap audit, Platformy): the same encoded form as in
   * the store, with its checksum and schema version, so a later import reads it as a save.
   */
  async exportAsync(slot: string): Promise<boolean> {
    const { ui, download } = this.deps;
    if (!download) {
      pushToastTimed(ui, "system", this.t("save.exportFailed"));
      return false;
    }
    try {
      const snapshot = await this.deps.persistence.load(slot);
      if (!snapshot) {
        pushToastTimed(ui, "system", this.t("save.emptySlot"), slot);
        return false;
      }
      download(exportFileName(slot, this.deps.now()), encodeSave(snapshot));
      pushToastTimed(ui, "system", this.t("save.exported"), snapshot.meta.label);
      return true;
    } catch (e) {
      const text = e instanceof CorruptSaveError ? this.t("save.corruptFile") : String(e);
      pushToastTimed(ui, "system", this.t("save.exportFailed"), text, true);
      return false;
    }
  }

  snapshot(): SaveSnapshot {
    const sim = this.deps.sim();
    const { objective } = describeObjective(sim.domain, this.locale);
    return sim.snapshot(this.deps.narrative.saveState(), slotDateLabel(this.deps.now(), this.locale), objective ?? "");
  }

  /**
   * Writes a slot without the player's checks or toasts (the autosave has its own). The
   * snapshot is taken and encoded synchronously, before the store's first await.
   */
  async write(slot: string): Promise<void> {
    await this.deps.persistence.save(slot, this.snapshot());
    await this.refreshSlots();
  }

  async saveAsync(slot: string): Promise<boolean> {
    const { ui } = this.deps;
    if (!this.deps.canSave()) {
      pushToastTimed(ui, "system", this.t("save.unavailable"));
      return false;
    }
    patchUi(ui, { busy: true });
    try {
      await this.deps.persistence.save(slot, this.snapshot());
      this.deps.audio.play("save");
      pushToastTimed(ui, "system", this.t("save.saved"), slot === "quick" ? this.t("slots.quick") : slot);
      return true;
    } catch (e) {
      pushToastTimed(ui, "system", this.t("save.failed"), String(e), true);
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
        pushToastTimed(ui, "system", this.t("save.emptySlot"), slot);
        return false;
      }
      this.deps.restore(snapshot);
      pushToastTimed(ui, "system", this.t("save.loaded"), snapshot.meta.label);
      return true;
    } catch (e) {
      const text = e instanceof CorruptSaveError ? this.t("save.corruptFile") : String(e);
      pushToastTimed(ui, "system", this.t("save.loadFailed"), text, true);
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
