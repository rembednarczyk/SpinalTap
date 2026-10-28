import { type DomainEvents, type EventBus, type SaveSnapshot, formatClock } from "@seki/core";
import type { NarrativeRuntime } from "@seki/narrative";
import { SIM_HZ } from "@seki/sim";
import type { Screen } from "@seki/ui";
import { bindEventPresenter } from "../event-presenter";
import { createKnotRenderer } from "../phone";
import type { GameSessionDeps } from "../session-deps";
import { Wave1Hud } from "../wave1-hud";
import { CharacterMenuController } from "./character-menu-controller";
import { DialogueController } from "./dialogue-controller";
import { HackController } from "./hack-controller";
import { HintSync } from "./hint-sync";
import { HudSync } from "./hud-sync";
import { LootController } from "./loot-controller";
import { PhoneController } from "./phone-controller";
import { SaveController } from "./save-controller";
import { SettingsController } from "./settings-controller";
import { type Focus, type SimRef, focusOf } from "./shared";
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
  readonly wave1: Wave1Hud;
  readonly hud: HudSync;
}

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
  bindEventPresenter(bus, render, audio, ui, {
    playerId: () => sim().player()?.id ?? null,
    onDialogue: (id) => dialogue.open(id),
    onShop: (shopId, dialogueId) => shop.open(shopId, dialogueId),
    onPlayerDied: () => s.setScreen("dead"),
    onDialogueInterrupted: () => s.interrupt(),
    onLoot: (key) => loot.open(key),
  });
  const wave1 = new Wave1Hud(bus, ui, {
    playerId: () => sim().player()?.id ?? null,
    domain: () => sim().domain,
    clock: () => formatClock(sim().clock),
    tick: () => sim().tick,
    ticksPerSecond: SIM_HZ,
    damageMode: () => ui.getState().settings.damageNumbers,
    renderKnot: createKnotRenderer(deps.story),
  });
  // Playing, and no conversation, shop or bag on screen.
  const free = () => s.screen() === "playing" && !dialogue.isOpen && !shop.isOpen && !loot.isOpen;
  const hack = new HackController({ sim, ui, audio, focus, inControl: s.inControl });
  const character: CharacterMenuController = new CharacterMenuController({ sim, ui, focus, preview: deps.preview, canOpen: free, syncHud: () => hud.sync() });
  const phone = new PhoneController({ ui, audio, focus, canOpen: () => free() && !character.isOpen && !hack.breachOpen, readThread: (from) => wave1.readThread(from) });
  const hud: HudSync = new HudSync({
    sim,
    ui,
    render,
    wave1,
    panels: {
      screen: s.screen,
      talking: () => dialogue.isOpen || shop.isOpen || loot.isOpen || hack.breachOpen || phone.isOpen,
      characterOpen: () => character.isOpen,
      loot: () => loot.lootFrame(),
      trade: () => shop.tradeFrame(),
    },
  });
  const canSave = () => !dialogue.isOpen && !shop.isOpen && !loot.isOpen && s.screen() !== "dead" && s.screen() !== "title";
  const saves = new SaveController({ persistence: deps.persistence, ui, audio, narrative: s.narrative, sim, now: deps.now, canSave, restore: s.restore });
  return { focus, hints, dialogue, shop, loot, character, settings: new SettingsController(ui, deps.settings), phone, hack, saves, wave1, hud };
};
