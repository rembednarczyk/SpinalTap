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
import { type Screen, type SessionIntents, type UiIntents, patchUi } from "@seki/ui";
import { type Controllers, createControllers } from "./controllers/compose";
import { LoadingController } from "./controllers/loading-controller";
import { buildCityMap } from "./city-map";
import { narrativeText } from "./content-text";
import { composeIntents, controllerIntents } from "./intents";
import type { GameSessionDeps } from "./session-deps";
import { SessionFlow } from "./session-flow";
import { SessionLoop } from "./session-loop";
import { SessionScreen } from "./session-screen";

export { RECALL_CALM_TICKS } from "./controllers/hud-sync";
export type { GameSessionDeps, HintsHost, SettingsHost } from "./session-deps";

/**
 * Application service: the facade of a running game for `main.tsx`, the debug API and the UI
 * (ADR-0031). Its parts: `SessionFlow` (the simulation, new game, pause, load), `SessionLoop`
 * (step and frame), `SessionScreen` (the screen and the panels); the saves go to
 * `SaveController`, the other intents come from the controllers, composed in `intents.ts`. Contains no browser
 * or Babylon code, so the whole M0 loop runs headless.
 */
export class GameSession implements SessionIntents {
  readonly bus = new EventBus<DomainEvents>();
  /** Everything the UI can ask: the session's own intents and each controller's part. */
  readonly intents: UiIntents;
  readonly narrative: NarrativeRuntime;
  private readonly flow: SessionFlow;
  private readonly loop: SessionLoop;
  private readonly view: SessionScreen;
  private readonly c: Controllers;

  constructor(deps: GameSessionDeps) {
    // The ink in the player's language from the start, the narrative's own words (speakers' roles,
    // a contract's variation) in the language of the moment (ADR-0056).
    this.narrative = new NarrativeRuntime(deps.story, (cmd) => this.flow.sim.enqueue(cmd), {
      locale: deps.ui.getState().settings.locale,
      text: narrativeText(() => deps.ui.getState().settings.locale),
    });
    // Lublin's terrain, surfaces and buildings are drawn for good, streamed in or not (ADR-0045).
    const renderSync = new RenderSync(deps.render, deps.scenery === false ? [] : WORLD_SCENERY);
    const initial = Simulation.create({ seed: deps.seed(), bus: this.bus, crowd: deps.crowd ?? "off", traffic: deps.traffic ?? deps.crowd ?? "off" });
    // The whole city (ADR-0045): Lublin's streets, buildings and names under the game's decks and links (ADR-0021).
    patchUi(deps.ui, { map: buildCityMap() });
    const controllers = () => this.c;
    const view = (this.view = new SessionScreen({ ui: deps.ui, controllers }));
    this.loop = new SessionLoop({ ui: deps.ui, renderSync, sim: () => this.flow.sim, controllers, screen: view });
    // The loading screen in front of a new game and a load (ADR-0057).
    const loading = new LoadingController({ render: deps.render, ui: deps.ui, setScreen: (screen) => view.set(screen) });
    const render = (alpha: number) => this.loop.render(alpha);
    this.flow = new SessionFlow({ session: deps, bus: this.bus, narrative: this.narrative, renderSync, screen: view, loading, controllers, render, initial });
    this.c = createControllers(deps, {
      bus: this.bus,
      narrative: this.narrative,
      sim: () => this.flow.sim,
      screen: () => view.screen,
      inControl: () => view.inControl,
      setScreen: (screen) => view.set(screen),
      interrupt: () => view.interruptDialogue(),
      restore: (snapshot) => this.flow.restore(snapshot),
    });
    this.intents = composeIntents(this, controllerIntents(this.c, () => this.flow.sim));
    void this.refreshSlots();
  }

  get sim(): Simulation {
    return this.flow.sim;
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

  /** True while a new game or a load waits behind the loading screen (ADR-0057). */
  get preparing(): boolean {
    return this.flow.preparing;
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

  /** A new game on `difficulty` (ADR-0066), chosen before the loading screen; "normal" without. */
  newGame(difficulty?: DifficultyProfile): void {
    this.flow.newGame(difficulty);
  }

  resume(): void {
    this.flow.resume();
  }

  pause(): void {
    this.flow.pause();
  }

  quitToTitle(): void {
    this.flow.quitToTitle();
  }

  /** Replaces the running game with `snapshot`; behind the loading screen unless `prepare` is false (the debug jump). */
  restore(snapshot: SaveSnapshot, prepare = true): void {
    this.flow.restore(snapshot, prepare);
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
  pageHidden(): void {
    this.c.autosave.hidden();
  }

  // ---- debug API (main.tsx and debug-api.ts) ----

  /** Shows the breach minigame for a terminal (debug API for now; the terminals of the simulation will open it). */
  openBreach(terminalKey: string, daemons?: readonly BreachDaemonId[]): void { this.c.hack.openBreach(terminalKey, daemons); }
  /** Shows the line map of a kiosk (debug API; the kiosks of the simulation open it by interaction). */
  openMetro(from: MetroStationId): void { this.c.metro.open(from, false); }
}
