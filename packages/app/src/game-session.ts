import {
  type BreachDaemonId,
  type CyberwareId,
  type CyberwareSlot,
  type DomainEvents,
  EMPTY_INPUT,
  type EquipSlot,
  EventBus,
  type InputFrame,
  type ItemRef,
  type ModSlot,
  type QuickhackSlotInput,
  type SaveSnapshot,
  type ShopItemId,
  pendingScene,
} from "@seki/core";
import { NarrativeRuntime } from "@seki/narrative";
import { RenderSync, Simulation, WORLD_CHUNKS } from "@seki/sim";
import { type CharacterTab, type PreviewRect, type Screen, type SettingsVm, type UiIntents, patchUi } from "@seki/ui";
import { type Controllers, createControllers } from "./controllers/compose";
import { isCalm } from "./controllers/hud-sync";
import { pushToastTimed } from "./controllers/shared";
import { buildDistrictMap } from "./minimap";
import type { GameSessionDeps } from "./session-deps";

export { RECALL_CALM_TICKS } from "./controllers/hud-sync";
export type { GameSessionDeps, HintsHost, SettingsHost } from "./session-deps";

/**
 * Application service: owns the running simulation and the loop (step, render, screen), and
 * composes the controllers that implement the UI intents (ADR-0031). Contains no browser or
 * Babylon code, so the whole M0 loop runs headless.
 */
export class GameSession implements UiIntents {
  readonly bus = new EventBus<DomainEvents>();
  readonly narrative: NarrativeRuntime;
  private readonly renderSync: RenderSync;
  private simulation: Simulation;
  private readonly c: Controllers;

  constructor(private readonly deps: GameSessionDeps) {
    this.narrative = new NarrativeRuntime(deps.story, (cmd) => this.simulation.enqueue(cmd));
    this.renderSync = new RenderSync(deps.render);
    this.simulation = Simulation.create({ seed: deps.seed(), bus: this.bus });
    // The whole city, so the map keeps working past Shinsekai (the market deck, the footbridge, ADR-0021).
    patchUi(deps.ui, { map: buildDistrictMap(WORLD_CHUNKS.flatMap((c) => c.props)) });
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
    const { dialogue, shop, loot, character, phone, hack } = this.c;
    return this.screen === "playing" && !dialogue.isOpen && !shop.isOpen && !loot.isOpen && !character.isOpen && !phone.isOpen && !hack.breachOpen;
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
    patchUi(this.deps.ui, { scanning: this.inControl && this.c.hack.scanning(input) });
    this.playPendingRecall();
    this.c.hints.step(this.inControl, this.c.character.isOpen);
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
    this.replaceSimulation(Simulation.create({ seed: this.deps.seed(), bus: this.bus }));
    this.narrative.resetState();
    this.c.hints.start();
    this.setScreen("playing");
    pushToastTimed(this.deps.ui, "system", "Shinsekai, kwartał 7", "Budzisz się na fotelu w klinice doktora Mori. Nie pamiętasz swojego imienia. Obok czeka Kaito.");
  }

  resume(): void {
    if (this.screen === "paused") this.setScreen("playing");
  }

  pause(): void {
    if (this.inControl) this.setScreen("paused");
  }

  quitToTitle(): void {
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

  /** Replaces the running game with `snapshot`, ink state included: a load without the slot. */
  restore(snapshot: SaveSnapshot): void {
    this.closePanels();
    this.replaceSimulation(Simulation.fromSnapshot(snapshot, this.bus));
    this.c.wave1.inbox.clear();
    if (snapshot.narrative) this.narrative.loadState(snapshot.narrative);
    else this.narrative.resetState();
    this.setScreen("playing");
  }

  // ---- the other intents, delegated to their controllers ----

  choose(index: number): void { this.c.dialogue.choose(index); }
  closeDialogue(): void { this.c.dialogue.closeDialogue(); }
  buyCyberware(id: CyberwareId): void { this.c.shop.buyCyberware(id); }
  buyItem(id: ShopItemId): void { this.c.shop.buyItem(id); }
  sellItem(ref: ItemRef, qty: number): void { this.c.shop.sellItem(ref, qty); }
  repairItem(uid: string, useParts: number): void { this.c.shop.repairItem(uid, useParts); }
  upgradeBackpack(): void { this.c.shop.upgradeBackpack(); }
  installCyberwareItem(uid: string): void { this.c.shop.installCyberwareItem(uid); }
  removeCyberware(slot: CyberwareSlot): void { this.c.shop.removeCyberware(slot); }
  closeShop(): void { this.c.shop.closeShop(); }
  talkToShopkeeper(): void { this.c.shop.talkToShopkeeper(); }
  takeLoot(line: number | "all"): void { this.c.loot.takeLoot(line); }
  closeLoot(): void { this.c.loot.closeLoot(); }
  openCharacterScreen(tab: CharacterTab): void { this.c.character.openCharacterScreen(tab); }
  closeCharacterScreen(): void { this.c.character.closeCharacterScreen(); }
  setPreviewViewport(rect: PreviewRect | null): void { this.c.character.setPreviewViewport(rect); }
  rotatePreview(deltaYaw: number): void { this.c.character.rotatePreview(deltaYaw); }
  resetPreview(): void { this.c.character.resetPreview(); }
  equip(uid: string, slot?: EquipSlot): void { this.c.character.equip(uid, slot); }
  unequip(slot: EquipSlot): void { this.c.character.unequip(slot); }
  useItem(ref: ItemRef): void { this.c.character.useItem(ref); }
  dropItem(ref: ItemRef, qty: number): void { this.c.character.dropItem(ref, qty); }
  installMod(weaponUid: string, modUid: string): void { this.c.character.installMod(weaponUid, modUid); }
  removeMod(weaponUid: string, slot: ModSlot): void { this.c.character.removeMod(weaponUid, slot); }
  changeSettings(patch: Partial<SettingsVm>): void { this.c.settings.changeSettings(patch); }
  bindKey(action: string, code: string): void { this.c.settings.bindKey(action, code); }
  resetControls(): void { this.c.settings.resetControls(); }
  reload(): void { this.c.settings.reload(); }
  openPhone(): void { this.c.phone.openPhone(); }
  closePhone(): void { this.c.phone.closePhone(); }
  readThread(from: string): void { this.c.phone.readThread(from); }
  dismissDebrief(): void { this.c.hud.dismissDebrief(); }
  trackQuest(questId: string | null): void { this.simulation.enqueue({ type: "track-quest", questId }); }
  setScan(on: boolean): void { this.c.hack.setScan(on); }
  pickQuickhack(slot: Exclude<QuickhackSlotInput, 0>): void { this.c.hack.pickQuickhack(slot); }
  submitBreach(daemons: readonly BreachDaemonId[]): void { this.c.hack.submitBreach(daemons); }
  /** Shows the breach minigame for a terminal (debug API for now; the terminals of the simulation will open it). */
  openBreach(terminalKey: string, daemons?: readonly BreachDaemonId[]): void { this.c.hack.openBreach(terminalKey, daemons); }

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
    const { dialogue, character, shop, loot, phone, hack } = this.c;
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
