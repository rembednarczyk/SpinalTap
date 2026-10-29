import type { DomainEvents, DomainState, EntityId, EventBus } from "@seki/core";
import type { Entity } from "@seki/sim";
import { type DamageNumbersMode, type PhoneLineVm, type UiState, type UiStore, dismissToast, pushToast } from "@seki/ui";

export const snap = (v: number, step: number) => Math.round(v / step) * step;

export interface Wave1Hooks {
  readonly playerId: () => EntityId | null;
  readonly domain: () => DomainState;
  readonly clock: () => string;
  readonly tick: () => number;
  readonly ticksPerSecond: number;
  readonly damageMode: () => DamageNumbersMode;
  /** Renders a phone knot to lines. */
  readonly renderKnot: (knot: string, domain: DomainState) => PhoneLineVm[];
  readonly toastMs?: number;
}

/** What each part of the wave 1 HUD gets. */
export interface HudPartContext {
  readonly bus: EventBus<DomainEvents>;
  readonly ui: UiStore;
  readonly hooks: Wave1Hooks;
  isPlayer(id: EntityId): boolean;
  toast(kind: "heat" | "system", title: string, text: string): void;
}

export const hudPartContext = (bus: EventBus<DomainEvents>, ui: UiStore, hooks: Wave1Hooks): HudPartContext => ({
  bus,
  ui,
  hooks,
  isPlayer: (id) => id === hooks.playerId(),
  toast(kind, title, text) {
    const id = pushToast(ui, { kind, title, text });
    setTimeout(() => dismissToast(ui, id), hooks.toastMs ?? 4500);
  },
});

/** One frame of the per-frame part, with the entities the parts asked for already looked up. */
export interface HudPartFrame {
  readonly tick: number;
  readonly found: ReadonlyMap<EntityId, Entity>;
  readonly player: Entity | undefined;
  /** In a conversation, a shop, a breach or combat. */
  readonly busy: boolean;
  /** Nothing on at all: news may reach the phone. */
  readonly calm: boolean;
}

export type HudPatch = { -readonly [K in keyof UiState]?: UiState[K] };

/**
 * Hands back the previous objects for values that did not change, so React stays still. Keeps
 * its own memory of what it handed out last.
 */
export const createReuse = () => {
  let last: Record<string, unknown> = {};
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  return {
    apply(out: Partial<UiState>): Partial<UiState> {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(out)) {
        const prev = last[k];
        result[k] = prev !== undefined && same(prev, v) ? prev : v;
      }
      last = { ...last, ...result };
      return result as Partial<UiState>;
    },
    clear(): void {
      last = {};
    },
  };
};

/** A presenter of one wave 1 area: its events, its per-frame fields and its reset (ADR-0031). */
export interface HudPart {
  readonly offs: readonly (() => void)[];
  /** Entities this part needs to see this frame. */
  wanted?(): Iterable<EntityId>;
  frame?(f: HudPartFrame): HudPatch;
  /** A new game or a load: the part forgets everything and hands back its fields' empty values. */
  reset(): HudPatch;
}
