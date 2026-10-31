import { beforeAll, describe, expect, it } from "vitest";
import { type ActTwoEndingId, type EndingId, KAGAMI_CLEANER_KEYS, QUEST_MIRROR, type SaveSnapshot } from "@seki/core";
import { MemorySaveStore } from "@seki/persistence";
import { type Ui, allText, finishDialogue, objective, playActOne, setup, steps, talkTo, talkToKaito, talkToMori, teleport, shootDown } from "./story-helpers";
import { market } from "@seki/sim";
import type { GameSession } from "../src/game-session";

/**
 * Act II acceptance (ADR-0023): from the end of act I, after each of its endings, through
 * Ren, Kaito's job and the overpass to each act-II ending, with a save and a load in the middle
 * of the act and after it. Act I is played once per ending from a new game; every case starts
 * from that save.
 */

/** Ren's roof over the market's south row and the viaduct's deck, in the market's frame (ADR-0045). */
const REN_ROOF = market(86, 12.7, 59.6);
const DECK = market(98.5, 9.9, 92);

/** Moves to a spot of another district and lets streaming bring it (and its people) in. */
const goTo = (s: GameSession, at: { x: number; y: number; z: number }) => {
  teleport(s, at.x, at.z, Math.PI / 2, 0, at.y);
  steps(s, 2);
};

const present = (s: GameSession, key: string) => [...s.sim.world].some((e) => e.key === key);

const ACT_ONE: Readonly<Record<EndingId, readonly [number, number, number]>> = { aya: [0, 0, 0], seki: [1, 1, 1] };

const store = new MemorySaveStore();

beforeAll(async () => {
  for (const ending of ["aya", "seki"] as const) {
    const { session, ui, render } = setup(store);
    playActOne(session, ui, render, ACT_ONE[ending]);
    expect(session.sim.domain.story.ending).toBe(ending);
    expect(await session.saveAsync(`act1-${ending}`)).toBe(true);
  }
}, 120_000);

/** Step 1: someone says where Ren sleeps (Ume after aya, Mori after seki). */
const findTrail = (s: GameSession, ui: Ui, ending: EndingId) => {
  if (ending === "aya") {
    talkTo(s, "ume");
    expect(allText(ui)).toContain("Słyszałaś go, prawda?");
    finishDialogue(s, ui, "Gdzie znajdę");
  } else {
    talkToMori(s, ui);
    expect(allText(ui)).toContain("Fiolki już nie ma.");
    finishDialogue(s, ui, "Komu sprzedałeś");
  }
  expect(objective(ui)).toBe("Climb the fire escape to the roof over the market and find Ren");
};

/** Step 2: Ren on the roof hands over the chip; the "dach" flashback follows. */
const meetRen = (s: GameSession, ui: Ui, ending: EndingId, pick: number) => {
  goTo(s, REN_ROOF);
  expect(s.sim.district).toBe("targ");
  talkTo(s, "ren");
  expect(allText(ui)).toContain(ending === "aya" ? "Aya. Jednak przyszłaś." : "szklaną fiolkę");
  finishDialogue(s, ui, "Czego ode mnie chcesz?");
  expect(s.sim.domain.character.memories).toContain("rooftop");
  expect(allText(ui)).toContain("Ten sam dach, dwa lata wcześniej.");
  finishDialogue(s, ui, pick);
  expect(objective(ui)).toBe("Kaito has a job out on Ren. Find out who is paying for it (Neon Koi bar)");
};

/** Step 3: Kaito's job on Ren, the hook into the overpass; the "głos" flashback follows. */
const kaitoJob = (s: GameSession, ui: Ui, jobPick: number, voicePick: number) => {
  talkToKaito(s);
  expect(allText(ui)).toContain("pięć tysięcy za Rena Odagiri");
  finishDialogue(s, ui, jobPick);
  expect(s.sim.domain.character.memories).toContain("last_call");
  expect(allText(ui)).toContain("Wyłączam filtr Odagiri.");
  finishDialogue(s, ui, voicePick);
  expect(objective(ui)).toBe("Kurosawa from Kagami is waiting on the viaduct over aleja Tysiąclecia. Decide what happens to the archive");
};

/** Step 4 up to the decision: Kurosawa's offer on the overpass deck. */
const meetKurosawa = (s: GameSession, ui: Ui, archive: string) => {
  goTo(s, DECK);
  expect(present(s, "kurosawa")).toBe(true);
  talkTo(s, "kurosawa");
  expect(allText(ui)).toContain("dział odzysku");
  finishDialogue(s, ui, archive);
};

const CASES: readonly [string, EndingId, readonly [number, number, number], string, ActTwoEndingId][] = [
  ["after aya, she gives the archive back to the street", "aya", [0, 1, 0], "Archiwum wraca", "street"],
  ["after seki, Ren keeps the archive for Hebi", "seki", [1, 0, 1], "Archiwum zostaje", "hebi"],
  ["after aya, she sells Ren to Kagami", "aya", [1, 1, 1], "Bierzcie", "kagami"],
  ["after seki, she sells Ren to Kagami", "seki", [0, 0, 0], "Bierzcie", "kagami"],
];

describe("M3 acceptance: act II from the end of act I to each of its endings", () => {
  it.each(CASES)("%s", async (_name, ending, [rooftop, job, voice], archive, act2) => {
    const a = setup(store);
    expect(await a.session.loadAsync(`act1-${ending}`)).toBe(true);
    expect(a.session.sim.domain.quests[QUEST_MIRROR.id]).toEqual({ status: "active", stepIndex: 0 });
    findTrail(a.session, a.ui, ending);
    meetRen(a.session, a.ui, ending, rooftop);

    // Save in the middle of the act; a fresh session goes on from there.
    expect(await a.session.saveAsync("act2-mid")).toBe(true);
    const { session, ui } = setup(store);
    expect(await session.loadAsync("act2-mid")).toBe(true);
    expect(session.sim.domain.story.choices.rooftop).toBe(rooftop === 0 ? "together" : "alone");
    expect(objective(ui)).toBe("Kaito has a job out on Ren. Find out who is paying for it (Neon Koi bar)");

    kaitoJob(session, ui, job, voice);
    const before = session.sim.domain.reputation;
    meetKurosawa(session, ui, archive);

    if (act2 === "kagami") {
      // No fight: the act ends on the overpass and Kagami's copy plays as a flashback.
      expect(allText(ui)).toContain("Wszystko się zgadza.");
      finishDialogue(session, ui);
      expect(present(session, "kurosawa")).toBe(false);
      expect(KAGAMI_CLEANER_KEYS.some((k) => present(session, k))).toBe(false);
      expect(session.sim.domain.character.memories).toContain("mirror");
    } else {
      // The deal is off: Kurosawa leaves and his cleaners attack on the deck.
      expect(present(session, "kurosawa")).toBe(false);
      expect(objective(ui)).toBe("Kagami's cleaners are attacking on the viaduct. Fight them off");
      for (const key of KAGAMI_CLEANER_KEYS) shootDown(session, key);
      steps(session, 1);
      expect(objective(ui)).toBe("Kagami's cleaners are down. Go back to Ren on the roof over the market");
      expect(session.sim.domain.story.act2Ending).toBeNull();
      goTo(session, REN_ROOF);
      talkTo(session, "ren");
      expect(allText(ui)).toContain(act2 === "street" ? "walizką pełną cudzych żyć" : "połową zapłaty");
      finishDialogue(session, ui);
      expect(session.sim.domain.character.memories).not.toContain("mirror");
    }

    const d = session.sim.domain;
    expect(d.story.act2Ending).toBe(act2);
    expect(d.quests[QUEST_MIRROR.id]).toEqual({ status: "completed" });
    expect(ui.getState().toasts.some((t) => t.title === "End of Act II: Lustro")).toBe(true);
    expect(d.character.memories).toEqual(expect.arrayContaining(["rooftop", "last_call"]));
    expect(d.story.choices).toMatchObject({
      rooftop: rooftop === 0 ? "together" : "alone",
      job: job === 0 ? "refused" : "taken",
      voice: voice === 0 ? "listened" : "torn",
      archive: act2,
    });
    const delta = (f: keyof typeof before) => d.reputation[f] - before[f];
    if (act2 === "street") expect(delta("civilians")).toBe(15);
    if (act2 === "hebi") expect(delta("hebi")).toBe(15);
    if (act2 === "kagami") expect([delta("kagami"), delta("fixers")]).toEqual([20, 10]);
    else expect(d.reputation.kagami).toBeLessThanOrEqual(-20);
    expect(ui.getState().dialogue).toBeNull();
    expect(objective(ui)).toContain("Kaito ma kolejne kontrakty");

    // The ending survives a save and a load, and the people of the act remember it.
    expect(await session.saveAsync("act2")).toBe(true);
    const saved = session.snapshot();
    const after = setup(store);
    expect(await after.session.loadAsync("act2")).toBe(true);
    const loaded: SaveSnapshot = after.session.snapshot();
    expect(loaded.domain).toEqual(saved.domain);
    if (act2 === "kagami") {
      goTo(after.session, REN_ROOF);
      expect(present(after.session, "ren")).toBe(false);
      talkToKaito(after.session);
      expect(allText(after.ui)).toContain("Kagami zapłaciło za Rena");
    } else {
      goTo(after.session, REN_ROOF);
      talkTo(after.session, "ren");
      expect(allText(after.ui)).toContain(act2 === "street" ? "Ume chodzi od drzwi do drzwi" : "Hebi biorą już zamówienia");
    }
  });

  it("does not let Ren close the act while the cleaners still stand", async () => {
    const { session, ui } = setup(store);
    expect(await session.loadAsync("act1-aya")).toBe(true);
    findTrail(session, ui, "aya");
    meetRen(session, ui, "aya", 0);
    kaitoJob(session, ui, 1, 0);
    meetKurosawa(session, ui, "Archiwum wraca");
    shootDown(session, KAGAMI_CLEANER_KEYS[0]);
    goTo(session, REN_ROOF);
    talkTo(session, "ren");
    expect(allText(ui)).toContain("Słyszę strzały");
    finishDialogue(session, ui);
    expect(session.sim.domain.story.act2Ending).toBeNull();
    expect(session.sim.domain.quests[QUEST_MIRROR.id]).toEqual({ status: "active", stepIndex: 3 });
  });
});
