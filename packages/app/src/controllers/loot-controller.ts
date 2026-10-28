import { type LootIntents, type LootVm, type UiStore, patchUi } from "@seki/ui";
import { createLootTracker } from "../loot-view";
import type { Focus, SimRef } from "./shared";

export interface LootControllerDeps {
  readonly sim: SimRef;
  readonly ui: UiStore;
  readonly focus: Focus;
}

/** The bag being searched. */
export class LootController implements LootIntents {
  /** Key of the bag being searched, or null. */
  private lootKey: string | null = null;
  private readonly lootView = createLootTracker();

  constructor(private readonly deps: LootControllerDeps) {}

  get isOpen(): boolean {
    return this.lootKey !== null;
  }

  open(key: string): void {
    this.lootKey = key;
    patchUi(this.deps.ui, { loot: this.lootView(this.deps.sim().domain, key), prompt: null });
    this.deps.focus.panel();
  }

  /** The open bag for the HUD frame. A bag emptied (or expired) while open closes, and the player moves again. */
  lootFrame(): LootVm | null {
    const loot = this.lootView(this.deps.sim().domain, this.lootKey);
    if (this.lootKey !== null && loot === null) this.closeLoot();
    return loot;
  }

  takeLoot(line: number | "all"): void {
    if (this.lootKey !== null) this.deps.sim().enqueue({ type: "take-loot", containerKey: this.lootKey, line });
  }

  closeLoot(): void {
    if (this.lootKey === null) return;
    this.lootKey = null;
    patchUi(this.deps.ui, { loot: null });
    this.deps.sim().enqueue({ type: "end-dialogue" });
    this.deps.focus.settle();
  }

  /** Closes the panel without telling the simulation. */
  closeSilently(): void {
    this.lootKey = null;
    patchUi(this.deps.ui, { loot: null });
  }
}
