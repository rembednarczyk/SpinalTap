import type { DifficultyProfile, DomainEvents, EventBus, SaveSnapshot } from "@seki/core";
import type { NarrativeRuntime } from "@seki/narrative";
import { type RenderSync, Simulation } from "@seki/sim";
import { patchUi, translate } from "@seki/ui";
import type { Controllers } from "./controllers/compose";
import type { LoadingController } from "./controllers/loading-controller";
import { pushToastTimed } from "./controllers/shared";
import type { FlowIntents } from "./intents";
import type { GameSessionDeps } from "./session-deps";
import type { SessionScreen } from "./session-screen";

export interface SessionFlowDeps {
  readonly session: GameSessionDeps;
  readonly bus: EventBus<DomainEvents>;
  readonly narrative: NarrativeRuntime;
  readonly renderSync: RenderSync;
  readonly screen: SessionScreen;
  readonly loading: LoadingController;
  readonly controllers: () => Controllers;
  /** Draws a frame (`SessionLoop.render`): the new simulation is on screen at once. */
  readonly render: (alpha: number) => void;
  /** The simulation the session starts with, behind the title screen. */
  readonly initial: Simulation;
}

/**
 * The course of a game (ADR-0031, a part of `GameSession`): it owns the running simulation and
 * replaces it on a new game or a load, pauses and resumes, and goes back to the title. A start
 * plays behind the loading screen (ADR-0057).
 */
export class SessionFlow implements FlowIntents {
  private simulation: Simulation;

  constructor(private readonly deps: SessionFlowDeps) {
    this.simulation = deps.initial;
  }

  get sim(): Simulation {
    return this.simulation;
  }

  /** True while a new game or a load waits behind the loading screen (ADR-0057). */
  get preparing(): boolean {
    return this.deps.loading.loading;
  }

  /** A new game on `difficulty` (ADR-0066), chosen before the loading screen; "normal" without. */
  newGame(difficulty?: DifficultyProfile): void {
    const { seed, crowd, traffic, ui } = this.deps.session;
    this.replaceSimulation(Simulation.create({ seed: seed(), bus: this.deps.bus, crowd: crowd ?? "off", traffic: traffic ?? crowd ?? "off", ...(difficulty ? { difficulty } : {}) }));
    this.deps.narrative.resetState();
    this.deps.controllers().hints.start();
    this.startPlaying(() => {
      const locale = ui.getState().settings.locale;
      pushToastTimed(ui, "system", translate(locale, "newGame.place"), translate(locale, "newGame.intro"));
    });
  }

  resume(): void {
    if (this.deps.screen.screen === "paused") this.deps.screen.set("playing");
  }

  pause(): void {
    if (!this.deps.screen.inControl) return;
    // A difficulty that waited for the end of a fight may be in force by now (ADR-0066).
    this.deps.controllers().difficulty.sync();
    this.deps.screen.set("paused");
  }

  quitToTitle(): void {
    this.deps.loading.cancel();
    this.deps.screen.closePanels();
    this.deps.screen.set("title");
    void this.deps.controllers().saves.refreshSlots();
  }

  /**
   * Replaces the running game with `snapshot`, ink state included: a load without the slot.
   * It plays behind the loading screen (ADR-0057) unless `prepare` is false (the debug jump).
   */
  restore(snapshot: SaveSnapshot, prepare = true): void {
    const { session, narrative } = this.deps;
    this.deps.screen.closePanels();
    this.replaceSimulation(Simulation.fromSnapshot(snapshot, this.deps.bus, session.crowd ?? "off", session.traffic ?? session.crowd ?? "off"));
    this.deps.controllers().wave1.inbox.clear();
    if (snapshot.narrative) narrative.loadState(snapshot.narrative);
    else narrative.resetState();
    if (prepare) this.startPlaying();
    else {
      this.deps.loading.cancel();
      this.deps.screen.set("playing");
    }
  }

  /** Into the game through the loading screen, where the renderer prepares the start (ADR-0057). */
  private startPlaying(play: () => void = () => {}): void {
    const at = this.simulation.player()?.position ?? { x: 0, y: 0, z: 0 };
    this.deps.loading.start(at, play);
  }

  private replaceSimulation(next: Simulation): void {
    const c = this.deps.controllers();
    this.deps.renderSync.reset();
    this.simulation = next;
    c.hud.reset(next);
    c.hack.reset();
    c.metro.reset();
    c.autosave.reset();
    c.difficulty.sync();
    this.deps.session.render.setCameraMode(next.domain.preferences.cameraMode);
    patchUi(this.deps.session.ui, { prompt: null, toasts: [] });
    this.deps.render(0);
  }
}
