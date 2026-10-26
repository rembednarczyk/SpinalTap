import {
  type AudioPort,
  CorruptSaveError,
  type DomainEvents,
  EMPTY_INPUT,
  EventBus,
  type InputFrame,
  type PersistencePort,
  type RenderPort,
  type SaveSnapshot,
} from "@seki/core";
import { type DialogueView, NarrativeRuntime } from "@seki/narrative";
import { RenderSync, Simulation } from "@seki/sim";
import { type Screen, type UiIntents, type UiStore, dismissToast, patchUi, pushToast } from "@seki/ui";
import { bindEventPresenter } from "./event-presenter";
import { describeObjective, saveLabel } from "./objective";

export interface GameSessionDeps {
  readonly render: RenderPort;
  readonly audio: AudioPort;
  readonly persistence: PersistencePort;
  readonly ui: UiStore;
  readonly story: string;
  /** Seed for a new game. Injected so tests and reference mode are reproducible. */
  readonly seed: () => number;
  readonly now: () => Date;
  /** Called after every screen or dialogue change, e.g. to grab or release the pointer. */
  readonly onFocusChange?: (wantsPointer: boolean) => void;
}

const toDialogueVm = (v: DialogueView) => ({ lines: v.lines, choices: v.choices, ended: v.ended });

/**
 * Application service: owns the running simulation and coordinates narrative, persistence
 * and UI around it. Contains no browser or Babylon code, so the whole M0 loop runs headless.
 */
export class GameSession implements UiIntents {
  readonly bus = new EventBus<DomainEvents>();
  readonly narrative: NarrativeRuntime;
  private readonly renderSync: RenderSync;
  private simulation: Simulation;
  private dialogueOpen = false;

  constructor(private readonly deps: GameSessionDeps) {
    this.narrative = new NarrativeRuntime(deps.story, (cmd) => this.simulation.enqueue(cmd));
    this.renderSync = new RenderSync(deps.render);
    this.simulation = Simulation.create({ seed: deps.seed(), bus: this.bus });
    bindEventPresenter(this.bus, deps.render, deps.audio, deps.ui, {
      playerId: () => this.simulation.player()?.id ?? null,
      onDialogue: (id) => this.openDialogue(id),
      onPlayerDied: () => this.setScreen("dead"),
    });
    void this.refreshSlots();
  }

  get sim(): Simulation {
    return this.simulation;
  }

  get screen(): Screen {
    return this.deps.ui.getState().screen;
  }

  /** True while the player is in control (playing, no dialogue). */
  get inControl(): boolean {
    return this.screen === "playing" && !this.dialogueOpen;
  }

  /** The simulation only advances while playing; dialogue freezes the player but not the world. */
  get running(): boolean {
    return this.screen === "playing";
  }

  step(input: InputFrame): void {
    if (!this.running) return;
    this.simulation.step(this.inControl ? input : EMPTY_INPUT);
  }

  render(alpha: number): void {
    this.renderSync.sync(this.simulation.world, alpha);
    this.syncHud();
  }

  syncHud(): void {
    const sim = this.simulation;
    const player = sim.player();
    const { title, objective } = describeObjective(sim.domain);
    patchUi(this.deps.ui, {
      hp: player?.health?.current ?? 0,
      maxHp: player?.health?.max ?? 100,
      eddies: sim.domain.wallet.eddies,
      alias: sim.domain.character.alias,
      questTitle: title,
      objective,
      cameraMode: sim.domain.preferences.cameraMode,
      memories: sim.domain.character.memories,
    });
  }

  // ---- UiIntents ----

  newGame(): void {
    this.replaceSimulation(Simulation.create({ seed: this.deps.seed(), bus: this.bus }));
    this.narrative.resetState();
    this.setScreen("playing");
    pushToastTimed(this.deps.ui, "system", "Shinsekai, kwartał 7", "Budzisz się obok wraku. Nie pamiętasz swojego imienia.");
  }

  resume(): void {
    if (this.screen === "paused") this.setScreen("playing");
  }

  pause(): void {
    if (this.screen === "playing" && !this.dialogueOpen) this.setScreen("paused");
  }

  quitToTitle(): void {
    this.closeDialogueSilently();
    this.setScreen("title");
    void this.refreshSlots();
  }

  choose(index: number): void {
    if (!this.dialogueOpen) return;
    this.deps.audio.play("ui-select");
    patchUi(this.deps.ui, { dialogue: toDialogueVm(this.narrative.choose(index)) });
  }

  closeDialogue(): void {
    if (!this.dialogueOpen) return;
    this.closeDialogueSilently();
    this.simulation.enqueue({ type: "end-dialogue" });
    this.deps.onFocusChange?.(this.inControl);
  }

  save(slot: string): void {
    void this.saveAsync(slot);
  }

  load(slot: string): void {
    void this.loadAsync(slot);
  }

  // ---- async persistence ----

  snapshot(): SaveSnapshot {
    const { objective } = describeObjective(this.simulation.domain);
    return this.simulation.snapshot(this.narrative.saveState(), saveLabel(this.deps.now()), objective ?? "");
  }

  async saveAsync(slot: string): Promise<boolean> {
    if (this.dialogueOpen || this.screen === "dead" || this.screen === "title") {
      pushToastTimed(this.deps.ui, "system", "Nie można teraz zapisać");
      return false;
    }
    patchUi(this.deps.ui, { busy: true });
    try {
      await this.deps.persistence.save(slot, this.snapshot());
      this.deps.audio.play("save");
      pushToastTimed(this.deps.ui, "system", "Zapisano grę", slot === "quick" ? "Szybki zapis" : slot);
      return true;
    } catch (e) {
      pushToastTimed(this.deps.ui, "system", "Zapis nieudany", String(e));
      return false;
    } finally {
      patchUi(this.deps.ui, { busy: false });
      await this.refreshSlots();
    }
  }

  async loadAsync(slot: string): Promise<boolean> {
    patchUi(this.deps.ui, { busy: true });
    try {
      const snapshot = await this.deps.persistence.load(slot);
      if (!snapshot) {
        pushToastTimed(this.deps.ui, "system", "Pusty slot", slot);
        return false;
      }
      this.closeDialogueSilently();
      this.replaceSimulation(Simulation.fromSnapshot(snapshot, this.bus));
      if (snapshot.narrative) this.narrative.loadState(snapshot.narrative);
      else this.narrative.resetState();
      this.setScreen("playing");
      pushToastTimed(this.deps.ui, "system", "Wczytano grę", snapshot.meta.label);
      return true;
    } catch (e) {
      const text = e instanceof CorruptSaveError ? "Plik zapisu jest uszkodzony." : String(e);
      pushToastTimed(this.deps.ui, "system", "Nie udało się wczytać", text);
      return false;
    } finally {
      patchUi(this.deps.ui, { busy: false });
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

  // ---- internals ----

  private openDialogue(dialogueId: string): void {
    this.dialogueOpen = true;
    patchUi(this.deps.ui, { dialogue: toDialogueVm(this.narrative.start(dialogueId, this.simulation.domain)), prompt: null });
    this.deps.onFocusChange?.(false);
  }

  private closeDialogueSilently(): void {
    this.dialogueOpen = false;
    patchUi(this.deps.ui, { dialogue: null });
  }

  private replaceSimulation(next: Simulation): void {
    this.renderSync.reset();
    this.simulation = next;
    this.deps.render.setCameraMode(next.domain.preferences.cameraMode);
    patchUi(this.deps.ui, { prompt: null, toasts: [] });
    this.render(0);
  }

  private setScreen(screen: Screen): void {
    patchUi(this.deps.ui, { screen });
    this.deps.onFocusChange?.(this.inControl);
  }
}

const pushToastTimed = (ui: UiStore, kind: "system", title: string, text = "") => {
  const id = pushToast(ui, { kind, title, text });
  setTimeout(() => dismissToast(ui, id), 4500);
};
