import { type Screen, type UiStore, patchUi } from "@seki/ui";
import type { Controllers } from "./controllers/compose";

export interface SessionScreenDeps {
  readonly ui: UiStore;
  /** The session's controllers; created after this part, so read when needed. */
  readonly controllers: () => Controllers;
}

/**
 * The screen of the session and the panels over it (ADR-0031, a part of `GameSession`): who
 * has the controls, whether the clock runs, the screen change and closing every panel at once.
 */
export class SessionScreen {
  constructor(private readonly deps: SessionScreenDeps) {}

  get screen(): Screen {
    return this.deps.ui.getState().screen;
  }

  /** True while the player is in control (playing, no dialogue, no menu). */
  get inControl(): boolean {
    const { dialogue, shop, loot, character, phone, hack, metro } = this.deps.controllers();
    const panel = dialogue.isOpen || shop.isOpen || loot.isOpen || character.isOpen || phone.isOpen || hack.breachOpen || metro.isOpen || metro.riding;
    return this.screen === "playing" && !panel;
  }

  /**
   * The simulation only advances while playing; dialogue freezes the player but not the world,
   * the character menu stops the clock.
   */
  get running(): boolean {
    return this.screen === "playing" && !this.deps.controllers().character.isOpen;
  }

  /** The character menu is open; the app draws the preview instead of the game. */
  get characterScreenOpen(): boolean {
    return this.deps.controllers().character.isOpen;
  }

  set(screen: Screen): void {
    const c = this.deps.controllers();
    if (screen !== "playing") c.character.closeSilently();
    patchUi(this.deps.ui, { screen });
    c.focus.settle();
  }

  /**
   * The sim ended the conversation or the shop because the player came under fire (ADR-0016):
   * close the panel, give the controls back, and let ink drop the half-finished talk so it
   * can start over. No end-dialogue command: the sim has already cleared the flag.
   */
  interruptDialogue(): void {
    const c = this.deps.controllers();
    if (!c.dialogue.isOpen && !c.shop.isOpen && !c.loot.isOpen) return;
    c.dialogue.interrupt();
    this.closePanels();
    c.focus.settle();
  }

  /** Every panel and the menu close without telling the simulation. */
  closePanels(): void {
    const { dialogue, character, shop, loot, phone, hack, metro } = this.deps.controllers();
    metro.closeSilently();
    dialogue.closeSilently();
    character.closeSilently();
    shop.closeSilently();
    loot.closeSilently();
    phone.closeSilently();
    hack.closeSilently();
  }
}
