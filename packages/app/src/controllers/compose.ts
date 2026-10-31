import { type DomainEvents, type EventBus, type SaveSnapshot, formatClock } from "@seki/core";
import type { NarrativeRuntime } from "@seki/narrative";
import { SIM_HZ } from "@seki/sim";
import type { RadioStationId, Screen } from "@seki/ui";
import { bindEventPresenter } from "../event-presenter";
import { stationOfDistrict } from "../metro";
import { type KnotLines, type KnotPool, createKnotLines, createKnotPool, createKnotRenderer } from "../phone";
import type { GameSessionDeps } from "../session-deps";
import { Wave1Hud } from "../wave1-hud";
import { Wave2Hud } from "../wave2-hud";
import { MetroController } from "./metro-controller";
import { RadioController } from "./radio-controller";
import { CharacterMenuController } from "./character-menu-controller";
import { DialogueController } from "./dialogue-controller";
import { HackController } from "./hack-controller";
import { HintSync } from "./hint-sync";
import { HudSync } from "./hud-sync";
import { LootController } from "./loot-controller";
import { PhoneController } from "./phone-controller";
import { autosaveView } from "../presenters/autosave";
import { AutosaveController } from "./autosave-controller";
import { SaveController } from "./save-controller";
import { SettingsController } from "./settings-controller";
import { type Focus, type SimRef, focusOf, pushToastTimed } from "./shared";
import { ShopController } from "./shop-controller";

/** What the controllers need from the session that composes them. */
export interface SessionHooks {
  readonly bus: EventBus<DomainEvents>;
  readonly narrative: NarrativeRuntime;
  readonly sim: SimRef;
  screen(): Screen;
  inControl(): boolean;
  setScreen(screen: Screen): void;
  /** Violence cut a conversation, the shop or a bag short. */
  interrupt(): void;
  restore(snapshot: SaveSnapshot): void;
}

/** The controllers of one game session (ADR-0031). */
export interface Controllers {
  readonly focus: Focus;
  readonly hints: HintSync;
  readonly dialogue: DialogueController;
  readonly shop: ShopController;
  readonly loot: LootController;
  readonly character: CharacterMenuController;
  readonly settings: SettingsController;
  readonly phone: PhoneController;
  readonly hack: HackController;
  readonly saves: SaveController;
  readonly autosave: AutosaveController;
  readonly wave1: Wave1Hud;
  readonly hud: HudSync;
  // Wave 2 (ADR-0035).
  readonly wave2: Wave2Hud;
  readonly metro: MetroController;
  readonly radio: RadioController;
}

/** The metro and the radio: their ink pools come from one knot renderer shared with the phone. */
const createTravel = (deps: GameSessionDeps, s: SessionHooks, lines: KnotLines, focus: Focus, settings: SettingsController, wave1: Wave1Hud, canOpen: () => boolean) => {
  const { ui, audio } = deps;
  const domain = () => s.sim().domain;
  const metro = new MetroController({
    bus: s.bus,
    sim: s.sim,
    ui,
    audio,
    focus,
    canOpen,
    // The kiosk's own rule (ADR-0034): a running contract, active or cleared, with heat on.
    guarded: () => wave1.heatLevel > 0 && s.sim().domain.contracts.active !== null,
    rideLines: createKnotPool(lines, "metro_ride_", domain),
    toast: (title, text) => pushToastTimed(ui, "system", title, text),
  });
  const pools = new Map<RadioStationId, KnotPool>();
  const radio = new RadioController({
    ui,
    audio,
    changeSettings: (patch) => settings.changeSettings(patch),
    inserts: (station) => {
      let pool = pools.get(station);
      if (!pool) pools.set(station, (pool = createKnotPool(lines, `radio_${station}_`, domain)));
      return pool;
    },
    toast: (title, text) => pushToastTimed(ui, "radio", title, text),
  });
  return { metro, radio };
};

/**
 * Builds the controllers and binds the event presenter. The order on the bus matters: hints,
 * then the talk target (dialogue), then the presenter, then the wave 1 HUD.
 */
export const createControllers = (deps: GameSessionDeps, s: SessionHooks): Controllers => {
  const { bus, sim } = s;
  const { ui, audio, render } = deps;
  const focus = focusOf(deps.onFocusChange, s.inControl);
  const hints = new HintSync({ bus, sim, ui, host: deps.hints, touch: deps.touch });
  const dialogue = new DialogueController({ bus, narrative: s.narrative, sim, ui, render, audio, focus });
  const shop = new ShopController({ sim, ui, focus, talk: (id) => dialogue.open(id) });
  const loot = new LootController({ sim, ui, focus });
  // Set below; the presenter only calls these hooks once the game runs.
  let metro: MetroController | null = null;
  let free = (): boolean => false;
  bindEventPresenter(bus, render, audio, ui, {
    playerId: () => sim().player()?.id ?? null,
    onDialogue: (id) => dialogue.open(id),
    // A ticket kiosk opens the line map, not ink (ADR-0034, ADR-0035).
    onMetro: (station) => {
      const from = station ?? stationOfDistrict(sim().district);
      if (from && metro) metro.open(from);
      else sim().enqueue({ type: "end-dialogue" });
    },
    onEncounter: (knot) => {
      if (free()) dialogue.open(knot);
    },
    onShop: (shopId, dialogueId) => shop.open(shopId, dialogueId),
    onPlayerDied: () => s.setScreen("dead"),
    onDialogueInterrupted: () => s.interrupt(),
    onLoot: (key) => loot.open(key),
  });
  const lines = createKnotLines(deps.story, () => ui.getState().settings.locale);
  const hudHooks = {
    playerId: () => sim().player()?.id ?? null,
    domain: () => sim().domain,
    clock: () => formatClock(sim().clock),
    tick: () => sim().tick,
    ticksPerSecond: SIM_HZ,
    damageMode: () => ui.getState().settings.damageNumbers,
    renderKnot: createKnotRenderer(lines, () => ui.getState().settings.locale),
  };
  const wave1 = new Wave1Hud(bus, ui, hudHooks);
  const wave2 = new Wave2Hud(bus, ui, hudHooks);
  // Playing, and no conversation, shop, bag or kiosk on screen.
  free = () => s.screen() === "playing" && !dialogue.isOpen && !shop.isOpen && !loot.isOpen && !metro?.isOpen && !metro?.riding;
  const settings = new SettingsController(ui, deps.settings);
  const travel = createTravel(deps, s, lines, focus, settings, wave1, () => free());
  metro = travel.metro;
  const hack = new HackController({ sim, ui, audio, focus, inControl: s.inControl });
  const character: CharacterMenuController = new CharacterMenuController({ sim, ui, focus, preview: deps.preview, canOpen: free, syncHud: () => hud.sync() });
  const phone = new PhoneController({ ui, audio, focus, canOpen: () => free() && !character.isOpen && !hack.breachOpen, readThread: (from) => wave1.readThread(from) });
  const hud: HudSync = new HudSync({
    sim,
    ui,
    render,
    wave1,
    wave2,
    panels: {
      screen: s.screen,
      talking: () => dialogue.isOpen || shop.isOpen || loot.isOpen || hack.breachOpen || phone.isOpen || travel.metro.isOpen,
      riding: () => travel.metro.riding,
      characterOpen: () => character.isOpen,
      loot: () => loot.lootFrame(),
      trade: () => shop.tradeFrame(),
    },
  });
  const canSave = () => !dialogue.isOpen && !shop.isOpen && !loot.isOpen && !travel.metro.isOpen && !travel.metro.riding && s.screen() !== "dead" && s.screen() !== "title" && s.screen() !== "loading";
  const saves = new SaveController({ persistence: deps.persistence, ui, audio, narrative: s.narrative, sim, now: deps.now, canSave, restore: s.restore });
  const autosave = new AutosaveController({
    bus,
    sim,
    enabled: () => ui.getState().settings.autosave,
    // In control (no panel, menu, breach or kiosk) or paused from there, out of combat, alive,
    // the story not over. A phone player often pauses before switching apps.
    safe: () => (s.inControl() || s.screen() === "paused") && canSave() && !hud.inCombat && !sim().session.gameOver && (sim().player()?.health?.current ?? 0) > 0,
    write: (slot) => saves.write(slot),
    view: autosaveView(ui, audio),
    ...(deps.autosaveIntervalTicks ? { intervalTicks: deps.autosaveIntervalTicks } : {}),
  });
  return { focus, hints, dialogue, shop, loot, character, settings, phone, hack, saves, autosave, wave1, hud, wave2, ...travel };
};
