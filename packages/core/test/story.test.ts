import { describe, expect, it } from "vitest";
import {
  ACT_ONE_ENDING_FLAG,
  EMPTY_STORY,
  MEMORY_CATALOG,
  MORI_MODULE_FLAG,
  QUEST_DEFINITIONS,
  QUEST_ECHO,
  QUEST_FIRST_CONTRACT,
  RECALL_MEMORIES,
  activeMainStep,
  createCharacter,
  createDomainState,
  deriveStats,
  evaluateQuests,
  isEndingId,
  isStoryChoiceId,
  isStoryOption,
  pendingRecall,
  progressFlag,
  recallDialogueId,
  recalledFlag,
  recordChoice,
  resolveEnding,
  setEnding,
  unlockMemory,
  type QuestDefinition,
  type QuestLog,
} from "../src";

describe("story choices and endings", () => {
  it("records the first answer to a choice and ignores later or invalid ones", () => {
    const a = recordChoice(EMPTY_STORY, "case", "opened");
    expect(a.choices).toEqual({ case: "opened" });
    expect(recordChoice(a, "case", "sealed")).toBe(a);
    expect(recordChoice(a, "name", "wheel")).toBe(a);
    expect(recordChoice(a, "name", "silent").choices).toEqual({ case: "opened", name: "silent" });
  });

  it.each([
    [{ case: "opened", name: "spoken", crash: "wheel" }, "aya"],
    [{ case: "opened", name: "spoken", crash: "ren" }, "aya"],
    [{ case: "sealed", name: "spoken", crash: "wheel" }, "aya"],
    [{ case: "opened", name: "silent", crash: "ren" }, "seki"],
    [{ case: "sealed", name: "silent", crash: "ren" }, "seki"],
    [{}, "seki"],
  ] as const)("resolves %j to %s", (choices, ending) => {
    expect(resolveEnding(choices)).toBe(ending);
  });

  it("sets the ending once", () => {
    const s = setEnding(EMPTY_STORY, "aya");
    expect(s.ending).toBe("aya");
    expect(setEnding(s, "seki")).toBe(s);
  });

  it("guards ids coming from ink and saves", () => {
    expect(isStoryChoiceId("crash")).toBe(true);
    expect(isStoryChoiceId("toString")).toBe(false);
    expect(isStoryOption("crash", "ren")).toBe(true);
    expect(isStoryOption("crash", "opened")).toBe(false);
    expect(isEndingId("seki")).toBe(true);
    expect(isEndingId("happy")).toBe(false);
  });
});

describe("memory flashbacks", () => {
  it("every recall memory is in the catalog and maps to an ink knot", () => {
    for (const id of RECALL_MEMORIES) expect(MEMORY_CATALOG[id].id).toBe(id);
    expect(recallDialogueId("crash_night")).toBe("recall_crash_night");
  });

  it("a recovered fragment is pending until its flashback raises the recalled flag", () => {
    const character = unlockMemory(unlockMemory(createCharacter(), "combat_reflex"), "courier_case");
    expect(pendingRecall({ character, flags: [] })).toBe("courier_case");
    expect(pendingRecall({ character, flags: [recalledFlag("courier_case")] })).toBeNull();
    expect(pendingRecall({ character: createCharacter(), flags: [] })).toBeNull();
  });

  it("the fragments are real progression: they change derived stats", () => {
    const base = deriveStats(createCharacter());
    let c = createCharacter();
    for (const id of RECALL_MEMORIES) c = unlockMemory(c, id);
    const s = deriveStats(c);
    expect(s.armor).toBe(base.armor + 2);
    expect(s.critMultiplier).toBeCloseTo(base.critMultiplier + 0.25);
    expect(s.moveSpeed).toBeCloseTo(base.moveSpeed + 0.4);
  });
});

describe("act I quest (Echo)", () => {
  const m0Flags = ["met_fixer", "killed:hebi_courier", "reported_back"];

  it("starts when the first contract completes and new games start without it", () => {
    expect(createDomainState().quests[QUEST_ECHO.id]).toBeUndefined();
    expect(createDomainState().story).toEqual(EMPTY_STORY);
    const r = evaluateQuests({ [QUEST_FIRST_CONTRACT.id]: { status: "active", stepIndex: 2 } }, QUEST_DEFINITIONS, m0Flags);
    expect(r.transitions.map((t) => t.type)).toEqual(["completed", "started"]);
    expect(r.transitions[1]).toMatchObject({ questId: QUEST_ECHO.id, step: { id: "echo_contract" }, rewards: [] });
    expect(activeMainStep(r.log, QUEST_DEFINITIONS)?.step.id).toBe("echo_contract");
  });

  it("does not restart a follow-up that is already in the log", () => {
    const log: QuestLog = { [QUEST_FIRST_CONTRACT.id]: { status: "active", stepIndex: 2 }, [QUEST_ECHO.id]: { status: "completed" } };
    const r = evaluateQuests(log, QUEST_DEFINITIONS, m0Flags);
    expect(r.transitions.map((t) => t.type)).toEqual(["completed"]);
    expect(r.log[QUEST_ECHO.id]).toEqual({ status: "completed" });
  });

  it("skips follow-ups without steps", () => {
    const empty: QuestDefinition = { id: "empty", title: "", main: false, startsAfter: QUEST_FIRST_CONTRACT.id, steps: [] };
    const r = evaluateQuests({ [QUEST_FIRST_CONTRACT.id]: { status: "active", stepIndex: 2 } }, [QUEST_FIRST_CONTRACT, empty], m0Flags);
    expect(r.log.empty).toBeUndefined();
  });

  it("walks every step only when the flashback of the previous fragment was played", () => {
    let log: QuestLog = { [QUEST_ECHO.id]: { status: "active", stepIndex: 0 } };
    const step = () => activeMainStep(log, QUEST_DEFINITIONS)?.step.id ?? null;
    const flags: string[] = [];
    const advance = (...add: string[]) => {
      flags.push(...add);
      const r = evaluateQuests(log, QUEST_DEFINITIONS, flags);
      log = r.log;
      return r.transitions.flatMap((t) => t.rewards);
    };
    expect(advance(progressFlag("contract_completed", "echo_contract"))).toEqual([{ type: "memory", memoryId: "courier_case" }]);
    expect(advance(MORI_MODULE_FLAG)).toEqual([]);
    expect(step()).toBe("ask_mori");
    expect(advance(recalledFlag("courier_case"))).toEqual([{ type: "memory", memoryId: "operating_table" }]);
    // An implant bought during an earlier step does not count.
    expect(advance(recalledFlag("operating_table"), progressFlag("cyberware_installed", "ask_mori"))).toEqual([]);
    expect(advance(progressFlag("cyberware_installed", "new_implant"))).toEqual([{ type: "memory", memoryId: "crash_night" }]);
    expect(advance(ACT_ONE_ENDING_FLAG)).toEqual([]);
    expect(step()).toBe("decide");
    advance(recalledFlag("crash_night"));
    expect(log[QUEST_ECHO.id]).toEqual({ status: "completed" });
    expect(activeMainStep(log, QUEST_DEFINITIONS)).toBeNull();
  });
});
