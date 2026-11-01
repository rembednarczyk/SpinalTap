import type { DifficultyProfile } from "@seki/core";
import { type DifficultyIntents, type Screen, type UiStore, patchUi } from "@seki/ui";
import { difficultyView } from "../presenters/difficulty";
import type { SimRef } from "./shared";

export interface DifficultyControllerDeps {
  readonly sim: SimRef;
  readonly ui: UiStore;
  readonly screen: () => Screen;
}

/**
 * The difficulty of the running game from the pause menu (ADR-0066, stage 2). Every change is
 * the `set-difficulty` command with the whole profile; the simulation takes it at once, or keeps
 * it for the end of a fight, and the pause menu shows which.
 */
export class DifficultyController implements DifficultyIntents {
  constructor(private readonly deps: DifficultyControllerDeps) {}

  setDifficulty(profile: DifficultyProfile): void {
    const screen = this.deps.screen();
    if (screen !== "paused" && screen !== "playing") return;
    const sim = this.deps.sim();
    sim.enqueue({ type: "set-difficulty", profile });
    // The clock stands in the pause: the command phase runs now, so the menu shows the outcome
    // (in force, or waiting for the fight's end), as the character menu does (ADR-0015).
    if (screen === "paused") sim.applyPendingCommands();
    this.sync();
  }

  /** The store follows the simulation: after a new game, a load, a pause and every change. */
  sync(): void {
    const { ui } = this.deps;
    patchUi(ui, { difficulty: difficultyView(this.deps.sim(), ui.getState().difficulty) });
  }
}
