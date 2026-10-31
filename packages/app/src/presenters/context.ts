import type { AudioPort, DomainEvents, EntityId, EventBus, MetroStationId, RenderPort, ShopId } from "@seki/core";
import { type Toast, type UiStore, dismissToast, pushToast } from "@seki/ui";

export const TOAST_MS = 4500;

export interface PresenterHooks {
  playerId(): EntityId | null;
  onDialogue(dialogueId: string): void;
  /** A shop counter opened; `dialogueId` is its keeper's ink knot. */
  onShop(shopId: ShopId, dialogueId: string): void;
  /** The player opened a bag (`key` of its container). */
  onLoot(key: string): void;
  onPlayerDied(): void;
  /** Violence cut a conversation or the shop short; the sim has already freed the player. */
  onDialogueInterrupted(reason: DomainEvents["DialogueInterrupted"]["reason"]): void;
  /** A street encounter began (ADR-0032): its ink scene opens as a conversation with `npcId`. */
  onEncounter?(knot: string, npcId: EntityId | null): void;
  /** A ticket kiosk (ADR-0034): the line map of `station` (the district's when absent). */
  onMetro?(station: MetroStationId | null): void;
}

/** What every presenter gets: the bus, the three presentation channels and the session hooks. */
export interface PresenterContext {
  readonly bus: EventBus<DomainEvents>;
  readonly render: RenderPort;
  readonly audio: AudioPort;
  readonly ui: UiStore;
  readonly hooks: PresenterHooks;
  /**
   * A toast that goes away on its own; its id lets the presenter take it down earlier. `keep`:
   * it outlives ordinary toasts when too many come at once.
   */
  toast(kind: Toast["kind"], title: string, text?: string, keep?: boolean): number;
  /** Takes a toast down before its time. */
  dismiss(id: number): void;
  isPlayer(id: EntityId): boolean;
}

/** A presenter subscribes its events and hands back the unsubscribers. */
export type Presenter = (ctx: PresenterContext) => (() => void)[];

export const presenterContext = (bus: EventBus<DomainEvents>, render: RenderPort, audio: AudioPort, ui: UiStore, hooks: PresenterHooks): PresenterContext => ({
  bus,
  render,
  audio,
  ui,
  hooks,
  toast(kind, title, text = "", keep = false) {
    const id = pushToast(ui, { kind, title, text, ...(keep ? { keep } : {}) });
    setTimeout(() => dismissToast(ui, id), TOAST_MS);
    return id;
  },
  dismiss: (id) => dismissToast(ui, id),
  isPlayer: (id) => id === hooks.playerId(),
});
