import { type DifficultyProfile, type Locale, type SaveSnapshot, textRef } from "@seki/core";
import { Simulation } from "@seki/sim";
import { type StartSaveIntents, type UiStore, W3_SLICE_SLOT, translate } from "@seki/ui";
import { w3SliceSnapshot } from "../start-save";
import { slotDateLabel } from "./save-controller";
import { pushToastTimed } from "./shared";

export interface StartSaveControllerDeps {
  /** Writes a slot as the game writes its own (`SaveController.writeSnapshot`): the slot's preset label follows. */
  readonly write: (slot: string, snapshot: SaveSnapshot) => Promise<void>;
  readonly ui: UiStore;
  /** The seed of the game the start save is made from, as a new game's. */
  readonly seed: () => number;
  readonly now: () => Date;
  /** Loads a slot as the player's Load does (`SaveController.loadAsync`); `play` runs once the game is on screen. */
  readonly load: (slot: string, play: () => void) => Promise<boolean>;
}

/**
 * The start saves of the new game's setup (ADR-0082, G-909): W-3's slice at level 12. The save
 * is made from a new game on the chosen difficulty, written to its own slot and loaded from there
 * like any save of the player's, through the store's checksum, migration and validation. The slot
 * stays in the Load list, so loading it again starts the slice over.
 */
export class StartSaveController implements StartSaveIntents {
  constructor(private readonly deps: StartSaveControllerDeps) {}

  private get locale(): Locale {
    return this.deps.ui.getState().settings.locale;
  }

  startW3Slice(difficulty?: DifficultyProfile): void {
    void this.startW3SliceAsync(difficulty);
  }

  async startW3SliceAsync(difficulty?: DifficultyProfile): Promise<boolean> {
    const { ui } = this.deps;
    try {
      const sim = Simulation.create({ seed: this.deps.seed(), ...(difficulty ? { difficulty } : {}) });
      const meta = { label: slotDateLabel(this.deps.now(), this.locale), objective: translate(this.locale, "newGame.w3Place") };
      await this.deps.write(W3_SLICE_SLOT, w3SliceSnapshot(sim.snapshot(null, meta.label, meta.objective), meta));
    } catch (e) {
      pushToastTimed(ui, "system", translate(this.locale, "save.failed"), String(e), true);
      return false;
    }
    // Keys, not sentences: the card follows a language switch while it is up (G-466).
    return this.deps.load(W3_SLICE_SLOT, () => pushToastTimed(ui, "system", textRef("newGame.w3Place"), textRef("newGame.w3Intro")));
  }
}
