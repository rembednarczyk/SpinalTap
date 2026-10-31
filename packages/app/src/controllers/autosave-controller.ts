import type { DomainEvents, EventBus } from "@seki/core";
import { type DistrictId, SIM_HZ } from "@seki/sim";
import { AUTOSAVE_SLOT } from "@seki/ui";
import type { SimRef } from "./shared";

export { AUTOSAVE_SLOT };

/** Playing time between two autosaves when nothing else saved, in simulation ticks: 5 minutes. */
export const AUTOSAVE_INTERVAL_TICKS = 5 * 60 * SIM_HZ;

/** What asked for an autosave; the toast names none of them, one save covers them all. */
export type AutosaveTrigger = "quest-step" | "quest" | "contract" | "district" | "interval";

/** Shows that an autosave went through or failed: a toast, once per save. */
export interface AutosaveView {
  saved(): void;
  failed(error: unknown): void;
}

export interface AutosaveControllerDeps {
  readonly bus: EventBus<DomainEvents>;
  readonly sim: SimRef;
  /** The player turned autosave on in the settings. */
  readonly enabled: () => boolean;
  /**
   * A save now could be loaded into: playing, in control (no conversation, shop, bag, breach,
   * kiosk or menu), out of combat, alive. Anything else and the save waits.
   */
  readonly safe: () => boolean;
  /**
   * Writes the slot. The snapshot is taken and encoded before the first await, so a write
   * started in a `visibilitychange` handler reaches IndexedDB within the same task.
   */
  readonly write: (slot: string) => Promise<void>;
  readonly view: AutosaveView;
  /** Ticks between interval saves; `AUTOSAVE_INTERVAL_TICKS` unless a test shortens it. */
  readonly intervalTicks?: number;
}

/**
 * Autosave to its own slot (P0 of the gap audit): after a quest step, a quest, a contract, a new
 * district and every few minutes of play, and when the browser hides the page. Triggers set one
 * pending save, written at the first safe moment the step loop reaches; the page going away is
 * written at once, or not at all when the moment is not safe.
 */
export class AutosaveController {
  private pending: AutosaveTrigger | null = null;
  private inFlight = false;
  /** The tick of the last autosave (or of the game's start): the interval counts from it. */
  private sinceTick = 0;
  /** The tick the page was last saved on hiding: `pagehide` after `visibilitychange` writes nothing new. */
  private hiddenTick: number | null = null;
  private district: DistrictId | null = null;

  constructor(private readonly deps: AutosaveControllerDeps) {
    const ask = (trigger: AutosaveTrigger) => () => this.request(trigger);
    deps.bus.on("QuestAdvanced", ask("quest-step"));
    deps.bus.on("QuestCompleted", ask("quest"));
    deps.bus.on("ContractCompleted", ask("contract"));
  }

  /** The trigger waiting for a safe moment, if any. */
  get waiting(): AutosaveTrigger | null {
    return this.pending;
  }

  request(trigger: AutosaveTrigger): void {
    this.pending ??= trigger;
  }

  /** A new game or a load: nothing pending, the interval starts over in the new game. */
  reset(): void {
    const sim = this.deps.sim();
    this.pending = null;
    this.sinceTick = sim.tick;
    this.hiddenTick = null;
    this.district = sim.district;
  }

  /** After each simulation step: notice a new district and the interval, then write if it is safe. */
  step(): void {
    const sim = this.deps.sim();
    const district = sim.district;
    if (district !== null && district !== this.district) {
      if (this.district !== null) this.request("district");
      this.district = district;
    }
    if (sim.tick - this.sinceTick >= (this.deps.intervalTicks ?? AUTOSAVE_INTERVAL_TICKS)) this.request("interval");
    if (this.pending === null || this.inFlight || !this.deps.enabled() || !this.deps.safe()) return;
    void this.flush(true);
  }

  /**
   * The page was hidden or is going away (`visibilitychange` to hidden, `pagehide`): write now,
   * without a toast nobody sees. On a phone this is the last moment JavaScript reliably runs.
   */
  hidden(): void {
    const tick = this.deps.sim().tick;
    if (this.hiddenTick === tick || this.inFlight || !this.deps.enabled() || !this.deps.safe()) return;
    this.hiddenTick = tick;
    void this.flush(false);
  }

  private async flush(announce: boolean): Promise<void> {
    this.inFlight = true;
    this.pending = null;
    this.sinceTick = this.deps.sim().tick;
    try {
      await this.deps.write(AUTOSAVE_SLOT);
      if (announce) this.deps.view.saved();
    } catch (e) {
      if (announce) this.deps.view.failed(e);
    } finally {
      this.inFlight = false;
    }
  }
}
