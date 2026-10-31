import {
  type BreachDaemonId,
  type DomainEvents,
  EMPTY_INPUT,
  EventBus,
  type InputFrame,
  type MetroStationId,
  type SaveSnapshot,
  pendingScene,
} from "@seki/core";
import { NarrativeRuntime } from "@seki/narrative";
import { RenderSync, SIM_HZ, Simulation, WORLD_SCENERY } from "@seki/sim";
import { type Screen, type SessionIntents, type UiIntents, patchUi, translate } from "@seki/ui";
import { type Controllers, createControllers } from "./controllers/compose";
import { isCalm } from "./controllers/hud-sync";
import { LoadingController } from "./controllers/loading-controller";
import { pushToastTimed } from "./controllers/shared";
import { buildCityMap } from "./city-map";
import { narrativeText } from "./content-text";
import { composeIntents, controllerIntents } from "./intents";
import type { GameSessionDeps } from "./session-deps";

export { RECALL_CALM_TICKS } from "./controllers/hud-sync";
export type { GameSessionDeps, HintsHost, SettingsHost } from "./session-deps";

/**
 * Application service: owns the running simulation and the loop (step, render, screen) and the
 * session's own intents (new game, pause, saves). The other intents come from the controllers,
 * composed in `intents.ts` (ADR-0031). Contains no browser or Babylon code, so the whole M0
 * loop runs headless.
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

  constructor(private readonly deps: GameSessionDeps) {
    // The ink in the player's language from the start, the narrative's own words (speakers' roles,
    // a contract's variation) in the language of the moment (ADR-0056).
    this.narrative = new NarrativeRuntime(deps.story, (cmd) => this.simulation.enqueue(cmd), {
      locale: deps.ui.getState().settings.locale,
      text: narrativeText(() => deps.ui.getState().settings.locale),
    });
    // Lublin's terrain, surfaces and buildings are drawn for good, streamed in or not (ADR-0045).
    this.renderSync = new RenderSync(deps.render, deps.scenery === false ? [] : WORLD_SCENERY);
    this.simulation = Simulation.create({ seed: deps.seed(), bus: this.bus, crowd: deps.crowd ?? "off", traffic: deps.traffic ?? deps.crowd ?? "off" });
    // The whole city (ADR-0045): Lublin's streets, buildings and names under the game's decks and links (ADR-0021).
    patchUi(deps.ui, { map: buildCityMap() });
    this.c = createControllers(deps, {
      bus: this.bus,
      narrative: this.narrative,
      sim: () => this.simulation,
      screen: () => this.screen,
      inControl: () => this.inControl,
      setScreen: (screen) => this.setScreen(screen),
      interrupt: () => this.interruptDialogue(),
      restore: (snapshot) => this.restore(snapshot),
    });
    this.loading = new LoadingController({ render: deps.render, ui: deps.ui, setScreen: (screen) => this.setScreen(screen) });
    const parts = controllerIntents(this.c, () => this.simulation);
    this.intents = composeIntents(this, parts);
    void this.refreshSlots();
  }

  get sim(): Simulation {
    return this.simulation;
  }

  get screen(): Screen {
    return this.deps.ui.getState().screen;
  }

  /** True while the player is in control (playing, no dialogue, no menu). */
  get inControl(): boolean {
    const { dialogue, shop, loot, character, phone, hack, metro } = this.c;
    const panel = dialogue.isOpen || shop.isOpen || loot.isOpen || character.isOpen || phone.isOpen || hack.breachOpen || metro.isOpen || metro.riding;
    return this.screen === "playing" && !panel;
  }

  /**
   * The simulation only advances while playing; dialogue freezes the player but not the world,
   * the character menu stops the clock.
   */
  get running(): boolean {
    return this.screen === "playing" && !this.c.character.isOpen;
  }

  /** The character menu is open; the app draws the preview instead of the game. */
  get characterScreenOpen(): boolean {
    return this.c.character.isOpen;
  }

  step(input: InputFrame): void {
    if (!this.running) return;
    this.simulation.step(this.inControl ? this.c.hack.withTouchScan(input) : EMPTY_INPUT);
    this.c.metro.tick(1 / SIM_HZ);
    this.c.radio.tick(1 / SIM_HZ);
    patchUi(this.deps.ui, { scanning: this.inControl && this.c.hack.scanning(input) });
    this.playPendingRecall();
    this.c.hints.step(this.inControl, this.c.character.isOpen);
    this.c.autosave.step();
  }

  /**
   * A recovered memory plays as a flashback as soon as the player is free again (after the
   * conversation or the clinic that triggered it), and so does the opening of act II. Driven
   * by domain state, so it survives a save.
   */
  private playPendingRecall(): void {
    if (!this.inControl || this.simulation.session.gameOver) return;
    const scene = pendingScene(this.simulation.domain);
    if (!scene || !isCalm(this.simulation)) return;
    this.simulation.session.dialogueActive = true;
    this.c.dialogue.open(scene);
  }

  render(alpha: number): void {
    this.c.character.renderPreview();
    this.renderSync.sync(this.simulation.world, alpha, this.simulation.streamer.streamedOut, this.simulation.domain);
    this.c.hud.frame();
  }

  syncHud(): void {
    this.c.hud.sync();
  }

  // ---- SessionIntents ----

  newGame(): void {
    this.replaceSimulation(Simulation.create({ seed: this.deps.seed(), bus: this.bus, crowd: this.deps.crowd ?? "off", traffic: this.deps.traffic ?? this.deps.crowd ?? "off" }));
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
    if (this.screen === "paused") this.setScreen("playing");
  }

  pause(): void {
    if (this.inControl) this.setScreen("paused");
  }

  quitToTitle(): void {
    this.loading.cancel();
    this.closePanels();
    this.setScreen("title");
    void this.refreshSlots();
  }

  save(slot: string): void { this.c.saves.save(slot); }
  load(slot: string): void { this.c.saves.load(slot); }
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
    this.closePanels();
    this.replaceSimulation(Simulation.fromSnapshot(snapshot, this.bus, this.deps.crowd ?? "off", this.deps.traffic ?? this.deps.crowd ?? "off"));
    this.c.wave1.inbox.clear();
    if (snapshot.narrative) this.narrative.loadState(snapshot.narrative);
    else this.narrative.resetState();
    if (prepare) this.startPlaying();
    else {
      this.loading.cancel();
      this.setScreen("playing");
    }
  }

  // ---- debug API (main.tsx and debug-api.ts) ----

  /** Shows the breach minigame for a terminal (debug API for now; the terminals of the simulation will open it). */
  openBreach(terminalKey: string, daemons?: readonly BreachDaemonId[]): void { this.c.hack.openBreach(terminalKey, daemons); }
  /** Shows the line map of a kiosk (debug API; the kiosks of the simulation open it by interaction). */
  openMetro(from: MetroStationId): void { this.c.metro.open(from, false); }

  // ---- composition ----

  /**
   * The sim ended the conversation or the shop because the player came under fire (ADR-0016):
   * close the panel, give the controls back, and let ink drop the half-finished talk so it
   * can start over. No end-dialogue command: the sim has already cleared the flag.
   */
  private interruptDialogue(): void {
    if (!this.c.dialogue.isOpen && !this.c.shop.isOpen && !this.c.loot.isOpen) return;
    this.c.dialogue.interrupt();
    this.closePanels();
    this.c.focus.settle();
  }

  /** Every panel and the menu close without telling the simulation. */
  private closePanels(): void {
    const { dialogue, character, shop, loot, phone, hack, metro } = this.c;
    metro.closeSilently();
    dialogue.closeSilently();
    character.closeSilently();
    shop.closeSilently();
    loot.closeSilently();
    phone.closeSilently();
    hack.closeSilently();
  }

  private replaceSimulation(next: Simulation): void {
    this.renderSync.reset();
    this.simulation = next;
    this.c.hud.reset(next);
    this.c.hack.reset();
    this.c.metro.reset();
    this.c.autosave.reset();
    this.deps.render.setCameraMode(next.domain.preferences.cameraMode);
    patchUi(this.deps.ui, { prompt: null, toasts: [] });
    this.render(0);
  }

  private setScreen(screen: Screen): void {
    if (screen !== "playing") this.c.character.closeSilently();
    patchUi(this.deps.ui, { screen });
    this.c.focus.settle();
  }
}
