import { EMPTY_INPUT, type InputFrame, pendingScene } from "@seki/core";
import { type RenderSync, SIM_HZ, type Simulation } from "@seki/sim";
import { type UiStore, patchUi } from "@seki/ui";
import type { Controllers } from "./controllers/compose";
import { isCalm } from "./controllers/hud-sync";
import type { SessionScreen } from "./session-screen";

export interface SessionLoopDeps {
  readonly ui: UiStore;
  readonly renderSync: RenderSync;
  readonly sim: () => Simulation;
  readonly controllers: () => Controllers;
  readonly screen: SessionScreen;
}

/**
 * One step and one frame of the running game (ADR-0031, a part of `GameSession`): the input
 * through the controllers into the simulation, then the world, the HUD and the preview drawn.
 */
export class SessionLoop {
  constructor(private readonly deps: SessionLoopDeps) {}

  step(input: InputFrame): void {
    const { screen, ui } = this.deps;
    if (!screen.running) return;
    const c = this.deps.controllers();
    const frame = screen.inControl ? c.hack.withTouchScan(input) : EMPTY_INPUT;
    // The interact key on a takedown's target or a body is a command for this very step (ADR-0065).
    c.takedown.input(frame);
    c.carry.input(frame);
    this.deps.sim().step(frame);
    c.metro.tick(1 / SIM_HZ);
    c.radio.tick(1 / SIM_HZ);
    patchUi(ui, { scanning: screen.inControl && c.hack.scanning(input) });
    this.playPendingRecall();
    c.hints.step(screen.inControl, c.character.isOpen);
    c.autosave.step();
  }

  render(alpha: number): void {
    const c = this.deps.controllers();
    c.character.renderPreview();
    const simulation = this.deps.sim();
    this.deps.renderSync.sync(simulation.world, alpha, simulation.streamer.streamedOut, simulation.domain);
    c.hud.frame();
  }

  syncHud(): void {
    this.deps.controllers().hud.sync();
  }

  /**
   * A recovered memory plays as a flashback as soon as the player is free again (after the
   * conversation or the clinic that triggered it), and so does the opening of act II. Driven
   * by domain state, so it survives a save.
   */
  private playPendingRecall(): void {
    const simulation = this.deps.sim();
    if (!this.deps.screen.inControl || simulation.session.gameOver) return;
    const scene = pendingScene(simulation.domain);
    if (!scene || !isCalm(simulation)) return;
    simulation.session.dialogueActive = true;
    this.deps.controllers().dialogue.open(scene);
  }
}
