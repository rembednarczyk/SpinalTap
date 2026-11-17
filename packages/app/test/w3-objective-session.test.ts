import { describe, expect, it } from "vitest";
import { QUEST_DEFINITIONS, activeMainStep, contractObjective, contractSecondsLeft } from "@seki/core";
import { GENZO_SPOT, SIM_HZ } from "@seki/sim";
import { translateText } from "@seki/ui";
import { frame, objective, playActOne, setup, steps, teleport } from "./story-helpers";
import type { GameSession } from "../src/game-session";

/**
 * G-905: once W-3 is taken from Genzō, the HUD's line is the job's (its route, charges, fuse and
 * the 06:00 deadline) and its bonus stands under it, with the main thread running and nothing
 * pinned in the journal. A pin of the player's own still wins.
 */

type Ui = ReturnType<typeof setup>["ui"];

const acceptSabotage = (session: GameSession, ui: Ui) => {
  teleport(session, GENZO_SPOT.x + 0.3, GENZO_SPOT.z - 1.8, 0);
  steps(session, 1);
  steps(session, 1, frame({ interact: true }));
  const choice = (ui.getState().dialogue?.choices ?? []).find((c) => c.text.startsWith("Co to za partia dronów"));
  if (!choice) throw new Error("no sabotage offer");
  session.intents.choose(choice.index);
  session.intents.closeDialogue();
  steps(session, 2);
  const job = session.sim.domain.contracts.active;
  if (job?.kind !== "sabotage") throw new Error("no sabotage");
  return job;
};

/** The running job's step as the HUD should write it in English, the clock included. */
const jobLine = (session: GameSession): string => {
  const c = session.sim.domain.contracts.active!;
  return translateText("en", contractObjective(c, contractSecondsLeft(c, session.sim.tick, SIM_HZ)));
};

const expectJobOnHud = (session: GameSession, ui: Ui, id: string) => {
  expect(ui.getState().questTitle).toBe(`Contract ${id.slice(1)} · Genzō`);
  expect(objective(ui)).toBe(jobLine(session));
  expect(objective(ui)).toContain("calibration core");
  expect(ui.getState().contractBonus?.label).toBe("contract.bonus.sabotage");
};

describe("W-3 on the HUD while the main thread runs (G-905)", () => {
  it("a new game: the job's line instead of Talk to Kaito, without a pin", () => {
    const { session, ui } = setup();
    session.newGame();
    steps(session, 2);
    expect(objective(ui)).toContain("Talk to Kaito");
    const job = acceptSabotage(session, ui);
    expect(session.sim.domain.preferences.trackedQuest).toBeUndefined();
    expectJobOnHud(session, ui, job.id);
  });

  it("after act I: the job's line instead of Ask Grandma Ume, and the player's pin of the main thread still wins", () => {
    const { session, ui, render } = setup();
    session.newGame();
    steps(session, 2);
    playActOne(session, ui, render, [0, 0, 0]);
    steps(session, 2);
    const mainTitle = ui.getState().questTitle;
    expect(objective(ui)).toContain("Grandma Ume");
    const job = acceptSabotage(session, ui);
    expectJobOnHud(session, ui, job.id);
    const main = activeMainStep(session.sim.domain.quests, QUEST_DEFINITIONS)!;
    session.sim.enqueue({ type: "track-quest", questId: main.quest.id });
    steps(session, 1);
    expect(ui.getState().questTitle).toBe(mainTitle);
    session.sim.enqueue({ type: "track-quest", questId: null });
    steps(session, 1);
    expectJobOnHud(session, ui, job.id);
  });
});
