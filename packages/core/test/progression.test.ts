import { describe, expect, it } from "vitest";
import {
  ATTRIBUTE_IDS,
  ATTRIBUTE_MAX,
  ATTRIBUTE_START,
  INITIAL_PROGRESSION,
  LEVEL_THRESHOLDS,
  MAX_LEVEL,
  QUEST_DEFINITIONS,
  QUEST_ECHO,
  QUEST_FIRST_CONTRACT,
  QUICKHACK_XP,
  UNDETECTED_CONTRACT_XP,
  type ProgressionState,
  breachXp,
  combineModifiers,
  BASE_STATS,
  contractXp,
  createDomainState,
  gainXp,
  killXp,
  levelForXp,
  levelModifiers,
  progressionFromXp,
  questLogXp,
  spendAttributePoint,
  xpForLevel,
  xpToNext,
} from "../src";

describe("experience curve (ADR-0059)", () => {
  it("takes round(100 × L^1.6) XP per level: 100 to level 2, about 21.9k for the last one", () => {
    expect(xpToNext(1)).toBe(100);
    expect(xpToNext(2)).toBe(303);
    expect(xpToNext(29)).toBe(21_869);
    expect(xpToNext(MAX_LEVEL)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(LEVEL_THRESHOLDS).toHaveLength(MAX_LEVEL);
  });

  it("the whole road to level 30 is about 255 thousand XP", () => {
    expect(xpForLevel(MAX_LEVEL)).toBe(254_960);
    expect(xpForLevel(MAX_LEVEL)).toBeGreaterThan(250_000);
    expect(xpForLevel(MAX_LEVEL)).toBeLessThan(260_000);
  });

  it("the level follows the thresholds and stops at 30", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(402)).toBe(2);
    expect(levelForXp(403)).toBe(3);
    expect(levelForXp(10_000_000)).toBe(MAX_LEVEL);
    for (let level = 1; level <= MAX_LEVEL; level++) expect(levelForXp(xpForLevel(level))).toBe(level);
  });
});

describe("level ups and points (ADR-0059)", () => {
  it("a new game is level 1 with 3 in every attribute and nothing to spend", () => {
    const p = createDomainState().progression;
    expect(p).toEqual(INITIAL_PROGRESSION);
    expect(p.level).toBe(1);
    for (const a of ATTRIBUTE_IDS) expect(p.attributes[a]).toBe(ATTRIBUTE_START);
    expect(p.unspent).toEqual({ attribute: 0, perk: 0 });
    expect(p.perks).toEqual({});
  });

  it("every level gained gives one attribute point and one perk point", () => {
    const one = gainXp(INITIAL_PROGRESSION, 99);
    expect(one.levelsGained).toBe(0);
    expect(one.state.unspent).toEqual({ attribute: 0, perk: 0 });
    const two = gainXp(one.state, 1);
    expect(two).toMatchObject({ levelsGained: 1, state: { xp: 100, level: 2, unspent: { attribute: 1, perk: 1 } } });
    // One big reward can carry over several thresholds.
    const big = gainXp(two.state, xpForLevel(6) - 100);
    expect(big.levelsGained).toBe(4);
    expect(big.state).toMatchObject({ level: 6, unspent: { attribute: 5, perk: 5 } });
  });

  it("ignores nothing and negative XP, and never goes past level 30", () => {
    expect(gainXp(INITIAL_PROGRESSION, 0).state).toBe(INITIAL_PROGRESSION);
    expect(gainXp(INITIAL_PROGRESSION, -50).state).toBe(INITIAL_PROGRESSION);
    const top = gainXp(INITIAL_PROGRESSION, 1_000_000);
    expect(top.levelsGained).toBe(MAX_LEVEL - 1);
    expect(top.state.unspent).toEqual({ attribute: 29, perk: 29 });
    expect(gainXp(top.state, 50_000).levelsGained).toBe(0);
  });

  it("spends a point into an attribute, refused without points and at 15", () => {
    expect(spendAttributePoint(INITIAL_PROGRESSION, "might")).toEqual({ ok: false, reason: "no-points" });
    const rich = progressionFromXp(xpForLevel(20));
    const r = spendAttributePoint(rich, "net");
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.attributes.net).toBe(ATTRIBUTE_START + 1);
    expect(r.state.unspent).toEqual({ attribute: 18, perk: 19 });
    let s: ProgressionState = rich;
    for (let i = ATTRIBUTE_START; i < ATTRIBUTE_MAX; i++) {
      const next = spendAttributePoint(s, "shadow");
      if (!next.ok) throw new Error(next.reason);
      s = next.state;
    }
    expect(s.attributes.shadow).toBe(ATTRIBUTE_MAX);
    expect(spendAttributePoint(s, "shadow")).toEqual({ ok: false, reason: "at-max" });
    expect(s.unspent.attribute).toBe(19 - (ATTRIBUTE_MAX - ATTRIBUTE_START));
  });

  it("an old character's XP gives its level and every point still to spend", () => {
    expect(progressionFromXp(xpForLevel(7) + 10)).toMatchObject({ level: 7, unspent: { attribute: 6, perk: 6 }, attributes: INITIAL_PROGRESSION.attributes });
  });

  it("each level above 1 adds 3 maximum health through the stat modifiers", () => {
    expect(levelModifiers(INITIAL_PROGRESSION)).toEqual({ maxHp: 0 });
    expect(combineModifiers(BASE_STATS, [levelModifiers(progressionFromXp(xpForLevel(10)))]).maxHp).toBe(BASE_STATS.maxHp + 27);
  });
});

describe("XP sources (ADR-0059)", () => {
  it("contracts pay by difficulty: the template and the targets", () => {
    expect(contractXp("eliminate", 3)).toBeGreaterThan(contractXp("eliminate", 2));
    expect(contractXp("delivery", 0)).toBeLessThan(contractXp("eliminate", 2));
    expect(contractXp("infiltrate", 3)).toBeGreaterThan(contractXp("retrieve", 3));
  });

  it("tougher enemies are worth more; a breach that won nothing is worth nothing", () => {
    expect(killXp("hebi_enforcer")).toBeGreaterThan(killXp("hebi_ganger"));
    expect(killXp("tessen_guard")).toBeGreaterThan(killXp("hebi_ganger"));
    expect(breachXp(0)).toBe(0);
    expect(breachXp(2)).toBeGreaterThan(breachXp(1));
  });

  it("the quest log counts the steps done and the quests finished", () => {
    expect(questLogXp({}, QUEST_DEFINITIONS)).toBe(0);
    const firstStep = QUEST_FIRST_CONTRACT.steps[0]?.xp ?? 0;
    expect(questLogXp({ [QUEST_FIRST_CONTRACT.id]: { status: "active", stepIndex: 1 } }, QUEST_DEFINITIONS)).toBe(firstStep);
    const all = QUEST_FIRST_CONTRACT.steps.reduce((s, x) => s + (x.xp ?? 0), QUEST_FIRST_CONTRACT.xp ?? 0);
    expect(questLogXp({ [QUEST_FIRST_CONTRACT.id]: { status: "completed" } }, QUEST_DEFINITIONS)).toBe(all);
  });
});

/**
 * The pace (ADR-0059): one district's main thread with its contracts gives 8 to 10 levels.
 * Krakowskie Przedmieście as played today: the first contract and act I ("Echo"), ten of
 * Kaito's jobs (five eliminations of three Hebi, five deliveries), the gangers they send plus
 * the courier and his guard, a quickhack a job, four of the jobs done unseen.
 */
describe("pace of one district (ADR-0059)", () => {
  it("the main thread of Krakowskie with its contracts gives 8 to 10 levels", () => {
    const quests = questLogXp({ [QUEST_FIRST_CONTRACT.id]: { status: "completed" }, [QUEST_ECHO.id]: { status: "completed" } }, QUEST_DEFINITIONS);
    const gains: number[] = [quests];
    for (let i = 0; i < 5; i++) gains.push(contractXp("eliminate", 3), contractXp("delivery", 0));
    const kills = 5 * 3 + 2;
    for (let i = 0; i < kills; i++) gains.push(killXp("hebi_ganger"));
    for (let i = 0; i < 4; i++) gains.push(UNDETECTED_CONTRACT_XP);
    for (let i = 0; i < 10; i++) gains.push(QUICKHACK_XP);
    let p = INITIAL_PROGRESSION;
    let levels = 0;
    for (const xp of gains) {
      const r = gainXp(p, xp);
      p = r.state;
      levels += r.levelsGained;
    }
    expect(levels).toBe(p.level - 1);
    expect(levels).toBeGreaterThanOrEqual(8);
    expect(levels).toBeLessThanOrEqual(10);
    // Not at the edge of the range: about the middle of level 10.
    expect(p.xp).toBeGreaterThan(xpForLevel(10));
    expect(p.xp).toBeLessThan(xpForLevel(11));
  });
});
