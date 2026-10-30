import { describe, expect, it } from "vitest";
import { type EndingId, QUEST_ECHO, QUEST_MIRROR, STORY_CHOICES, type StoryChoiceId } from "@seki/core";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import {
  allText,
  finishDialogue,
  objective,
  playContractFragment,
  playFinale,
  playFirstContract,
  playImplantFragment,
  playMoriFragment,
  setup,
  steps,
  talkToMori,
} from "./story-helpers";

const CHOICES: readonly StoryChoiceId[] = ["case", "name", "crash"];

describe("M3 acceptance: act I from a new game to each ending", () => {
  it.each<[string, readonly [number, number, number], EndingId, string]>([
    ["owns every memory", [0, 0, 0], "aya", "Aya"],
    ["keeps every memory at a distance", [1, 1, 1], "seki", "Seki Senshi"],
    ["owns two of three", [1, 0, 0], "aya", "Aya"],
    ["owns one of three", [0, 1, 1], "seki", "Seki Senshi"],
  ])("%s → ending %s", async (_name, picks, ending, alias) => {
    const store = new MemorySaveStore();
    const { session, ui, render } = setup(store);
    playFirstContract(session, ui);
    playContractFragment(session, ui, render, picks[0]);
    playMoriFragment(session, ui, render, picks[1]);
    playImplantFragment(session, ui, render, picks[2]);

    expect(session.sim.domain.story.choices).toEqual(Object.fromEntries(CHOICES.map((c, i) => [c, STORY_CHOICES[c][picks[i]!]])));
    expect(session.sim.domain.story.ending).toBeNull();

    const finale = playFinale(session, ui);
    expect(finale).toContain(ending === "aya" ? "Zostaw go." : "Wyjmij go.");
    expect(session.sim.domain.story.ending).toBe(ending);
    expect(session.sim.domain.quests[QUEST_ECHO.id]).toEqual({ status: "completed" });
    expect(session.sim.domain.character.alias).toBe(alias);
    expect(session.sim.domain.character.memories).toEqual(
      expect.arrayContaining(["combat_reflex", "courier_case", "operating_table", "crash_night"]),
    );
    expect(ui.getState().toasts.some((t) => t.title === "Koniec aktu I: Echo")).toBe(true);

    // Act II opens on its own, in the light of the ending (ADR-0023).
    expect(allText(ui)).toContain(ending === "aya" ? "Babcia Ume wie" : "Mori sprzedał fiolkę");
    finishDialogue(session, ui);
    expect(session.sim.domain.quests[QUEST_MIRROR.id]).toEqual({ status: "active", stepIndex: 0 });
    expect(objective(ui)).toBe(ending === "aya" ? "Ktoś woła cię przez moduł. Zapytaj babcię Ume o Rena Odagiri (deptak przy klinice)" : "Mori sprzedał twój moduł. Zapytaj go, kto go kupił (klinika Mori)");

    // The ending survives a save/load round trip, ink state included.
    expect(await session.saveAsync("act1")).toBe(true);
    const saved = session.snapshot();
    const { session: other, ui: otherUi } = setup(store);
    expect(await other.loadAsync("act1")).toBe(true);
    expect(other.snapshot().domain).toEqual(saved.domain);
    expect(other.narrative.saveState()).toBe(saved.narrative);
    talkToMori(other, otherUi);
    expect(allText(otherUi)).toContain(ending === "aya" ? "Aya. Jak głowa?" : "Fiolki już nie ma.");
  });

  it("keeps choices and an unplayed flashback across save/load in the middle of the act", async () => {
    const store = new MemorySaveStore();
    const { session, ui, render } = setup(store);
    playFirstContract(session, ui);
    playContractFragment(session, ui, render, 0);
    expect(await session.saveAsync("mid")).toBe(true);

    // Unlock fragment 2 and write the snapshot while its flashback is still waiting (the UI would refuse to save here).
    talkToMori(session, ui);
    finishDialogue(session, ui);
    expect(allText(ui)).toContain("Jak się nazywasz?");
    await new SavePersistence(store).save("pending", session.snapshot());

    // A fresh session picks the flashback up right after loading.
    const b = setup(store);
    expect(await b.session.loadAsync("pending")).toBe(true);
    expect(b.ui.getState().dialogue).toBeNull();
    steps(b.session, 1);
    expect(allText(b.ui)).toContain("Jak się nazywasz?");
    finishDialogue(b.session, b.ui, 0);
    playImplantFragment(b.session, b.ui, b.render, 0);
    playFinale(b.session, b.ui);
    expect(b.session.sim.domain.story).toEqual({ choices: { case: "opened", name: "spoken", crash: "wheel" }, ending: "aya", act2Ending: null });

    // The earlier save still holds only the first choice, and continues from there.
    const c = setup(store);
    expect(await c.session.loadAsync("mid")).toBe(true);
    expect(c.session.sim.domain.story).toEqual({ choices: { case: "opened" }, ending: null, act2Ending: null });
    expect(objective(c.ui)).toBe("Porozmawiaj z doktorem Mori o tym, co widziałaś (klinika Mori)");
    playMoriFragment(c.session, c.ui, c.render, 1);
    playImplantFragment(c.session, c.ui, c.render, 1);
    playFinale(c.session, c.ui);
    expect(c.session.sim.domain.story.ending).toBe("seki");
  });

  it("lets the ripperdoc chat outside the main thread and does not replay a flashback", () => {
    const { session, ui } = setup();
    session.newGame();
    talkToMori(session, ui);
    expect(allText(ui)).toContain("Coś boli?");
    finishDialogue(session, ui);
    expect(ui.getState().dialogue).toBeNull();
    expect(session.inControl).toBe(true);
  });
});
