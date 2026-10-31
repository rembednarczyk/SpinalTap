import type { AudioPort, DomainEvents, EventBus, RenderPort } from "@seki/core";
import type { UiStore } from "@seki/ui";
import { presentCombat } from "./presenters/combat";
import { presentEncounters } from "./presenters/encounters";
import { type Presenter, type PresenterHooks, presenterContext } from "./presenters/context";
import { presentLoot } from "./presenters/loot";
import { presentProgression } from "./presenters/progression";
import { presentPrompt } from "./presenters/prompt";
import { presentQuests } from "./presenters/quests";
import { presentTrade } from "./presenters/trade";
import { presentWorld } from "./presenters/world";

export type { PresenterHooks } from "./presenters/context";

/**
 * Presenters per area (ADR-0031), registered in this order. Each event type has one handler
 * among them, so the order only matters against the other listeners of the bus.
 */
export const PRESENTERS: readonly Presenter[] = [presentCombat, presentLoot, presentWorld, presentPrompt, presentTrade, presentQuests, presentEncounters, presentProgression];

/**
 * Translates domain events into presentation: UI store updates and toasts, audio cues and
 * render effects. The only place where the three presentation channels meet.
 */
export const bindEventPresenter = (bus: EventBus<DomainEvents>, render: RenderPort, audio: AudioPort, ui: UiStore, hooks: PresenterHooks): (() => void) => {
  const ctx = presenterContext(bus, render, audio, ui, hooks);
  const offs = PRESENTERS.flatMap((present) => present(ctx));
  return () => {
    for (const off of offs) off();
  };
};
