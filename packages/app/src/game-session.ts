import {
  ABILITY_CATALOG,
  type AudioPort,
  type BreachDaemonId,
  type QuickhackSlotInput,
  type CyberwareId,
  type CyberwareSlot,
  type ItemRef,
  type ShopId,
  type ShopItemId,
  type EquipSlot,
  type GameCommand,
  type ModSlot,
  stackRoom,
  loadoutAbility,
  CorruptSaveError,
  type DomainEvents,
  type EntityId,
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
  pendingScene,
  secondOfDay,
} from "@seki/core";
import { type DialogueView, NarrativeRuntime } from "@seki/narrative";
import { DISTRICTS, type DistrictId, type Entity, RenderSync, SIM_HZ, Simulation, WORLD_CHUNKS } from "@seki/sim";
import {
  type AbilityVm,
  type CharacterTab,
  type PreviewRect,
  type Screen,
  type SettingsVm,
  type UiIntents,
  type UiStore,
  characterTabState,
  dismissToast,
  patchUi,
  pushToast,
} from "@seki/ui";
import { bindKey, controlsVm, keymapFor } from "./controls";
import { type HintDef, HintTracker } from "./hints";
import { type PreviewHost, createAppearanceCache, createStatsCache } from "./character-view";
import { bindEventPresenter } from "./event-presenter";
import { createJournalCache } from "./journal";
import { buildDistrictMap, createMinimapTracker } from "./minimap";
import { needsReload, sanitizeSettings } from "./settings";
import { describeObjective, saveLabel } from "./objective";
import { createWeaponHud } from "./weapon-hud";
import { createLootTracker } from "./loot-view";
import { createTradeTracker } from "./trade-view";
import { createKnotRenderer } from "./phone";
import { Wave1Hud } from "./wave1-hud";

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
  /** 3D preview of the character menu (the engine's PreviewStage in the browser). */
  readonly preview?: PreviewHost;
  /** First-run hints already seen, and where to keep them (localStorage in the browser). */
  readonly hints?: HintsHost;
  /** Touch controls on screen: hints use touch words instead of keys. */
  readonly touch?: boolean;
}

export interface HintsHost {
  readonly seen: readonly string[];
  save(seen: readonly string[]): void;
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
/** HUD zoom (share of the hip field of view) is rounded to this step, like the spread. */
const ZOOM_STEP = 0.01;
/** Mouth movement per character of a spoken line, seconds. */
const TALK_SECONDS_PER_CHAR = 0.05;

/** The player's current field of view as a share of the hip one: 1 + (zoom - 1) * aim (ADR-0019). */
const aimZoomOf = (player: Entity | undefined): number => {
  const zoom = player?.combatant?.stats?.ads?.zoom ?? 1;
  const aim = player?.posture?.aim ?? 0;
  return Math.round((1 + (zoom - 1) * aim) / ZOOM_STEP) * ZOOM_STEP;
};

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
  /** The character menu is open: the clock stands (ADR-0015). */
  private characterOpen = false;
  /**
   * Last rectangle the menu's preview box reported. React runs the box's effect before the
   * screen's own, so the rectangle can arrive just before the menu says it opened.
   */
  private previewRect: PreviewRect | null = null;
  private readonly appearance = createAppearanceCache();
  private readonly characterStats = createStatsCache();
  private readonly lootView = createLootTracker();
  private lastAbilityVm: AbilityVm | null = null;
  private readonly journal = createJournalCache();
  private readonly minimap = createMinimapTracker();
  private readonly weaponHud = createWeaponHud();
  private readonly appliedSettings: SettingsVm;
  /** Last district the player was seen in; a change raises a toast. */
  private district: DistrictId | null = null;
  private readonly hints: HintTracker;
  /** Hint shown last, so the store changes only when it does. */
  private hintShown: HintDef | null = null;
  private lastPlayerPos: { x: number; z: number } | null = null;
  /** Who the player is talking to (from InteractionStarted), for the mouth movement. */
  private talkTarget: EntityId | null = null;
  /** Daylight level last sent to the renderer; null after the views were cleared. */
  private daylightSent: number | null = null;
  // Wave 1 (ADR-0028).
  private readonly wave1: Wave1Hud;
  private phoneOpen = false;
  /** Terminal of the breach minigame on screen, or null. */
  private breachKey: string | null = null;
  /** Touch: the scanner button is on, and a hack tapped in its list waits for the next step. */
  private touchScan = false;
  private touchHack: QuickhackSlotInput = 0;

  constructor(private readonly deps: GameSessionDeps) {
    this.narrative = new NarrativeRuntime(deps.story, (cmd) => this.simulation.enqueue(cmd));
    this.renderSync = new RenderSync(deps.render);
    this.simulation = Simulation.create({ seed: deps.seed(), bus: this.bus });
    this.hints = new HintTracker(new Set(deps.hints?.seen ?? []), (seen) => deps.hints?.save(seen), () => this.simulation.player()?.id ?? null);
    for (const type of ["InteractionFocusChanged", "InteractionStarted", "ContractAccepted", "ShotFired", "LootDropped", "LootTaken", "WeaponSwitched", "QuestAdvanced"] as const) {
      this.bus.on(type, (e) => this.hints.onEvent(type, e));
    }
    // Before the presenter, which opens the conversation on the same event.
    this.bus.on("InteractionStarted", (e) => {
      if (e.kind === "dialogue" || e.kind === "shop") this.talkTarget = e.targetId;
    });
    bindEventPresenter(this.bus, deps.render, deps.audio, deps.ui, {
      playerId: () => this.simulation.player()?.id ?? null,
      onDialogue: (id) => this.openDialogue(id),
      onShop: (shopId, dialogueId) => this.openShop(shopId, dialogueId),
      onPlayerDied: () => this.setScreen("dead"),
      onDialogueInterrupted: () => this.interruptDialogue(),
      onLoot: (key) => this.openLoot(key),
    });
    this.wave1 = new Wave1Hud(this.bus, deps.ui, {
      playerId: () => this.simulation.player()?.id ?? null,
      domain: () => this.simulation.domain,
      clock: () => formatClock(this.simulation.clock),
      tick: () => this.simulation.tick,
      ticksPerSecond: SIM_HZ,
      damageMode: () => deps.ui.getState().settings.damageNumbers,
      renderKnot: createKnotRenderer(deps.story),
    });
    // The whole city, so the map keeps working past Shinsekai (the market deck, the footbridge, ADR-0021).
    patchUi(deps.ui, { map: buildDistrictMap(WORLD_CHUNKS.flatMap((c) => c.props)) });
    this.appliedSettings = deps.settings?.applied ?? deps.ui.getState().settings;
    patchUi(deps.ui, { settings: this.appliedSettings, controls: controlsVm(this.appliedSettings.bindings), reloadNeeded: false });
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
    return this.screen === "playing" && !this.dialogueOpen && !this.shopOpen && this.lootKey === null && !this.characterOpen && !this.phoneOpen && this.breachKey === null;
  }

  /**
   * The simulation only advances while playing; dialogue freezes the player but not the world,
   * the character menu stops the clock.
   */
  get running(): boolean {
    return this.screen === "playing" && !this.characterOpen;
  }

  /** The character menu is open; the app draws the preview instead of the game. */
  get characterScreenOpen(): boolean {
    return this.characterOpen;
  }

  step(input: InputFrame): void {
    if (!this.running) return;
    this.simulation.step(this.inControl ? this.withTouchScan(input) : EMPTY_INPUT);
    patchUi(this.deps.ui, { scanning: this.inControl && (input.scan || this.touchScan) });
    this.playPendingRecall();
    this.stepHints();
  }

  /**
   * The touch scanner (ADR-0028): the HUD button and a tap on the hack list go into the input
   * frame here, as the keyboard's Z and number keys do. The virtual pad can take this over.
   */
  private withTouchScan(input: InputFrame): InputFrame {
    const hack = this.touchHack;
    this.touchHack = 0;
    if (!this.touchScan && hack === 0) return input;
    const scan = input.scan || this.touchScan;
    return { ...input, scan, quickhack: input.quickhack || (scan ? hack : 0) };
  }

  /** The player fought within a few seconds or is hunted: the contextual HUD shows. */
  private get inCombat(): boolean {
    return !this.calm() || this.wave1.fighting || this.wave1.hunted;
  }

  /** First-run hints follow play; the store hears only about changes. */
  private stepHints(): void {
    const player = this.simulation.player();
    const p = player?.position ?? null;
    const last = this.lastPlayerPos;
    const moved = p && last ? Math.hypot(p.x - last.x, p.z - last.z) : 0;
    this.lastPlayerPos = p ? { x: p.x, z: p.z } : null;
    this.hints.tick({ dt: 1 / SIM_HZ, inControl: this.inControl, moved: moved < 2 ? moved : 0, sprinting: player?.posture?.sprinting ?? false, characterOpen: this.characterOpen });
    const settings = this.deps.ui.getState().settings;
    const hint = settings.hints && this.inControl ? this.hints.active : null;
    if (hint === this.hintShown) return;
    this.hintShown = hint;
    patchUi(this.deps.ui, { hint: hint ? this.hintVm(hint, settings.bindings) : null });
  }

  /** Keys of a hint through the player's bindings (first key of each control). */
  private hintVm(h: HintDef, bindings: SettingsVm["bindings"]) {
    if (this.deps.touch) return { id: h.id, keys: [], text: h.touchText ?? h.text };
    const map = keymapFor(bindings);
    const keys = h.keys.map((k) => (k.startsWith("code:") ? k.slice(5) : (map[k as keyof typeof map]?.[0] ?? ""))).filter(Boolean);
    return { id: h.id, keys, text: h.text };
  }

  /**
   * A recovered memory plays as a flashback as soon as the player is free again (after the
   * conversation or the clinic that triggered it), and so does the opening of act II. Driven
   * by domain state, so it survives a save.
   */
  private playPendingRecall(): void {
    const session = this.simulation.session;
    if (!this.inControl || session.gameOver) return;
    const scene = pendingScene(this.simulation.domain);
    if (!scene || !this.calm()) return;
    this.simulation.session.dialogueActive = true;
    this.openDialogue(scene);
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
    // Same frame as a menu command: the preview gets the new look before it draws.
    if (this.characterOpen) this.deps.preview?.setAppearance(this.appearance(this.simulation.domain));
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
    const hp = player?.health?.current ?? 0;
    const maxHp = player?.health?.max ?? 100;
    patchUi(this.deps.ui, {
      hp,
      maxHp,
      inventory: sim.domain.inventory,
      equipment: sim.domain.equipment,
      ammo: sim.domain.ammo,
      characterStats: this.characterStats(sim.domain, hp, maxHp),
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
      aiming: player?.posture?.aiming ?? false,
      aimZoom: aimZoomOf(player),
      blocking: player?.melee?.guard ?? false,
      journal: this.journal(sim.domain),
      clock: formatClock(sim.clock),
      day: dayOf(sim.clock),
      dayPhase: dayPhase(sim.clock),
      ...this.minimap(sim.world, sim.domain.flags, sim.domain.contracts),
      ...this.wave1HudFrame(player),
    });
  }

  private wave1HudFrame(player: Entity | undefined) {
    const combat = this.screen === "playing" && this.inCombat;
    // The open phone shows the messages itself; banners wait.
    const talking = this.dialogueOpen || this.shopOpen || this.lootKey !== null || this.breachKey !== null || this.phoneOpen;
    const busy = talking || combat;
    const calm = !busy && !this.characterOpen && this.wave1.heatLevel === 0 && !this.deps.ui.getState().scanning;
    return { combat, ...this.wave1.sync({ world: this.simulation.world, player, busy, calm }) };
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

  // Phone, debrief, scanner and breach (ADR-0028).

  openPhone(): void {
    if (this.screen !== "playing" || this.dialogueOpen || this.shopOpen || this.lootKey !== null || this.characterOpen || this.breachKey !== null) return;
    if (this.phoneOpen) return;
    this.phoneOpen = true;
    patchUi(this.deps.ui, { phoneOpen: true, prompt: null });
    this.deps.audio.play("ui-select");
    this.deps.onFocusChange?.(false);
  }

  closePhone(): void {
    if (!this.phoneOpen) return;
    this.phoneOpen = false;
    patchUi(this.deps.ui, { phoneOpen: false });
    this.deps.onFocusChange?.(this.inControl);
  }

  readThread(from: string): void {
    this.wave1.readThread(from);
  }

  dismissDebrief(): void {
    patchUi(this.deps.ui, { debrief: null });
  }

  setScan(on: boolean): void {
    this.touchScan = on;
    if (!on) this.touchHack = 0;
  }

  pickQuickhack(slot: Exclude<QuickhackSlotInput, 0>): void {
    if (this.touchScan) this.touchHack = slot;
  }

  /**
   * Shows the breach minigame for a terminal (debug API for now; the terminals of the
   * simulation will open it). The player stands still while it is on screen.
   */
  openBreach(terminalKey: string, daemons: readonly BreachDaemonId[] = ["icepick", "datamine", "mass_vulnerability"]): void {
    if (!this.inControl && this.breachKey === null) return;
    this.breachKey = terminalKey;
    patchUi(this.deps.ui, { breach: { terminalKey, daemons: daemons.slice(0, 3) }, prompt: null });
    this.deps.onFocusChange?.(false);
  }

  /** The minigame ended: the simulation applies what was won (`breach-result`). */
  submitBreach(daemons: readonly BreachDaemonId[]): void {
    const terminalKey = this.breachKey;
    if (terminalKey === null) return;
    this.breachKey = null;
    patchUi(this.deps.ui, { breach: null });
    this.simulation.enqueue({ type: "breach-result", terminalKey, daemons: [...daemons] });
    this.deps.audio.play(daemons.length > 0 ? "quest-update" : "denied");
    this.deps.onFocusChange?.(this.inControl);
  }

  newGame(): void {
    this.replaceSimulation(Simulation.create({ seed: this.deps.seed(), bus: this.bus }));
    this.narrative.resetState();
    this.hints.start();
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

  // ---- character menu (plan §7, §8.5) ----

  /** The UI opened the menu (I, Tab, J or the touch button) or moved to another tab. */
  openCharacterScreen(tab: CharacterTab): void {
    if (this.screen !== "playing" || this.dialogueOpen || this.shopOpen || this.lootKey !== null) {
      patchUi(this.deps.ui, characterTabState(null));
      return;
    }
    patchUi(this.deps.ui, { ...characterTabState(tab), prompt: null });
    if (this.characterOpen) return;
    this.characterOpen = true;
    this.deps.preview?.setAppearance(this.appearance(this.simulation.domain));
    this.deps.preview?.setViewport(this.previewRect);
    this.deps.onFocusChange?.(false);
  }

  closeCharacterScreen(): void {
    if (!this.characterOpen) return;
    this.closeCharacterSilently();
    this.deps.onFocusChange?.(this.inControl);
  }

  setPreviewViewport(rect: PreviewRect | null): void {
    this.previewRect = rect;
    if (this.characterOpen) this.deps.preview?.setViewport(rect);
  }

  rotatePreview(deltaYaw: number): void {
    this.deps.preview?.rotate(deltaYaw);
  }

  resetPreview(): void {
    this.deps.preview?.reset();
  }

  equip(uid: string, slot?: EquipSlot): void {
    this.menuCommand(slot === undefined ? { type: "equip-item", uid } : { type: "equip-item", uid, slot });
  }

  unequip(slot: EquipSlot): void {
    this.menuCommand({ type: "unequip-item", slot });
  }

  useItem(ref: ItemRef): void {
    this.menuCommand({ type: "use-item", ref });
  }

  dropItem(ref: ItemRef, qty: number): void {
    this.menuCommand({ type: "drop-item", ref, qty });
  }

  installMod(weaponUid: string, modUid: string): void {
    this.menuCommand({ type: "install-mod", weaponUid, modUid });
  }

  removeMod(weaponUid: string, slot: ModSlot): void {
    this.menuCommand({ type: "remove-mod", weaponUid, slot });
  }

  /**
   * A command from the menu applies at once although the clock stands: the command phase of
   * the next step runs now (`applyPendingCommands`), and the menu, the HUD and the preview see
   * the result in this frame.
   */
  private menuCommand(cmd: GameCommand): void {
    if (!this.characterOpen) return;
    this.simulation.enqueue(cmd);
    this.simulation.applyPendingCommands();
    this.syncHud();
    this.deps.preview?.setAppearance(this.appearance(this.simulation.domain));
  }

  private closeCharacterSilently(): void {
    this.characterOpen = false;
    this.deps.preview?.setViewport(null);
    patchUi(this.deps.ui, characterTabState(null));
  }

  changeSettings(patch: Partial<SettingsVm>): void {
    const current = this.deps.ui.getState().settings;
    const next = sanitizeSettings({ ...current, ...patch }, current);
    patchUi(this.deps.ui, { settings: next, controls: controlsVm(next.bindings), reloadNeeded: needsReload(this.appliedSettings, next) });
    this.deps.settings?.save(next);
  }

  bindKey(action: string, code: string): void {
    this.changeSettings({ bindings: bindKey(this.deps.ui.getState().settings.bindings, action, code) });
  }

  resetControls(): void {
    this.changeSettings({ bindings: {} });
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
    patchUi(this.deps.ui, { dialogue: toDialogueVm(this.speak(this.narrative.choose(index))) });
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
      this.restore(snapshot);
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

  /** Replaces the running game with `snapshot`, ink state included: a load without the slot. */
  restore(snapshot: SaveSnapshot): void {
    this.closeDialogueSilently();
    this.replaceSimulation(Simulation.fromSnapshot(snapshot, this.bus));
    this.wave1.inbox.clear();
    if (snapshot.narrative) this.narrative.loadState(snapshot.narrative);
    else this.narrative.resetState();
    this.setScreen("playing");
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
    const view = this.narrative.start(dialogueId, this.simulation.domain, { tick: this.simulation.tick, ticksPerSecond: SIM_HZ });
    patchUi(this.deps.ui, { dialogue: toDialogueVm(this.speak(view)), prompt: null });
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

  /**
   * The conversation partner's mouth moves while its new lines are on screen: about one
   * reading speed (a twentieth of a second per character), narration excluded.
   */
  private speak(view: DialogueView): DialogueView {
    const target = this.talkTarget;
    if (target !== null) {
      const chars = view.lines.filter((l) => l.speaker !== null && l.speaker !== this.simulation.domain.character.alias).reduce((n, l) => n + l.text.length, 0);
      this.deps.render.playEffect({ kind: "talk", entityId: target, seconds: chars === 0 ? 0 : Math.min(6, Math.max(0.6, chars * TALK_SECONDS_PER_CHAR)) });
    }
    return view;
  }

  private closeDialogueSilently(): void {
    if (this.talkTarget !== null) this.deps.render.playEffect({ kind: "talk", entityId: this.talkTarget, seconds: 0 });
    this.talkTarget = null;
    if (this.characterOpen) this.closeCharacterSilently();
    this.dialogueOpen = false;
    this.shopOpen = false;
    this.lootKey = null;
    this.phoneOpen = false;
    // A breach cut short sends nothing: the terminal stays as it was.
    this.breachKey = null;
    patchUi(this.deps.ui, { dialogue: null, shopOpen: false, loot: null, phoneOpen: false, breach: null });
  }

  private replaceSimulation(next: Simulation): void {
    this.renderSync.reset();
    this.daylightSent = null;
    this.simulation = next;
    this.wave1.reset();
    this.touchScan = false;
    this.touchHack = 0;
    this.district = next.district;
    this.deps.render.setCameraMode(next.domain.preferences.cameraMode);
    patchUi(this.deps.ui, { prompt: null, toasts: [] });
    this.render(0);
  }

  private setScreen(screen: Screen): void {
    if (screen !== "playing" && this.characterOpen) this.closeCharacterSilently();
    patchUi(this.deps.ui, { screen });
    this.deps.onFocusChange?.(this.inControl);
  }
}

const DAYLIGHT_STEPS = 64;

const pushToastTimed = (ui: UiStore, kind: "system", title: string, text = "") => {
  const id = pushToast(ui, { kind, title, text });
  setTimeout(() => dismissToast(ui, id), 4500);
};
