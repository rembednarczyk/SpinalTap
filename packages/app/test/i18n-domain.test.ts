import { describe, expect, it } from "vitest";
import { type DomainEvents, EventBus, type Locale, MEMORY_CATALOG, QUEST_ECHO, type RenderPort } from "@seki/core";
import { createUiStore, patchUi } from "@seki/ui";
import { bindEventPresenter } from "../src/event-presenter";

/**
 * The game data's keys in the session (ADR-0056, stage 3): the simulation's events carry keys,
 * the presenters write them in the language of the moment, English by default.
 */

const render: RenderPort = {
  spawn() {},
  updateTransform() {},
  despawn() {},
  clear() {},
  setCameraMode() {},
  attachCamera() {},
  playEffect() {},
  setAppearance() {},
};

const setup = (locale: Locale) => {
  const bus = new EventBus<DomainEvents>();
  const ui = createUiStore();
  patchUi(ui, { settings: { ...ui.getState().settings, locale } });
  bindEventPresenter(bus, render, { play() {}, stopAll() {} }, ui, {
    playerId: () => 1,
    onDialogue() {},
    onShop() {},
    onLoot() {},
    onPlayerDied() {},
    onDialogueInterrupted() {},
  });
  const toasts = () => ui.getState().toasts.map((t) => `${t.title} | ${t.text}`);
  return { bus, toasts };
};

describe("quest, memory, ending and standing toasts", () => {
  const story = (locale: Locale) => {
    const { bus, toasts } = setup(locale);
    const step = QUEST_ECHO.steps[1]!;
    bus.emit("QuestAdvanced", { questId: QUEST_ECHO.id, stepId: step.id, objective: step.objective });
    bus.emit("QuestCompleted", { questId: QUEST_ECHO.id, title: QUEST_ECHO.title });
    bus.emit("MemoryUnlocked", { memoryId: "rooftop", title: MEMORY_CATALOG.rooftop.title, description: MEMORY_CATALOG.rooftop.description });
    bus.emit("ReputationChanged", { faction: "hebi", delta: -5, value: -5 });
    return toasts();
  };

  it("are in English by default", () => {
    const shown = story("en");
    expect(shown.slice(0, 2)).toEqual(["Quest updated | Talk to Doctor Mori about what you saw (Mori's clinic)", "Job done | Echo"]);
    expect(shown[2]).toMatch(/^Memory: the roof \| A roof over the market/);
    expect(shown[3]).toMatch(/^Hebi gang -5 \|/);
  });

  it("are in Polish word for word as before when chosen", () => {
    const shown = story("pl");
    expect(shown[0]).toMatch(/\| Porozmawiaj z doktorem Mori o tym, co widziałaś \(klinika Mori\)$/);
    expect(shown[2]).toMatch(/^Wspomnienie: dach \| Dach nad targiem, deszcz i Ren/);
    expect(shown[3]).toMatch(/^Gang Hebi -5 \|/);
  });
});
