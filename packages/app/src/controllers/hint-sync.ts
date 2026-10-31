import type { DomainEvents, EventBus } from "@seki/core";
import { SIM_HZ } from "@seki/sim";
import { type HintVm, type MessageKey, type SettingsVm, type UiStore, patchUi, translate } from "@seki/ui";
import { keymapFor } from "../controls";
import { type HintDef, HintTracker } from "../hints";
import type { SimRef } from "./shared";

/** First-run hints already seen, and where to keep them (localStorage in the browser). */
export interface HintsHost {
  readonly seen: readonly string[];
  save(seen: readonly string[]): void;
}

/** Events the hint tracker follows. */
const HINT_EVENTS = ["InteractionFocusChanged", "InteractionStarted", "ContractAccepted", "ShotFired", "LootDropped", "LootTaken", "WeaponSwitched", "QuestAdvanced"] as const;

export interface HintSyncDeps {
  readonly bus: EventBus<DomainEvents>;
  readonly sim: SimRef;
  readonly ui: UiStore;
  readonly host?: HintsHost;
  /** Touch controls on screen: hints use touch words instead of keys. */
  readonly touch?: boolean;
}

/** First-run hints follow play; the store hears only about changes. */
export class HintSync {
  private readonly hints: HintTracker;
  /** Hint shown last, so the store changes only when it does. */
  private hintShown: HintDef | null = null;
  /** The language it was shown in: a change redraws it (ADR-0056). */
  private hintLocale: SettingsVm["locale"] | null = null;
  private lastPlayerPos: { x: number; z: number } | null = null;

  constructor(private readonly deps: HintSyncDeps) {
    this.hints = new HintTracker(new Set(deps.host?.seen ?? []), (seen) => deps.host?.save(seen), () => deps.sim().player()?.id ?? null);
    for (const type of HINT_EVENTS) deps.bus.on(type, (e) => this.hints.onEvent(type, e));
  }

  /** A new game starts the walk-through. */
  start(): void {
    this.hints.start();
  }

  step(inControl: boolean, characterOpen: boolean): void {
    const player = this.deps.sim().player();
    const p = player?.position ?? null;
    const last = this.lastPlayerPos;
    const moved = p && last ? Math.hypot(p.x - last.x, p.z - last.z) : 0;
    this.lastPlayerPos = p ? { x: p.x, z: p.z } : null;
    this.hints.tick({ dt: 1 / SIM_HZ, inControl, moved: moved < 2 ? moved : 0, sprinting: player?.posture?.sprinting ?? false, characterOpen });
    const settings = this.deps.ui.getState().settings;
    const hint = settings.hints && inControl ? this.hints.active : null;
    if (hint === this.hintShown && settings.locale === this.hintLocale) return;
    this.hintShown = hint;
    this.hintLocale = settings.locale;
    patchUi(this.deps.ui, { hint: hint ? this.hintVm(hint, settings) : null });
  }

  /** Keys of a hint through the player's bindings (first key of each control). */
  private hintVm(h: HintDef, settings: SettingsVm): HintVm {
    const text = (key: string): string => translate(settings.locale, key as MessageKey);
    if (this.deps.touch) return { id: h.id, keys: [], text: text(h.touch ? `hint.${h.id}.touch` : `hint.${h.id}`) };
    const map = keymapFor(settings.bindings);
    const keys = h.keys.map((k) => (k.startsWith("code:") ? k.slice(5) : (map[k as keyof typeof map]?.[0] ?? ""))).filter(Boolean);
    return { id: h.id, keys, text: text(`hint.${h.id}`) };
  }
}
