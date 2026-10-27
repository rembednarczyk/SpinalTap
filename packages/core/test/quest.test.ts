import { describe, expect, it } from "vitest";
import {
  QUEST_DEFINITIONS,
  QUEST_FIRST_CONTRACT,
  createDomainState,
  currentStep,
  evaluateCondition,
  evaluateQuests,
  findQuest,
  killedFlag,
  M0_TARGET_TAG,
  setFlag,
  startQuest,
  type QuestLog,
} from "../src";

const id = QUEST_FIRST_CONTRACT.id;

describe("quest graph", () => {
  it("new game starts the M0 quest at its first step", () => {
    const { quests } = createDomainState();
    expect(currentStep(quests, QUEST_FIRST_CONTRACT)?.id).toBe("find_fixer");
  });

  it("does not advance without the required flag", () => {
    const log = startQuest({}, QUEST_FIRST_CONTRACT);
    const r = evaluateQuests(log, QUEST_DEFINITIONS, [killedFlag(M0_TARGET_TAG)]);
    expect(r.transitions).toEqual([]);
    expect(r.log).toEqual(log);
  });

  it("advances step by step and hands out step rewards", () => {
    let log: QuestLog = startQuest({}, QUEST_FIRST_CONTRACT);
    let flags = setFlag([], "met_fixer");
    let r = evaluateQuests(log, QUEST_DEFINITIONS, flags);
    expect(r.transitions).toHaveLength(1);
    expect(r.transitions[0]).toMatchObject({ type: "advanced", step: { id: "eliminate_courier" } });
    log = r.log;

    flags = setFlag(flags, killedFlag(M0_TARGET_TAG));
    r = evaluateQuests(log, QUEST_DEFINITIONS, flags);
    expect(r.transitions[0]?.rewards).toEqual([{ type: "memory", memoryId: "combat_reflex" }]);
    log = r.log;

    r = evaluateQuests(log, QUEST_DEFINITIONS, setFlag(flags, "reported_back"));
    expect(r.transitions[0]).toMatchObject({ type: "completed", questId: id });
    expect(r.log[id]).toEqual({ status: "completed" });
    expect(currentStep(r.log, QUEST_FIRST_CONTRACT)).toBeNull();
  });

  it("completes several steps in one evaluation when all flags are present", () => {
    const flags = ["met_fixer", killedFlag(M0_TARGET_TAG), "reported_back"];
    const r = evaluateQuests(startQuest({}, QUEST_FIRST_CONTRACT), QUEST_DEFINITIONS, flags);
    // Finishing the first contract starts act I of the main thread.
    expect(r.transitions.map((t) => t.type)).toEqual(["advanced", "advanced", "completed", "started"]);
  });

  it("treats completed as terminal and ignores inactive quests", () => {
    const done: QuestLog = { [id]: { status: "completed" } };
    expect(evaluateQuests(done, QUEST_DEFINITIONS, ["met_fixer"]).transitions).toEqual([]);
    expect(evaluateQuests({}, QUEST_DEFINITIONS, ["met_fixer"]).transitions).toEqual([]);
  });

  it("startQuest does not reset a quest in progress", () => {
    const log: QuestLog = { [id]: { status: "active", stepIndex: 2 } };
    expect(startQuest(log, QUEST_FIRST_CONTRACT)).toBe(log);
  });

  it("evaluates compound conditions", () => {
    const cond = { type: "all" as const, of: [{ type: "flag" as const, flag: "a" }, { type: "flag" as const, flag: "b" }] };
    expect(evaluateCondition(cond, ["a"])).toBe(false);
    expect(evaluateCondition(cond, ["a", "b"])).toBe(true);
  });

  it("finds quests by id", () => {
    expect(findQuest(id)).toBe(QUEST_FIRST_CONTRACT);
    expect(findQuest("missing")).toBeUndefined();
  });

  it("keeps flags sorted and unique", () => {
    expect(setFlag(setFlag(setFlag([], "b"), "a"), "b")).toEqual(["a", "b"]);
  });
});
