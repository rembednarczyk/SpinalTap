import {
  type BreachDaemonId,
  type DifficultyProfile,
  type DomainEvents,
  EventBus,
  type InputFrame,
  type MetroStationId,
  type SaveSnapshot,
} from "@seki/core";
import { NarrativeRuntime } from "@seki/narrative";
import { RenderSync, Simulation, WORLD_SCENERY } from "@seki/sim";
import { type Screen, type SessionIntents, type UiIntents, patchUi, translate } from "@seki/ui";
import { type Controllers, createControllers } from "./controllers/compose";
import { LoadingController } from "./controllers/loading-controller";
import { pushToastTimed } from "./controllers/shared";
import { buildCityMap } from "./city-map";
import { narrativeText } from "./content-text";
import { composeIntents, controllerIntents } from "./intents";
import type { GameSessionDeps } from "./session-deps";
import { SessionLoop } from "./session-loop";
import { SessionScreen } from "./session-screen";

export { RECALL_CALM_TICKS } from "./controllers/hud-sync";
export type { GameSessionDeps, HintsHost, SettingsHost } from "./session-deps";

/**
 * Application service: owns the running simulation and the loop (step, render, screen) and the
 * session's own intents (new game, pause, saves). The other intents come from the controllers,
 * composed in `intents.ts` (ADR-0031). The screen and the panels are `SessionScreen`, the step
 * and the frame `SessionLoop`. Contains no browser or Babylon code, so the whole M0 loop runs
 * headless.
 */
export class GameSession implements SessionIntents {
  readonly bus = new EventBus<DomainEvents>();
  /** Everything the UI can ask: the session's own intents and each controller's part. */
  readonly intents: UiIntents;
  readonly narrative: NarrativeRuntime;
  private readonly renderSync: RenderSync;
  private simulation: Simulation;
  private readonly c: Controllers;
  /** The loading screen in front of a new game and a load (ADR-0057). */
  private readonly loading: LoadingController;
  /** The screen and the panels over it. */
  private readonly view: SessionScreen;
  /** One step and one frame. */
  private readonly loop: SessionLoop;

  constructor(private readonly deps: GameSessionDeps) {
    // The ink in the player's language from the start, the narrative's own words (speakers' roles,
    // a contract's variation) in the language of the moment (ADR-0056).
    this.narrative = new NarrativeRuntime(deps.story, (cmd) => this.simulation.enqueue(cmd), {
      locale: deps.ui.getState().settings.locale,
      text: narrativeText(() => deps.ui.getState().settings.locale),
    });
    // Lublin's terrain, surfaces and buildings are drawn for good, streamed in or not (ADR-0045).
    this.renderSync = new RenderSync(deps.render, deps.scenery === false ? [] : WORLD_SCENERY);
    const controllers = () => this.c;
    this.view = new SessionScreen({ ui: deps.ui, controllers });
    this.loop = new SessionLoop({ ui: deps.ui, renderSync: this.renderSync, sim: () => this.simulation, controllers, screen: this.view });
    this.simulation = Simulation.create({ seed: deps.seed(), bus: this.bus, crowd: deps.crowd ?? "off", traffic: deps.traffic ?? deps.crowd ?? "off" });
    // The whole city (ADR-0045): Lublin's streets, buildings and names under the game's decks and links (ADR-0021).
    patchUi(deps.ui, { map: buildCityMap() });
    this.c = createControllers(deps, {
      bus: this.bus,
      narrative: this.narrative,
      sim: () => this.simulation,
      screen: () => this.screen,
      inControl: () => this.inControl,
      setScreen: (screen) => this.view.set(screen),
      interrupt: () => this.view.interruptDialogue(),
      restore: (snapshot) => this.restore(snapshot),
    });
    this.loading = new LoadingController({ render: deps.render, ui: deps.ui, setScreen: (screen) => this.view.set(screen) });
    const parts = controllerIntents(this.c, () => this.simulation);
    this.intents = composeIntents(this, parts);
    void this.refreshSlots();
  }

  get sim(): Simulation {
    return this.simulation;
  }

  get screen(): Screen {
    return this.view.screen;
  }

  /** True while the player is in control (playing, no dialogue, no menu). */
  get inControl(): boolean {
    return this.view.inControl;
  }

  /** The character menu is open; the app draws the preview instead of the game. */
  get characterScreenOpen(): boolean {
    return this.view.characterScreenOpen;
  }

  step(input: InputFrame): void {
    this.loop.step(input);
  }

  render(alpha: number): void {
    this.loop.render(alpha);
  }

  syncHud(): void {
    this.loop.syncHud();
  }

  // ---- SessionIntents ----

  /** A new game on `difficulty` (ADR-0066), chosen before the loading screen; "normal" without. */
  newGame(difficulty?: DifficultyProfile): void {
    const { seed, crowd, traffic } = this.deps;
    this.replaceSimulation(Simulation.create({ seed: seed(), bus: this.bus, crowd: crowd ?? "off", traffic: traffic ?? crowd ?? "off", ...(difficulty ? { difficulty } : {}) }));
    this.narrative.resetState();
    this.c.hints.start();
    this.startPlaying(() => {
      const locale = this.deps.ui.getState().settings.locale;
      pushToastTimed(this.deps.ui, "system", translate(locale, "newGame.place"), translate(locale, "newGame.intro"));
    });
  }

  /** True while a new game or a load waits behind the loading screen (ADR-0057). */
  get preparing(): boolean {
    return this.loading.loading;
  }

  /** Into the game through the loading screen, where the renderer prepares the start (ADR-0057). */
  private startPlaying(play: () => void = () => {}): void {
    const at = this.simulation.player()?.position ?? { x: 0, y: 0, z: 0 };
    this.loading.start(at, play);
  }

  resume(): void {
    if (this.screen === "paused") this.view.set("playing");
  }

  pause(): void {
    if (!this.inControl) return;
    // A difficulty that waited for the end of a fight may be in force by now (ADR-0066).
    this.c.difficulty.sync();
    this.view.set("paused");
  }

  quitToTitle(): void {
    this.loading.cancel();
    this.view.closePanels();
    this.view.set("title");
    void this.refreshSlots();
  }

  save(slot: string): void { this.c.saves.save(slot); }
  load(slot: string): void { this.c.saves.load(slot); }
  exportSave(slot: string): void { this.c.saves.exportSave(slot); }
  exportAsync(slot: string): Promise<boolean> { return this.c.saves.exportAsync(slot); }
  importSave(text: string): void { this.c.saves.importSave(text); }
  importAsync(text: string): Promise<boolean> { return this.c.saves.importAsync(text); }
  snapshot(): SaveSnapshot { return this.c.saves.snapshot(); }
  saveAsync(slot: string): Promise<boolean> { return this.c.saves.saveAsync(slot); }
  loadAsync(slot: string): Promise<boolean> { return this.c.saves.loadAsync(slot); }
  refreshSlots(): Promise<void> { return this.c.saves.refreshSlots(); }
  /** The browser hid the page or is leaving it (main.tsx, `page-lifecycle.ts`): autosave now if it is safe. */
  pageHidden(): void { this.c.autosave.hidden(); }

  /**
   * Replaces the running game with `snapshot`, ink state included: a load without the slot.
   * It plays behind the loading screen (ADR-0057) unless `prepare` is false (the debug jump).
   */
  restore(snapshot: SaveSnapshot, prepare = true): void {
    this.view.closePanels();
    this.replaceSimulation(Simulation.fromSnapshot(snapshot, this.bus, this.deps.crowd ?? "off", this.deps.traffic ?? this.deps.crowd ?? "off"));
    this.c.wave1.inbox.clear();
    if (snapshot.narrative) this.narrative.loadState(snapshot.narrative);
    else this.narrative.resetState();
    if (prepare) this.startPlaying();
    else {
      this.loading.cancel();
      this.view.set("playing");
    }
  }

  // ---- debug API (main.tsx and debug-api.ts) ----

  /** Shows the breach minigame for a terminal (debug API for now; the terminals of the simulation will open it). */
  openBreach(terminalKey: string, daemons?: readonly BreachDaemonId[]): void { this.c.hack.openBreach(terminalKey, daemons); }
  /** Shows the line map of a kiosk (debug API; the kiosks of the simulation open it by interaction). */
  openMetro(from: MetroStationId): void { this.c.metro.open(from, false); }

  // ---- composition ----

  private replaceSimulation(next: Simulation): void {
    this.renderSync.reset();
    this.simulation = next;
    this.c.hud.reset(next);
    this.c.hack.reset();
    this.c.metro.reset();
    this.c.autosave.reset();
    this.c.difficulty.sync();
    this.deps.render.setCameraMode(next.domain.preferences.cameraMode);
    patchUi(this.deps.ui, { prompt: null, toasts: [] });
    this.render(0);
  }
}
