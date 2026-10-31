import { describe, expect, it } from "vitest";
import { type Contract, type DomainEvents, EventBus, type Locale, MEMORY_CATALOG, QUEST_ECHO, type RenderPort, createDomainState } from "@seki/core";
import { createUiStore, patchUi } from "@seki/ui";
import { bindEventPresenter } from "../src/event-presenter";
import { buildJournal } from "../src/journal";
import { describeObjective } from "../src/objective";

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

describe("contract toasts, the HUD objective and the journal", () => {
  const job: Contract = { id: "c2", kind: "retrieve", siteId: "hebi_stash", targets: 2, reward: 470, status: "active" };
  const toastsOf = (locale: Locale) => {
    const { bus, toasts } = setup(locale);
    bus.emit("ContractAccepted", { contract: job });
    bus.emit("ContractCleared", { contract: { ...job, status: "cleared" } });
    bus.emit("ContractFailed", { contract: { ...job, kind: "delivery" }, reason: "timeout" });
    return toasts();
  };

  it("are in English by default", () => {
    const shown = toastsOf("en");
    expect(shown[0]).toMatch(/^New contract: Retrieval \|/);
    expect(shown[1]).toBe("Crate taken | Go back to Hana for your pay");
    expect(shown[2]).toBe("Contract lost | The package didn't make it in time. Kaito won't be pleased");
  });

  it("are in Polish as before when chosen", () => {
    const shown = toastsOf("pl");
    expect(shown[0]).toMatch(/: Odzyskanie \|/);
    expect(shown[1]).toBe("Skrzynka zabrana | Wróć do Hany po zapłatę");
    expect(shown[2]).toMatch(/\| Paczka nie dotarła na czas. Kaito nie będzie zadowolony$/);
  });

  it("name the running contract on the HUD and in the journal in the chosen language", () => {
    const domain = { ...createDomainState(), quests: { m0_first_contract: { status: "completed" as const } }, contracts: { active: job, completed: 1 } };
    expect(describeObjective(domain, "en")).toEqual({
      title: "Contract 2 · Hana",
      objective: "Take Hana's crate from the Hebi stash (guards: 2): the Hebi stash under the viaduct, east end of the market",
    });
    expect(describeObjective(domain, "pl")).toEqual({
      title: "Kontrakt 2 · Hana",
      objective: "Zabierz skrzynkę Hany ze skrytki Hebi (strażnicy: 2): skrytka Hebi pod wiaduktem, wschodni koniec targu",
    });
    const entry = (locale: Locale) => buildJournal(domain, locale).quests.find((q) => q.id === "contract-c2");
    expect(entry("en")?.steps[0]?.objective).toMatch(/^Take Hana's crate/);
    expect(entry("pl")?.title).toBe("Kontrakt 2 · Hana");
  });

  it("say who else has work once the story is quiet", () => {
    const quiet = { ...createDomainState(), quests: { m0_first_contract: { status: "completed" as const } }, flags: ["met_hana", "met_genzo"] };
    expect(describeObjective(quiet, "en")).toEqual({
      title: "Free hand",
      objective: "More contracts from Kaito, and from Hana at the Podzamcze market and Genzō on the Nabrzeże too. Mori sells cyberware.",
    });
    expect(describeObjective(quiet, "pl").objective).toBe("Kaito ma kolejne kontrakty, Hana z targu na Podzamczu i Genzō na Nabrzeżu też. Mori sprzedaje cyberware.");
    expect(describeObjective({ ...quiet, flags: [] }, "pl").objective).toBe("Kaito ma kolejne kontrakty. Mori sprzedaje cyberware.");
  });
});
