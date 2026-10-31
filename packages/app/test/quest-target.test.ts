import { beforeAll, describe, expect, it } from "vitest";
import { type MapMarkerVm } from "@seki/ui";
import { type DomainState, QUEST_MIRROR, createDomainState, endingFlag, hm, minuteOfDay } from "@seki/core";
import { MemorySaveStore } from "@seki/persistence";
import { CIVILIAN_SPAWN, FIXER_SPAWN, UME_HOME, market } from "@seki/sim";
import { type Ui, allText, objective, playActOne, setup, steps, talkTo, teleport } from "./story-helpers";
import type { GameSession } from "../src/game-session";
import { expectedSpot, shownQuestTarget } from "../src/quest-target";

/**
 * G-035: the step of the main thread that sends Seki to someone marks that someone on the map,
 * wherever they are at the hour (on the deptak by day, asleep in the doorway at night) and also
 * while their chunk is not loaded. Act II's first step after the "aya" ending: babcia Ume.
 */

const store = new MemorySaveStore();

beforeAll(async () => {
  const { session, ui, render } = setup(store);
  playActOne(session, ui, render, [0, 0, 0]);
  expect(session.sim.domain.quests[QUEST_MIRROR.id]).toEqual({ status: "active", stepIndex: 0 });
  expect(await session.saveAsync("act2")).toBe(true);
}, 120_000);

const loaded = async () => {
  const { session, ui } = setup(store);
  expect(await session.loadAsync("act2")).toBe(true);
  return { session, ui };
};

/** Lets the clock run on to `hour`:00 (the "wait" command, as on a bench). */
const waitUntil = (s: GameSession, hour: number) => {
  const minutes = (hm(hour) - minuteOfDay(s.sim.clock) + 24 * 60) % (24 * 60);
  s.sim.enqueue({ type: "wait", minutes });
  steps(s, 2);
};

const questMarkers = (ui: Ui): MapMarkerVm[] => ui.getState().mapMarkers.filter((m) => m.kind === "quest");

const near = (m: MapMarkerVm | undefined, at: { x: number; z: number }, within: number) => m !== undefined && Math.hypot(m.x - at.x, m.z - at.z) <= within;

describe("G-035: the quest step's target on the map", () => {
  it("says where to find Ume and marks her on the deptak at noon; she talks", async () => {
    const { session, ui } = await loaded();
    expect(objective(ui)).toBe("Ktoś woła cię przez moduł. Zapytaj babcię Ume o Rena Odagiri (deptak przy klinice)");
    waitUntil(session, 12);
    const marks = questMarkers(ui);
    expect(marks).toHaveLength(1);
    expect(near(marks[0], { x: 328, z: -77 }, 1.5)).toBe(true);
    talkTo(session, "ume");
    expect(allText(ui)).toContain("Słyszałaś go, prawda?");
  });

  it("marks her doorway at 2:00, where she sleeps, and she still talks", async () => {
    const { session, ui } = await loaded();
    waitUntil(session, 2);
    const marks = questMarkers(ui);
    expect(marks).toHaveLength(1);
    expect(near(marks[0], UME_HOME, 0.5)).toBe(true);
    expect(near(marks[0], CIVILIAN_SPAWN.position, 2)).toBe(false);
    talkTo(session, "ume");
    expect(allText(ui)).toContain("Słyszałaś go, prawda?");
  });

  it("keeps the marker on her plan's spot while her chunk is not loaded", async () => {
    const { session, ui } = await loaded();
    waitUntil(session, 12);
    const roof = market(86, 12.7, 59.6);
    teleport(session, roof.x, roof.z, 0, 0, roof.y);
    steps(session, 2);
    expect(session.sim.district).toBe("targ");
    expect([...session.sim.world].some((e) => e.key === "ume")).toBe(false);
    const marks = questMarkers(ui);
    expect(marks).toHaveLength(1);
    expect(near(marks[0], CIVILIAN_SPAWN.position, 1)).toBe(true);
  });

  it("moves the marker on with the step: Ren on the roof over the market", async () => {
    const { session, ui } = await loaded();
    talkTo(session, "ume");
    for (let guard = 0; guard < 10 && !ui.getState().dialogue?.ended; guard++) {
      const choices = ui.getState().dialogue?.choices ?? [];
      const i = choices.findIndex((c) => c.text.startsWith("Gdzie znajdę"));
      session.intents.choose(i < 0 ? 0 : i);
    }
    session.intents.closeDialogue();
    steps(session, 2);
    expect(objective(ui)).toBe("Wejdź schodami pożarowymi na dach nad targiem i znajdź Rena");
    const marks = questMarkers(ui);
    expect(marks).toHaveLength(1);
    expect(near(marks[0], market(86, 12.7, 59.6), 1)).toBe(true);
  });
});

describe("G-035: which step's target the map marks", () => {
  const at = (quests: DomainState["quests"], extra: Partial<DomainState> = {}): DomainState => ({ ...createDomainState(), quests, ...extra });
  const echo = { m0_first_contract: { status: "completed" }, m3_echo: { status: "active", stepIndex: 0 } } as const;

  it("follows the step's variant, the HUD's pick and the character's fate", () => {
    const act2 = { m0_first_contract: { status: "completed" }, m3_echo: { status: "completed" }, m3_lustro: { status: "active", stepIndex: 0 } } as const;
    expect(shownQuestTarget(at(act2))).toEqual({ actor: "ume" });
    expect(shownQuestTarget(at(act2, { flags: [endingFlag("seki")] }))).toEqual({ actor: "mori" });
    expect(shownQuestTarget(at(act2, { flags: ["dead:ume"] }))).toBeNull();
    expect(shownQuestTarget(at(echo))).toEqual({ actor: "fixer" });
    // While Kaito's contract runs the HUD shows it, and the map marks its own targets instead.
    const contracts = { active: { id: "c4", siteId: "car_wash", targets: 3, reward: 625, status: "active" }, completed: 3 } as const;
    expect(shownQuestTarget(at(echo, { contracts }))).toBeNull();
  });

  it("puts an absent character where the content has it: Kaito at the bar, before and after the first talk (G-034)", () => {
    const clock = createDomainState().clock;
    expect(expectedSpot("fixer", [], clock)).toEqual(FIXER_SPAWN.position);
    expect(expectedSpot("fixer", ["met_fixer"], clock)).toEqual(FIXER_SPAWN.position);
    expect(expectedSpot("nobody", [], clock)).toBeNull();
  });
});
