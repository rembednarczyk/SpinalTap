import {
  ABILITY_CATALOG,
  type AudioPort,
  type CyberwareId,
  type CyberwareSlot,
  type ItemRef,
  type ShopId,
  type ShopItemId,
  stackRoom,
  loadoutAbility,
  CorruptSaveError,
  type DomainEvents,
  EMPTY_INPUT,
  EventBus,
  type InputFrame,
  type PersistencePort,
  type RenderPort,
  type SaveSnapshot,
  dayOf,
  dayPhase,
  daylight,
  formatClock,
  pendingRecall,
  recallDialogueId,
  secondOfDay,
} from "@seki/core";
import { type DialogueView, NarrativeRuntime } from "@seki/narrative";
import { DISTRICTS, DISTRICT_M0_PROPS, type DistrictId, RenderSync, SIM_HZ, Simulation } from "@seki/sim";
import { type AbilityVm, type Screen, type SettingsVm, type UiIntents, type UiStore, dismissToast, patchUi, pushToast } from "@seki/ui";
import { bindEventPresenter } from "./event-presenter";
import { createJournalCache } from "./journal";
import { buildDistrictMap, createMinimapTracker } from "./minimap";
import { needsReload, sanitizeSettings } from "./settings";
import { describeObjective, saveLabel } from "./objective";
import { createWeaponHud } from "./weapon-hud";
import { createLootTracker } from "./loot-view";
import { createTradeTracker } from "./trade-view";

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
  /** Where settings live (localStorage in the browser). Without it changes last for the session only. */
  readonly settings?: SettingsHost;
}

export interface SettingsHost {
  /** Settings the page started with; graphics quality stays at these until a reload. */
  readonly applied: SettingsVm;
  save(next: SettingsVm): void;
  reload(): void;
}

const toDialogueVm = (v: DialogueView) => ({ lines: v.lines, choices: v.choices, ended: v.ended });

/** A flashback waits this many ticks (5 s) after the last shot near the player, unless the shooter is down. */
export const RECALL_CALM_TICKS = 5 * SIM_HZ;
/** HUD aim spread is rounded to this many radians, so the store changes only when the cone visibly moves. */
const SPREAD_STEP = 0.002;

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
  private shopOpen = false;
  /** Counter behind the open shop panel, and the ink knot of its keeper ("Porozmawiaj"). */
  private shopId: ShopId = "clinic";
  private shopTalk = "mori";
  private readonly tradeView = createTradeTracker();
  /** Key of the bag being searched, or null. */
  private lootKey: string | null = null;
  private readonly lootView = createLootTracker();
  private lastAbilityVm: AbilityVm | null = null;
  private readonly journal = createJournalCache();
  private readonly minimap = createMinimapTracker();
  private readonly weaponHud = createWeaponHud();
  private readonly appliedSettings: SettingsVm;
  /** Last district the player was seen in; a change raises a toast. */
  private district: DistrictId | null = null;
  /** Daylight level last sent to the renderer; null after the views were cleared. */
  private daylightSent: number | null = null;

  constructor(private readonly deps: GameSessionDeps) {
    this.narrative = new NarrativeRuntime(deps.story, (cmd) => this.simulation.enqueue(cmd));
    this.renderSync = new RenderSync(deps.render);
    this.simulation = Simulation.create({ seed: deps.seed(), bus: this.bus });
    bindEventPresenter(this.bus, deps.render, deps.audio, deps.ui, {
      playerId: () => this.simulation.player()?.id ?? null,
      onDialogue: (id) => this.openDialogue(id),
      onShop: (shopId, dialogueId) => this.openShop(shopId, dialogueId),
      onPlayerDied: () => this.setScreen("dead"),
      onDialogueInterrupted: () => this.interruptDialogue(),
      onLoot: (key) => this.openLoot(key),
    });
    patchUi(deps.ui, { map: buildDistrictMap(DISTRICT_M0_PROPS) });
    this.appliedSettings = deps.settings?.applied ?? deps.ui.getState().settings;
    patchUi(deps.ui, { settings: this.appliedSettings, reloadNeeded: false });
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
    return this.screen === "playing" && !this.dialogueOpen && !this.shopOpen && this.lootKey === null;
  }

  /** The simulation only advances while playing; dialogue freezes the player but not the world. */
  get running(): boolean {
    return this.screen === "playing";
  }

  step(input: InputFrame): void {
    if (!this.running) return;
    this.simulation.step(this.inControl ? input : EMPTY_INPUT);
    this.playPendingRecall();
  }

  /**
   * A recovered memory plays as a flashback as soon as the player is free again (after the
   * conversation or the clinic that triggered it). Driven by domain state, so it survives a save.
   */
  private playPendingRecall(): void {
    const session = this.simulation.session;
    if (!this.inControl || session.gameOver) return;
    const memory = pendingRecall(this.simulation.domain);
    if (!memory || !this.calm()) return;
    this.simulation.session.dialogueActive = true;
    this.openDialogue(recallDialogueId(memory));
  }

  /** No shot near the player for RECALL_CALM_TICKS, or whoever fired it is down. */
  private calm(): boolean {
    const { session, tick, world } = this.simulation;
    const threat = session.lastThreat;
    if (threat === null || tick - threat.tick >= RECALL_CALM_TICKS) return true;
    for (const e of world.with("health")) if (e.id === threat.sourceId) return e.health.current <= 0;
    return true;
  }

  render(alpha: number): void {
    this.renderSync.sync(this.simulation.world, alpha, this.simulation.streamer.streamedOut, this.simulation.domain);
    this.syncTimeOfDay();
    this.announceDistrict();
    this.syncHud();
  }

  /**
   * Time of day reaches the renderer as world state (ADR-0017): a time-of-day effect whenever
   * the light level moves a step of 1/64, which is every ~2 game minutes at dawn and dusk and
   * never during the night or the day.
   */
  private syncTimeOfDay(): void {
    const clock = this.simulation.clock;
    const level = Math.round(daylight(clock) * DAYLIGHT_STEPS) / DAYLIGHT_STEPS;
    if (level === this.daylightSent) return;
    this.daylightSent = level;
    this.deps.render.playEffect({ kind: "time-of-day", daylight: level, hour: secondOfDay(clock) / 3600 });
  }

  /** Names the district when the player crosses into another one (streaming itself is silent). */
  private announceDistrict(): void {
    const next = this.simulation.district;
    if (next === null || next === this.district) return;
    const first = this.district === null;
    this.district = next;
    if (!first && this.screen === "playing") pushToastTimed(this.deps.ui, "system", DISTRICTS[next].name);
  }

  syncHud(): void {
    const sim = this.simulation;
    const loot = this.lootView(sim.domain, this.lootKey);
    // The bag was emptied (or expired) while open: the panel closes and the player moves again.
    if (this.lootKey !== null && loot === null) this.closeLoot();
    const player = sim.player();
    const { title, objective } = describeObjective(sim.domain, sim.tick);
    patchUi(this.deps.ui, {
      hp: player?.health?.current ?? 0,
      maxHp: player?.health?.max ?? 100,
      eddies: sim.domain.wallet.eddies,
      alias: sim.domain.character.alias,
      questTitle: title,
      objective,
      cameraMode: sim.domain.preferences.cameraMode,
      memories: sim.domain.character.memories,
      medkits: sim.domain.inventory.stacks.medkit ?? 0,
      medkitRoom: stackRoom(sim.domain.inventory, sim.domain.equipment, "medkit"),
      ability: this.abilityVm(),
      weapons: this.weaponHud(sim),
      loot,
      ...(this.shopOpen ? { trade: this.tradeView(sim.domain) } : {}),
      cyberware: sim.domain.character.cyberware,
      reputation: sim.domain.reputation,
      contractsDone: sim.domain.contracts.completed,
      aimSpread: Math.round(sim.aimSpread() / SPREAD_STEP) * SPREAD_STEP,
      crouched: player?.posture?.crouched ?? false,
      journal: this.journal(sim.domain),
      clock: formatClock(sim.clock),
      day: dayOf(sim.clock),
      dayPhase: dayPhase(sim.clock),
      ...this.minimap(sim.world, sim.domain.flags, sim.domain.contracts),
    });
  }

  private abilityVm(): AbilityVm | null {
    const id = loadoutAbility(this.simulation.domain.character.cyberware);
    if (!id) return null;
    const def = ABILITY_CATALOG[id];
    const s = this.simulation.domain.ability;
    // Rounded so the store only changes ~10 times a second, not every frame.
    const round = (n: number) => Math.ceil(n * 10) / 10;
    const next = { name: def.name, activeTime: round(s.activeTime), cooldown: round(s.cooldown), cooldownTotal: def.cooldown };
    const prev = this.lastAbilityVm;
    if (prev && prev.name === next.name && prev.activeTime === next.activeTime && prev.cooldown === next.cooldown) return prev;
    this.lastAbilityVm = next;
    return next;
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
    if (this.inControl) this.setScreen("paused");
  }

  /** Trade commands go out only while that counter is open. */
  private atCounter(shop: ShopId): boolean {
    return this.shopOpen && this.shopId === shop;
  }

  buyCyberware(id: CyberwareId): void {
    if (this.atCounter("clinic")) this.simulation.enqueue({ type: "buy-cyberware", cyberwareId: id });
  }

  buyItem(id: ShopItemId): void {
    if (this.shopOpen) this.simulation.enqueue({ type: "buy-item", itemId: id, shopId: this.shopId });
  }

  sellItem(ref: ItemRef, qty: number): void {
    if (this.shopOpen) this.simulation.enqueue({ type: "sell-item", shopId: this.shopId, ref, qty });
  }

  repairItem(uid: string, useParts: number): void {
    if (this.atCounter("oyaji")) this.simulation.enqueue({ type: "repair-item", uid, useParts });
  }

  upgradeBackpack(): void {
    if (this.atCounter("oyaji")) this.simulation.enqueue({ type: "upgrade-capacity" });
  }

  installCyberwareItem(uid: string): void {
    if (this.atCounter("clinic")) this.simulation.enqueue({ type: "install-cyberware-item", uid });
  }

  removeCyberware(slot: CyberwareSlot): void {
    if (this.atCounter("clinic")) this.simulation.enqueue({ type: "remove-cyberware", slot });
  }

  /** From the counter straight into a conversation with its keeper (ink knot `mori` or `oyaji`). */
  talkToShopkeeper(): void {
    if (!this.shopOpen) return;
    this.shopOpen = false;
    patchUi(this.deps.ui, { shopOpen: false });
    this.openDialogue(this.shopTalk);
  }

  closeShop(): void {
    if (!this.shopOpen) return;
    this.shopOpen = false;
    patchUi(this.deps.ui, { shopOpen: false });
    this.simulation.enqueue({ type: "end-dialogue" });
    this.deps.onFocusChange?.(this.inControl);
  }

  takeLoot(line: number | "all"): void {
    if (this.lootKey !== null) this.simulation.enqueue({ type: "take-loot", containerKey: this.lootKey, line });
  }

  closeLoot(): void {
    if (this.lootKey === null) return;
    this.lootKey = null;
    patchUi(this.deps.ui, { loot: null });
    this.simulation.enqueue({ type: "end-dialogue" });
    this.deps.onFocusChange?.(this.inControl);
  }

  changeSettings(patch: Partial<SettingsVm>): void {
    const current = this.deps.ui.getState().settings;
    const next = sanitizeSettings({ ...current, ...patch }, current);
    patchUi(this.deps.ui, { settings: next, reloadNeeded: needsReload(this.appliedSettings, next) });
    this.deps.settings?.save(next);
  }

  reload(): void {
    this.deps.settings?.reload();
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
    if (this.dialogueOpen || this.shopOpen || this.lootKey !== null || this.screen === "dead" || this.screen === "title") {
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
    patchUi(this.deps.ui, { dialogue: toDialogueVm(this.narrative.start(dialogueId, this.simulation.domain, { tick: this.simulation.tick, ticksPerSecond: SIM_HZ })), prompt: null });
    this.deps.onFocusChange?.(false);
  }

  private openLoot(key: string): void {
    this.lootKey = key;
    patchUi(this.deps.ui, { loot: this.lootView(this.simulation.domain, key), prompt: null });
    this.deps.onFocusChange?.(false);
  }

  private openShop(shopId: ShopId, dialogueId: string): void {
    this.shopOpen = true;
    this.shopId = shopId;
    this.shopTalk = dialogueId;
    patchUi(this.deps.ui, { shopOpen: true, shopId, trade: this.tradeView(this.simulation.domain), prompt: null });
    this.deps.onFocusChange?.(false);
  }

  /**
   * The sim ended the conversation or the shop because the player came under fire (ADR-0016):
   * close the panel, give the controls back, and let ink drop the half-finished talk so it
   * can start over. No end-dialogue command: the sim has already cleared the flag.
   */
  private interruptDialogue(): void {
    if (!this.dialogueOpen && !this.shopOpen && this.lootKey === null) return;
    if (this.dialogueOpen) this.narrative.interrupt();
    this.closeDialogueSilently();
    this.deps.onFocusChange?.(this.inControl);
  }

  private closeDialogueSilently(): void {
    this.dialogueOpen = false;
    this.shopOpen = false;
    this.lootKey = null;
    patchUi(this.deps.ui, { dialogue: null, shopOpen: false, loot: null });
  }

  private replaceSimulation(next: Simulation): void {
    this.renderSync.reset();
    this.daylightSent = null;
    this.simulation = next;
    this.district = next.district;
    this.deps.render.setCameraMode(next.domain.preferences.cameraMode);
    patchUi(this.deps.ui, { prompt: null, toasts: [] });
    this.render(0);
  }

  private setScreen(screen: Screen): void {
    patchUi(this.deps.ui, { screen });
    this.deps.onFocusChange?.(this.inControl);
  }
}

const DAYLIGHT_STEPS = 64;

const pushToastTimed = (ui: UiStore, kind: "system", title: string, text = "") => {
  const id = pushToast(ui, { kind, title, text });
  setTimeout(() => dismissToast(ui, id), 4500);
};
