import { describe, expect, it } from "vitest";
import {
  ACT_TWO_ENDINGS,
  ACT_TWO_ENDING_FLAG,
  ACT_TWO_OPENING,
  CLEANERS_DOWN,
  EMPTY_STORY,
  KAGAMI_AMBUSH_FLAG,
  KAGAMI_CLEANER_KEYS,
  KAGAMI_JOB_FLAG,
  MEMORY_CATALOG,
  MET_REN_FLAG,
  QUEST_DEFINITIONS,
  QUEST_ECHO,
  QUEST_MIRROR,
  REN_TRAIL_FLAG,
  STORY_CHOICES,
  activeMainStep,
  createCharacter,
  deriveStats,
  endingFlag,
  evaluateCondition,
  evaluateQuests,
  isActTwoEndingId,
  pendingScene,
  recalledFlag,
  recordChoice,
  resolveActTwoEnding,
  resolveEnding,
  seenFlag,
  setActTwoEnding,
  stepObjective,
  unlockMemory,
  type QuestLog,
} from "../src";

describe("act II story state (ADR-0023)", () => {
  it("ends where the archive goes, once", () => {
    expect(resolveActTwoEnding({})).toBeNull();
    for (const option of STORY_CHOICES.archive) {
      expect(resolveActTwoEnding(recordChoice(EMPTY_STORY, "archive", option).choices)).toBe(option);
      expect(isActTwoEndingId(option)).toBe(true);
    }
    const s = setActTwoEnding(EMPTY_STORY, "street");
    expect(s.act2Ending).toBe("street");
    expect(setActTwoEnding(s, "kagami")).toBe(s);
    expect(isActTwoEndingId("aya")).toBe(false);
  });

  it("act II choices never change the act-I ending", () => {
    const actOne = { case: "sealed", name: "silent", crash: "wheel" } as const;
    expect(resolveEnding({ ...actOne, rooftop: "together", voice: "listened", job: "refused" })).toBe("seki");
  });

  it("every ending moves the factions it is about, and only the kagami one brings a memory", () => {
    expect(ACT_TWO_ENDINGS.street.reputation).toContainEqual({ faction: "civilians", delta: 15 });
    expect(ACT_TWO_ENDINGS.hebi.reputation).toContainEqual({ faction: "hebi", delta: 15 });
    expect(ACT_TWO_ENDINGS.kagami.reputation).toContainEqual({ faction: "kagami", delta: 20 });
    expect(Object.values(ACT_TWO_ENDINGS).filter((e) => "memory" in e).map((e) => e.id)).toEqual(["kagami"]);
    expect(endingFlag("street")).toBe("ending:street");
  });

  it("the new memories are real progression", () => {
    let c = createCharacter();
    const base = deriveStats(c);
    for (const id of ["rooftop", "last_call", "mirror"] as const) {
      expect(MEMORY_CATALOG[id].id).toBe(id);
      c = unlockMemory(c, id);
    }
    const stats = deriveStats(c);
    expect(stats.maxHp).toBe(base.maxHp + 15);
    expect(stats.aimStability).toBeCloseTo(base.aimStability + 0.1);
    expect(stats.critChance).toBeCloseTo(base.critChance + 0.05);
  });
});

describe("act II quest (Lustro)", () => {
  it("starts when act I is complete", () => {
    const r = evaluateQuests({ [QUEST_ECHO.id]: { status: "active", stepIndex: 3 } }, QUEST_DEFINITIONS, [recalledFlag("crash_night"), "act1_ending"]);
    expect(r.transitions.map((t) => t.type)).toEqual(["completed", "started"]);
    expect(r.log[QUEST_MIRROR.id]).toEqual({ status: "active", stepIndex: 0 });
  });

  it("reads its first step after the ending of act I", () => {
    const first = QUEST_MIRROR.steps[0]!;
    expect(stepObjective(first, [endingFlag("aya")])).toBe("quest.m3_lustro.ren_trail");
    expect(stepObjective(first, [endingFlag("seki")])).toBe("quest.m3_lustro.ren_trail.sold");
  });

  it("walks every step only after the flashback of the step before, and follows the fight", () => {
    let log: QuestLog = { [QUEST_ECHO.id]: { status: "completed" }, [QUEST_MIRROR.id]: { status: "active", stepIndex: 0 } };
    const flags: string[] = [];
    const step = () => activeMainStep(log, QUEST_DEFINITIONS)?.step ?? null;
    const advance = (...add: string[]) => {
      flags.push(...add);
      const r = evaluateQuests(log, QUEST_DEFINITIONS, flags);
      log = r.log;
      return r.transitions.flatMap((t) => t.rewards);
    };
    expect(advance(REN_TRAIL_FLAG)).toEqual([]);
    expect(step()?.id).toBe("meet_ren");
    expect(advance(MET_REN_FLAG)).toEqual([{ type: "memory", memoryId: "rooftop" }]);
    // Kaito's news alone is not enough while the "dach" flashback waits.
    expect(advance(KAGAMI_JOB_FLAG)).toEqual([]);
    expect(advance(recalledFlag("rooftop"))).toEqual([{ type: "memory", memoryId: "last_call" }]);
    expect(step()?.id).toBe("overpass");
    expect(stepObjective(step()!, flags)).toBe("quest.m3_lustro.overpass");
    flags.push(KAGAMI_AMBUSH_FLAG);
    expect(stepObjective(step()!, flags)).toBe("quest.m3_lustro.overpass.ambush");
    flags.push(...KAGAMI_CLEANER_KEYS.map((k) => `dead:${k}`));
    expect(evaluateCondition(CLEANERS_DOWN, flags)).toBe(true);
    expect(stepObjective(step()!, flags)).toBe("quest.m3_lustro.overpass.cleared");
    expect(advance(ACT_TWO_ENDING_FLAG)).toEqual([]);
    expect(step()?.id).toBe("overpass");
    advance(recalledFlag("last_call"));
    expect(log[QUEST_MIRROR.id]).toEqual({ status: "completed" });
    expect(activeMainStep(log, QUEST_DEFINITIONS)).toBeNull();
  });
});

describe("scenes that play on their own", () => {
  const quests: QuestLog = { [QUEST_MIRROR.id]: { status: "active", stepIndex: 0 } };

  it("plays a waiting flashback before the act-II opening, then the opening once", () => {
    const character = unlockMemory(createCharacter(), "crash_night");
    expect(pendingScene({ character, flags: [], quests })).toBe("recall_crash_night");
    expect(pendingScene({ character, flags: [recalledFlag("crash_night")], quests })).toBe(ACT_TWO_OPENING);
    expect(pendingScene({ character, flags: [recalledFlag("crash_night"), seenFlag(ACT_TWO_OPENING)], quests })).toBeNull();
    expect(pendingScene({ character: createCharacter(), flags: [], quests: {} })).toBeNull();
  });

  it("plays the mirror after the kagami ending", () => {
    const character = unlockMemory(createCharacter(), "mirror");
    expect(pendingScene({ character, flags: [seenFlag(ACT_TWO_OPENING)], quests })).toBe("recall_mirror");
  });
});
