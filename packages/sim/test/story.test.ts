import { describe, expect, it } from "vitest";
import { ACT_ONE_ENDING_FLAG, QUEST_ECHO, contractTag, progressFlag, recalledFlag } from "@seki/core";
import { CONTRACT_SITE_SPAWNS, Simulation, stateHash } from "../src";
import { collect, run, teleportPlayer } from "./helpers";

/** A simulation that has just finished M0, built the way a load would build it. */
const afterM0 = (patch: (d: Simulation["domain"]) => Simulation["domain"] = (d) => d): Simulation => {
  const snap = Simulation.create({ seed: 5 }).snapshot(null, "test", "");
  return Simulation.fromSnapshot({
    ...snap,
    domain: patch({
      ...snap.domain,
      quests: { m0_first_contract: { status: "completed" }, [QUEST_ECHO.id]: { status: "active", stepIndex: 0 } },
      wallet: { eddies: 5000 },
    }),
  });
};

const clearContract = (sim: Simulation) => {
  sim.enqueue({ type: "accept-contract" });
  sim.step();
  const c = sim.domain.contracts.active!;
  // Kaito's sites lie along the deptak and beyond it (ADR-0045): go there, so its chunk streams in.
  teleportPlayer(sim, CONTRACT_SITE_SPAWNS[c.siteId][0]!);
  run(sim, 2);
  for (const e of [...sim.world].filter((x) => x.tag === contractTag(c.id))) e.health = { current: 0, max: e.health!.max };
  run(sim, 2);
  sim.enqueue({ type: "complete-contract" });
  sim.step();
};

describe("main thread in the simulation", () => {
  it("completing M0 starts act I and announces its first objective", () => {
    const sim = Simulation.create({ seed: 3 });
    const advanced = collect<{ questId: string; objective: string }>(sim, "QuestAdvanced");
    sim.enqueue({ type: "set-flag", flag: "met_fixer" });
    sim.enqueue({ type: "set-flag", flag: "killed:hebi_courier" });
    sim.enqueue({ type: "set-flag", flag: "reported_back" });
    sim.step();
    expect(sim.domain.quests[QUEST_ECHO.id]).toEqual({ status: "active", stepIndex: 0 });
    expect(advanced.at(-1)).toMatchObject({ questId: QUEST_ECHO.id, objective: QUEST_ECHO.steps[0]!.objective });
  });

  it("a finished contract raises a step-scoped flag and recovers the first fragment", () => {
    const sim = afterM0();
    const memories = collect<{ memoryId: string }>(sim, "MemoryUnlocked");
    clearContract(sim);
    expect(sim.domain.flags).toContain(progressFlag("contract_completed", "echo_contract"));
    expect(memories.map((m) => m.memoryId)).toEqual(["courier_case"]);
    expect(sim.domain.quests[QUEST_ECHO.id]).toEqual({ status: "active", stepIndex: 1 });
  });

  it("an implant counts for the step that is active when it is installed", () => {
    const sim = afterM0((d) => ({
      ...d,
      quests: { ...d.quests, [QUEST_ECHO.id]: { status: "active", stepIndex: 2 } },
      flags: [recalledFlag("operating_table")],
    }));
    sim.enqueue({ type: "buy-cyberware", cyberwareId: "steady_grip" });
    sim.step();
    expect(sim.domain.flags).toContain(progressFlag("cyberware_installed", "new_implant"));
    expect(sim.domain.character.memories).toContain("crash_night");
    // A failed purchase raises nothing.
    const poor = afterM0((d) => ({ ...d, wallet: { eddies: 0 } }));
    poor.enqueue({ type: "buy-cyberware", cyberwareId: "steady_grip" });
    poor.step();
    expect(poor.domain.flags.some((f) => f.startsWith("cyberware_installed@"))).toBe(false);
  });

  it("records story choices once and emits them", () => {
    const sim = afterM0();
    const made = collect(sim, "StoryChoiceMade");
    sim.enqueue({ type: "story-choice", choice: "case", option: "opened" });
    sim.enqueue({ type: "story-choice", choice: "case", option: "sealed" });
    sim.step();
    expect(sim.domain.story.choices).toEqual({ case: "opened" });
    expect(made).toEqual([{ choice: "case", option: "opened" }]);
  });

  it("resolves the ending from the choices, once, and closes act I", () => {
    const sim = afterM0((d) => ({
      ...d,
      quests: { ...d.quests, [QUEST_ECHO.id]: { status: "active", stepIndex: 3 } },
      flags: [recalledFlag("crash_night")],
    }));
    const endings = collect(sim, "EndingReached");
    const completed = collect<{ questId: string }>(sim, "QuestCompleted");
    for (const [choice, option] of [["case", "sealed"], ["name", "spoken"], ["crash", "wheel"]] as const) {
      sim.enqueue({ type: "story-choice", choice, option });
    }
    sim.enqueue({ type: "resolve-ending" });
    sim.step();
    sim.enqueue({ type: "resolve-ending" });
    sim.step();
    expect(sim.domain.story.ending).toBe("aya");
    expect(sim.domain.flags).toContain(ACT_ONE_ENDING_FLAG);
    expect(endings).toEqual([{ act: 1, endingId: "aya", title: "Aya" }]);
    expect(completed.map((c) => c.questId)).toEqual([QUEST_ECHO.id]);
    expect(sim.domain.quests[QUEST_ECHO.id]).toEqual({ status: "completed" });
  });

  it("story state is part of the snapshot and survives a reload", () => {
    const sim = afterM0();
    sim.enqueue({ type: "story-choice", choice: "name", option: "silent" });
    sim.step();
    const restored = Simulation.fromSnapshot(sim.snapshot(null, "x", ""));
    expect(restored.domain.story).toEqual({ choices: { name: "silent" }, ending: null, act2Ending: null });
    expect(stateHash(restored.snapshot(null, "x", ""))).toBe(stateHash(sim.snapshot(null, "x", "")));
  });
});
