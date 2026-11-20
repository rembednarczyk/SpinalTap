import { describe, expect, it } from "vitest";
import { type ActThreeEndingId, type ActTwoEndingId, type DomainState, KAGAMI_GUARD_KEYS, QUEST_SOURCE, type SaveSnapshot } from "@seki/core";
import { MemorySaveStore } from "@seki/persistence";
import { ARCHIVIST_SPOT, KUROSAWA_CASTLE_SPOT, REN_SPOT } from "@seki/sim";
import type { GameSession } from "../src/game-session";
import { type Ui, allText, finishDialogue, objective, setup, shootDown, steps, talkTo, teleport } from "./story-helpers";

/**
 * Act III acceptance (ADR-0095): from the end of act II, after each of its endings, through the
 * trail to the Castle (Ume, Ren or Kurosawa), the archive's core by the Trinity Chapel and the
 * flashback it gives back, to each act-III ending and its epilogue, with a save and a load in the
 * middle of the act and after it.
 */

const store = new MemorySaveStore();

/** Moves to a spot of another district and lets streaming bring it (and its people) in; a street crime that starts there is left. */
const goTo = (s: GameSession, at: { x: number; y: number; z: number }) => {
  teleport(s, at.x, at.z, Math.PI / 2, 0, at.y);
  steps(s, 2);
  const micro = s.sim.session.street2.micro;
  if (!micro) return;
  s.intents.closeDialogue();
  teleport(s, micro.at.x + 90, micro.at.z, Math.PI / 2, 0, micro.at.y);
  steps(s, 2);
  teleport(s, at.x, at.z, Math.PI / 2, 0, at.y);
  steps(s, 2);
};

const present = (s: GameSession, key: string) => [...s.sim.world].some((e) => e.key === key);

/** The end of act II after `act2`, the "aya" ending of act I, Kaito's job taken, the rooftop together. */
const afterActTwo = (act2: ActTwoEndingId): Partial<DomainState> => ({
  quests: {
    m0_first_contract: { status: "completed" },
    m3_echo: { status: "completed" },
    m3_lustro: { status: "completed" },
    m3_zrodlo: { status: "active", stepIndex: 0 },
  },
  story: {
    choices: { case: "opened", name: "spoken", crash: "wheel", rooftop: "together", job: "taken", voice: "listened", archive: act2 },
    ending: "aya",
    act2Ending: act2,
    act3Ending: null,
  },
  flags: [
    "act1_ending",
    "act2_ending",
    "ending:aya",
    `ending:${act2}`,
    "kagami_job",
    "met_fixer",
    "met_ren",
    "recalled:last_call",
    "recalled:mirror",
    "recalled:rooftop",
    "ren_trail",
    "reported_back",
    "seen:act2_opening",
  ].sort(),
});

/** A new game jumped to the end of act II (as the debug API's `jump`), its opening of act III played. */
const startActThree = (act2: ActTwoEndingId) => {
  const { session, ui } = setup(store);
  session.newGame();
  steps(session, 2);
  const snap = session.saves.snapshot();
  const reputation = { ...snap.domain.reputation, kagami: act2 === "kagami" ? 20 : -20 };
  session.restore({ ...snap, domain: { ...snap.domain, ...afterActTwo(act2), reputation } }, false);
  for (let i = 0; i < 30 && !ui.getState().dialogue; i++) steps(session, 1);
  return { session, ui };
};

/** Step 1: the trail to the Castle, from Ume, Ren or Kurosawa by the act-II ending. */
const followTrail = (s: GameSession, ui: Ui, act2: ActTwoEndingId) => {
  if (act2 === "street") {
    talkTo(s, "ume");
    expect(allText(ui)).toContain("Pan Sato słuchał głosu żony");
    finishDialogue(s, ui, "Pójdę na Zamek");
  } else if (act2 === "hebi") {
    goTo(s, { ...REN_SPOT, x: REN_SPOT.x + 0.8 });
    talkTo(s, "ren");
    expect(allText(ui)).toContain("raz na noc wysyła pakiet");
    finishDialogue(s, ui, "Idę tam");
  } else {
    goTo(s, { ...KUROSAWA_CASTLE_SPOT, x: KUROSAWA_CASTLE_SPOT.x - 3 });
    talkTo(s, "kurosawa-castle");
    expect(allText(ui)).toContain("Dwa dni, kiedy Aya miała siedem lat");
    finishDialogue(s, ui, "Prowadź");
  }
  expect(s.sim.domain.flags).toContain("castle_lead");
  expect(objective(ui)).toBe("The Kagami archive's core stands in the Trinity Chapel at the Castle. Talk to the archivist by the door");
};

/** Step 2: the core by the Chapel; the guards first, unless she sided with Kagami. The "kaplica" flashback follows. */
const plugIn = (s: GameSession, ui: Ui, act2: ActTwoEndingId) => {
  goTo(s, { ...ARCHIVIST_SPOT, x: ARCHIVIST_SPOT.x - 6 });
  for (const key of KAGAMI_GUARD_KEYS) expect(present(s, key), key).toBe(true);
  if (act2 !== "kagami") for (const key of KAGAMI_GUARD_KEYS) shootDown(s, key);
  talkTo(s, "archivist");
  expect(allText(ui)).toContain("oryginał Ayi");
  finishDialogue(s, ui);
  expect(s.sim.domain.character.memories).toContain("chapel");
  for (let i = 0; i < 30 && !allText(ui).includes("Masz siedem lat."); i++) steps(s, 1);
  expect(allText(ui)).toContain("Masz siedem lat.");
  finishDialogue(s, ui);
  expect(objective(ui)).toBe("Go back to the archivist by the Chapel and decide what becomes of the core");
};

const PICKS: Readonly<Record<ActThreeEndingId, string>> = { erase: "Wymazuję", release: "Wypuszczam", keep: "Zostaję" };
const EPILOGUE: Readonly<Record<ActThreeEndingId, string>> = { erase: "Kagami zwija biuro", release: "Lublin śni cudze sny", keep: "Archiwum. Wstęp za zgodą" };

const CASES: readonly [string, ActTwoEndingId, ActThreeEndingId][] = [
  ["after the street's archive, she wipes the core", "street", "erase"],
  ["after the partners, she lets the archive out on the city's net", "hebi", "release"],
  ["after the copy, she stays by the core as its keeper", "kagami", "keep"],
];

describe("M3 acceptance: act III from the end of act II to each of its endings", () => {
  it.each(CASES)("%s", async (_name, act2, act3) => {
    const a = startActThree(act2);
    // The opening follows the act-II ending.
    expect(allText(a.ui)).toContain(act2 === "street" ? "Pan Sato zniknął" : act2 === "hebi" ? "każda kopia archiwum" : "Kalibracja dziś na Zamku");
    finishDialogue(a.session, a.ui);
    followTrail(a.session, a.ui, act2);

    // Save in the middle of the act; a fresh session goes on from there.
    expect(await a.session.saves.saveAsync("act3-mid")).toBe(true);
    const { session, ui } = setup(store);
    expect(await session.saves.loadAsync("act3-mid")).toBe(true);
    expect(session.sim.domain.quests[QUEST_SOURCE.id]).toEqual({ status: "active", stepIndex: 1 });

    plugIn(session, ui, act2);
    const before = session.sim.domain.reputation;
    talkTo(session, "archivist");
    expect(allText(ui)).toContain("Znalazłaś te dwa dni.");
    finishDialogue(session, ui, PICKS[act3]);
    // The epilogue plays on its own.
    for (let i = 0; i < 30 && !allText(ui).includes("To koniec wątku głównego."); i++) steps(session, 1);
    expect(allText(ui)).toContain(EPILOGUE[act3]);
    expect(allText(ui)).toContain("To koniec wątku głównego.");
    finishDialogue(session, ui);

    const d = session.sim.domain;
    expect(d.story.act3Ending).toBe(act3);
    expect(d.story.choices.core).toBe(act3);
    expect(d.quests[QUEST_SOURCE.id]).toEqual({ status: "completed" });
    expect(d.flags).toEqual(expect.arrayContaining(["act3_ending", `ending:${act3}`, "seen:act3_epilogue"]));
    expect(ui.getState().toasts.some((t) => t.title === "End of Act III: Źródło")).toBe(true);
    const delta = (f: keyof typeof before) => d.reputation[f] - before[f];
    if (act3 === "erase") expect([delta("kagami"), delta("civilians")]).toEqual([-30, 5]);
    if (act3 === "release") expect([delta("kagami"), delta("civilians"), delta("hebi")]).toEqual([-30, 15, 5]);
    if (act3 === "keep") expect([delta("kagami"), delta("fixers"), delta("civilians")]).toEqual([20, 10, -10]);
    // The guards and Kurosawa leave the courtyard; the archivist stays and remembers.
    steps(session, 2);
    for (const key of KAGAMI_GUARD_KEYS) expect(present(session, key), key).toBe(false);
    expect(present(session, "kurosawa-castle")).toBe(false);
    expect(ui.getState().dialogue).toBeNull();

    // The end screen (ADR-0095 stage 2): once, over the stood game, then back to the city.
    const end = ui.getState().endScreen;
    expect(end?.acts).toEqual([
      { act: "endScreen.act1", ending: "ending.aya.title" },
      { act: "endScreen.act2", ending: `ending.${act2}.title` },
      { act: "endScreen.act3", ending: `ending.${act3}.title` },
    ]);
    expect(end?.choices).toEqual([
      "story.choice.case.opened",
      "story.choice.name.spoken",
      "story.choice.crash.wheel",
      "story.choice.rooftop.together",
      "story.choice.voice.listened",
      "story.choice.job.taken",
      `story.choice.archive.${act2}`,
      `story.choice.core.${act3}`,
    ]);
    expect(end?.memories).toBeGreaterThanOrEqual(1);
    const tick = session.sim.tick;
    steps(session, 3);
    expect(session.sim.tick).toBe(tick);
    session.intents.closeEndScreen();
    expect(ui.getState().endScreen).toBeNull();
    expect(session.sim.domain.flags).toContain("seen:end_screen");
    steps(session, 3);
    expect(ui.getState().endScreen).toBeNull();

    // The ending survives a save and a load.
    expect(await session.saves.saveAsync("act3")).toBe(true);
    const saved = session.saves.snapshot();
    const after = setup(store);
    expect(await after.session.saves.loadAsync("act3")).toBe(true);
    const loaded: SaveSnapshot = after.session.saves.snapshot();
    expect(loaded.domain).toEqual(saved.domain);
    steps(after.session, 2);
    expect(after.ui.getState().endScreen).toBeNull();
    goTo(after.session, { ...ARCHIVIST_SPOT, x: ARCHIVIST_SPOT.x - 6 });
    talkTo(after.session, "archivist");
    expect(allText(after.ui)).toContain(act3 === "keep" ? "Rdzeń słucha teraz ciebie." : "Kaplica znowu jest cicha.");
  });

  it("keeps the core's choice closed until the chapel's flashback is played", () => {
    const { session, ui } = startActThree("kagami");
    finishDialogue(session, ui);
    followTrail(session, ui, "kagami");
    goTo(session, { ...ARCHIVIST_SPOT, x: ARCHIVIST_SPOT.x - 6 });
    // On the Kagami side the guards let her be.
    steps(session, 60);
    for (const key of KAGAMI_GUARD_KEYS) expect([...session.sim.world].find((e) => e.key === key)?.ai?.alerted ?? false, key).toBe(false);
    expect(session.sim.domain.story.act3Ending).toBeNull();
    expect(session.sim.domain.quests[QUEST_SOURCE.id]).toEqual({ status: "active", stepIndex: 1 });
  });
});
