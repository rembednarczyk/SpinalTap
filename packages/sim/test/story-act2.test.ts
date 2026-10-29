import { describe, expect, it } from "vitest";
import {
  ACT_TWO_ENDING_FLAG,
  KAGAMI_AMBUSH_FLAG,
  KAGAMI_CLEANER_KEYS,
  KAGAMI_JOB_FLAG,
  QUEST_ECHO,
  QUEST_MIRROR,
  REN_TRAIL_FLAG,
  endingFlag,
  recalledFlag,
} from "@seki/core";
import { Simulation, market, stateHash } from "../src";
import { collect, run } from "./helpers";

/** Act II at `stepIndex`, after the "aya" ending, built the way a load would build it. */
const inActTwo = (stepIndex: number, flags: string[] = [], at?: { x: number; y: number; z: number }): Simulation => {
  const snap = Simulation.create({ seed: 5 }).snapshot(null, "test", "");
  const entities = at ? snap.entities.map((e) => (e.key === "player" ? { ...e, position: at } : e)) : snap.entities;
  return Simulation.fromSnapshot({
    ...snap,
    entities,
    domain: {
      ...snap.domain,
      quests: { m0_first_contract: { status: "completed" }, [QUEST_ECHO.id]: { status: "completed" }, [QUEST_MIRROR.id]: { status: "active", stepIndex } },
      story: { choices: { case: "opened", name: "spoken", crash: "wheel" }, ending: "aya", act2Ending: null },
      flags: ["act1_ending", endingFlag("aya"), ...flags].sort(),
    },
  });
};

// On the roof of the market hall and on the viaduct (the market moved by ADR-0045).
const ROOF = market(85, 12.7, 59.6);
const DECK = market(98.5, 9.9, 92);
const has = (sim: Simulation, key: string) => [...sim.world].some((e) => e.key === key);

describe("act II in the simulation (ADR-0023)", () => {
  it("resolves the ending from the archive choice once, moves the factions and grants the kagami memory", () => {
    const sim = inActTwo(3, [recalledFlag("last_call")]);
    const endings = collect(sim, "EndingReached");
    const before = sim.domain.reputation;
    sim.enqueue({ type: "resolve-ending", act: 2 });
    sim.step();
    expect(sim.domain.story.act2Ending).toBeNull();
    sim.enqueue({ type: "story-choice", choice: "archive", option: "kagami" });
    sim.enqueue({ type: "resolve-ending", act: 2 });
    sim.enqueue({ type: "resolve-ending", act: 2 });
    sim.step();
    expect(sim.domain.story.act2Ending).toBe("kagami");
    expect(endings).toEqual([{ act: 2, endingId: "kagami", title: "Kopia" }]);
    expect(sim.domain.flags).toEqual(expect.arrayContaining([ACT_TWO_ENDING_FLAG, endingFlag("kagami")]));
    expect(sim.domain.reputation.kagami - before.kagami).toBe(20);
    expect(sim.domain.reputation.fixers - before.fixers).toBe(10);
    expect(sim.domain.character.memories).toContain("mirror");
    expect(sim.domain.quests[QUEST_MIRROR.id]).toEqual({ status: "completed" });
  });

  it("does not close act II before act I", () => {
    const sim = Simulation.create({ seed: 5 });
    sim.enqueue({ type: "story-choice", choice: "archive", option: "street" });
    sim.enqueue({ type: "resolve-ending", act: 2 });
    sim.step();
    expect(sim.domain.story.act2Ending).toBeNull();
  });

  it("raises the act-I ending as a flag", () => {
    const sim = Simulation.create({ seed: 5 });
    sim.enqueue({ type: "resolve-ending" });
    sim.step();
    expect(sim.domain.story.ending).toBe("seki");
    expect(sim.domain.flags).toContain(endingFlag("seki"));
  });

  it("brings Ren onto the roof once someone said where he is, and lets Kagami take him", () => {
    const sim = inActTwo(0, [], ROOF);
    run(sim, 1);
    expect(sim.district).toBe("targ");
    expect(has(sim, "ren")).toBe(false);
    sim.enqueue({ type: "set-flag", flag: REN_TRAIL_FLAG });
    run(sim, 2);
    expect(has(sim, "ren")).toBe(true);
    const restored = Simulation.fromSnapshot(sim.snapshot(null, "x", ""));
    expect(has(restored, "ren")).toBe(true);
    sim.enqueue({ type: "set-flag", flag: endingFlag("kagami") });
    run(sim, 2);
    expect(has(sim, "ren")).toBe(false);
    expect(sim.snapshot(null, "x", "").entities.some((e) => e.key === "ren")).toBe(false);
  });

  it("swaps Kurosawa for his cleaners when the deal is off, and they fight", () => {
    const sim = inActTwo(3, [REN_TRAIL_FLAG, KAGAMI_JOB_FLAG, recalledFlag("last_call")], DECK);
    run(sim, 1);
    expect(has(sim, "kurosawa")).toBe(true);
    expect(KAGAMI_CLEANER_KEYS.some((k) => has(sim, k))).toBe(false);
    sim.enqueue({ type: "set-flag", flag: KAGAMI_AMBUSH_FLAG });
    run(sim, 2);
    expect(has(sim, "kurosawa")).toBe(false);
    const cleaners = [...sim.world].filter((e) => e.tag === "kagami_cleaner").sort((a, b) => a.id - b.id);
    expect(cleaners.map((e) => e.key)).toEqual([...KAGAMI_CLEANER_KEYS]);
    expect(cleaners.every((e) => e.faction === "kagami" && e.enemy?.type === "kagami_cleaner" && e.health?.max === 110)).toBe(true);
    // Neutral Kagami attacks on sight, like Hebi.
    run(sim, 120);
    expect(cleaners.some((e) => e.ai?.alerted)).toBe(true);

    // The dead stay dead across a reload; the rest come back where they stood.
    const first = cleaners[0]!;
    first.health = { current: 0, max: first.health!.max };
    run(sim, 1);
    expect(sim.domain.flags).toContain(`dead:${KAGAMI_CLEANER_KEYS[0]}`);
    const restored = Simulation.fromSnapshot(sim.snapshot(null, "x", ""));
    expect(has(restored, KAGAMI_CLEANER_KEYS[0])).toBe(false);
    expect(has(restored, KAGAMI_CLEANER_KEYS[1])).toBe(true);
    expect(stateHash(restored.snapshot(null, "x", ""))).toBe(stateHash(sim.snapshot(null, "x", "")));
  });

  it("a dead cleaner costs standing with Kagami, not with the street", () => {
    const sim = inActTwo(3, [KAGAMI_JOB_FLAG, KAGAMI_AMBUSH_FLAG], DECK);
    run(sim, 1);
    const cleaner = [...sim.world].find((e) => e.key === KAGAMI_CLEANER_KEYS[1])!;
    cleaner.lastHitBy = sim.player()!.id;
    cleaner.health = { current: 0, max: cleaner.health!.max };
    const civilians = sim.domain.reputation.civilians;
    run(sim, 1);
    expect(sim.domain.reputation.kagami).toBe(-6);
    expect(sim.domain.reputation.civilians).toBe(civilians);
  });
});
