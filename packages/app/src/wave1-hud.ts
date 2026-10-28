import type { DomainEvents, EntityId, EventBus } from "@seki/core";
import type { Entity } from "@seki/sim";
import { type UiState, type UiStore, patchUi } from "@seki/ui";
import type { PhoneInbox, PhoneQueue } from "./phone";
import { CombatFeedback } from "./presenters/combat-feedback";
import { ContractCards } from "./presenters/contract-cards";
import { HackingHud } from "./presenters/hacking-hud";
import { HeatHud } from "./presenters/heat-hud";
import { type HudPart, type HudPatch, type Wave1Hooks, hudPartContext } from "./presenters/hud-part";
import { PhoneHud } from "./presenters/phone-hud";

export { COMBAT_SECONDS } from "./presenters/combat-feedback";
export { FAILURE_TEXT } from "./presenters/hacking-hud";
export { HEAT_ENDING_SECONDS } from "./presenters/heat-hud";
export type { Wave1Hooks } from "./presenters/hud-part";

export interface Wave1Frame {
  readonly world: Iterable<Entity>;
  readonly player: Entity | undefined;
  /** In a conversation, a shop, a breach or combat. */
  readonly busy: boolean;
  /** Nothing on at all: news may reach the phone. */
  readonly calm: boolean;
}

/**
 * Presentation of wave 1 (ADR-0028): the phone, the contract cards, heat and detection, combat
 * feedback and the scanner, each a presenter of its own (ADR-0031), registered on the bus in
 * that order. This facade looks up the entities they need once per frame and keeps the
 * per-frame values stable for React.
 */
export class Wave1Hud {
  private readonly phone: PhoneHud;
  private readonly heat: HeatHud;
  private readonly combat: CombatFeedback;
  private readonly parts: readonly HudPart[];
  private last: Partial<UiState> = {};

  constructor(
    bus: EventBus<DomainEvents>,
    private readonly ui: UiStore,
    private readonly hooks: Wave1Hooks,
  ) {
    const ctx = hudPartContext(bus, ui, hooks);
    this.phone = new PhoneHud(ctx);
    const cards = new ContractCards(ctx);
    this.heat = new HeatHud(ctx);
    this.combat = new CombatFeedback(ctx);
    this.parts = [this.phone, cards, this.heat, this.combat, new HackingHud(ctx)];
  }

  get queue(): PhoneQueue {
    return this.phone.queue;
  }

  get inbox(): PhoneInbox {
    return this.phone.inbox;
  }

  dispose(): void {
    for (const part of this.parts) for (const off of part.offs) off();
  }

  /** A new game or a load: nothing of the old pursuit or the old phone banners carries over. */
  reset(): void {
    this.last = {};
    const patch: HudPatch = {};
    for (const part of this.parts) Object.assign(patch, part.reset());
    patchUi(this.ui, patch);
  }

  /** The player hit someone within the last few seconds. */
  get fighting(): boolean {
    return this.combat.fighting;
  }

  /** Heat on and not searching, or someone fighting the player. */
  get hunted(): boolean {
    return this.heat.hunted;
  }

  get heatLevel(): number {
    return this.heat.heatLevel;
  }

  readThread(from: string): void {
    this.phone.readThread(from);
  }

  /** Per-frame part: directions to observers, the heat countdown, witnesses, phone, expiry. */
  sync(frame: Wave1Frame): Partial<UiState> {
    const tick = this.hooks.tick();
    const wanted = new Set<EntityId>();
    for (const part of this.parts) for (const id of part.wanted?.() ?? []) wanted.add(id);
    const found = new Map<EntityId, Entity>();
    if (wanted.size > 0) for (const e of frame.world) if (wanted.has(e.id)) found.set(e.id, e);
    this.combat.expire(tick);
    const out: HudPatch = {};
    const partFrame = { tick, found, player: frame.player, busy: frame.busy, calm: frame.calm };
    for (const part of this.parts) Object.assign(out, part.frame?.(partFrame));
    return this.reuse(out);
  }

  /** Hands back the previous objects for values that did not change, so React stays still. */
  private reuse(out: Partial<UiState>): Partial<UiState> {
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(out)) {
      const prev = (this.last as Record<string, unknown>)[k];
      result[k] = prev !== undefined && same(prev, v) ? prev : v;
    }
    this.last = { ...this.last, ...result };
    return result as Partial<UiState>;
  }
}
