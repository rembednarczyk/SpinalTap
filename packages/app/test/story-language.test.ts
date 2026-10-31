import { describe, expect, it } from "vitest";
import { type AudioPort, type Locale, createDomainState } from "@seki/core";
import { STORY_SOURCES } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { createUiStore } from "@seki/ui";
import { GameSession } from "../src/game-session";
import { createKnotLines } from "../src/phone";
import { FakeRender, type Ui, steps, talkToKaito } from "./story-helpers";

/**
 * The story in the language of the options (ADR-0056): Kaito talks English by default and
 * Polish when the player picks it, a change takes effect from the next line of a conversation,
 * and a save written in one language loads in the other with its ink state.
 */

const audio: AudioPort = { play() {}, stopAll() {} };

const setup = (store = new MemorySaveStore()) => {
  const ui = createUiStore();
  const session = new GameSession({ render: new FakeRender(), audio, persistence: new SavePersistence(store), ui, story: STORY_SOURCES, seed: () => 77, now: () => new Date(2026, 9, 27) });
  session.newGame();
  return { session, ui };
};

const said = (ui: Ui) => ui.getState().dialogue?.lines.map((l) => l.text) ?? [];
const choices = (ui: Ui) => ui.getState().dialogue?.choices.map((c) => c.text) ?? [];

/** Takes the first choice to the end of the conversation and closes it. */
const talkThrough = (session: GameSession, ui: Ui) => {
  for (let guard = 0; guard < 10 && !ui.getState().dialogue?.ended; guard++) session.intents.choose(0);
  expect(ui.getState().dialogue?.ended).toBe(true);
  session.intents.closeDialogue();
  steps(session, 1);
};

describe("story language in a session (ADR-0056)", () => {
  it("Kaito speaks English by default and Polish when it is picked", () => {
    const en = setup();
    talkToKaito(en.session);
    expect(said(en.ui)[0]).toBe("Well, look at that. The walking corpse from the wreck on Krakowskie.");
    expect(choices(en.ui)).toEqual(["Who are you?", "What happened to me?"]);

    const pl = setup();
    pl.session.intents.changeSettings({ locale: "pl" });
    talkToKaito(pl.session);
    expect(said(pl.ui)[0]).toBe("No proszę. Chodzący trup z wraku na Krakowskim.");
    expect(choices(pl.ui)).toEqual(["Kim jesteś?", "Co mi się stało?"]);
  });

  it("switches from the next line on, in the middle of the conversation", () => {
    const { session, ui } = setup();
    talkToKaito(session);
    expect(choices(ui)[0]).toBe("Who are you?");
    session.intents.changeSettings({ locale: "pl" });
    session.intents.choose(0);
    expect(said(ui)).toContain("Kim ty jesteś?");
    expect(ui.getState().dialogue?.lines[0]?.speaker).toBe("Ty");
    expect(choices(ui)).toEqual(["Niech będzie. Seki Senshi.", "Moje imię gdzieś jest. Odzyskam je."]);
    // The lines already on screen stay in the log as they were said.
    expect((ui.getState().dialogue?.history ?? []).map((l) => l.text)).toContain("He pulled half a meter of someone else's cable out of you. Makes you wonder whose.");
    talkThrough(session, ui);
    expect(session.sim.domain.character.alias).toBe("Seki Senshi");
  });

  it("renders the phone, metro and radio knots in the language of the moment", () => {
    let locale: Locale = "en";
    const lines = createKnotLines(STORY_SOURCES, () => locale);
    expect(lines("phone_kaito_offer", createDomainState())).toEqual([{ speaker: "Kaito", text: "Got a quick job. Swing by the Neon Koi before someone else grabs it." }]);
    expect(lines("metro_ride_3", createDomainState())?.[1]).toEqual({ speaker: "Child", text: "Mom, why is that man sleeping standing up?" });
    locale = "pl";
    expect(lines("metro_ride_3", createDomainState())?.[1]).toEqual({ speaker: "Dziecko", text: "Mamo, czemu ten pan śpi na stojąco?" });
  });

  it("loads a Polish save in English, the ink state with it", async () => {
    const store = new MemorySaveStore();
    const pl = setup(store);
    pl.session.intents.changeSettings({ locale: "pl" });
    talkToKaito(pl.session);
    talkThrough(pl.session, pl.ui);
    // The courier job: Kaito waits. Ask about the crash, a once-only choice.
    talkToKaito(pl.session);
    expect(choices(pl.ui)).toEqual(["Już idę.", "Co wiesz o moim wypadku?"]);
    pl.session.intents.choose(1);
    pl.session.intents.closeDialogue();
    steps(pl.session, 1);
    expect(await pl.session.saveAsync("slot-1")).toBe(true);

    const en = setup(store);
    expect(await en.session.loadAsync("slot-1")).toBe(true);
    talkToKaito(en.session);
    expect(said(en.ui)).toEqual(["The courier's still breathing, Seki. The yard behind the car wash, past Plac Łokietka."]);
    // Asked already, in Polish: ink remembers it in English.
    expect(choices(en.ui)).toEqual(["On my way."]);
  });
});
