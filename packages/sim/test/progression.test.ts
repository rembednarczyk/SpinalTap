import { describe, expect, it } from "vitest";
import {
  type Contract,
  type DomainState,
  QUEST_FIRST_CONTRACT,
  UNDETECTED_CONTRACT_XP,
  contractXp,
  freshTally,
  killXp,
  progressionFromXp,
  xpForLevel,
} from "@seki/core";
import { Simulation } from "../src";
import { collect } from "./helpers";

/** A new game with `patch` applied to the domain, loaded through a snapshot. */
const simWith = (patch: (d: DomainState) => DomainState = (d) => d, seed = 31): Simulation => {
  const base = Simulation.create({ seed });
  const snap = base.snapshot(null, "t", "");
  return Simulation.fromSnapshot({ ...snap, domain: patch(snap.domain) });
};

const cleared: Contract = { id: "c1", kind: "eliminate", siteId: "east_lot", targets: 3, reward: 600, status: "cleared" };

const withCleared = (detected: boolean) => (d: DomainState): DomainState => ({
  ...d,
  contracts: { active: cleared, completed: 0, tally: { ...freshTally(0), detected } },
});

describe("experience in the simulation (ADR-0059)", () => {
  it("a quest step pays its XP; the first one takes the character to level 2", () => {
    const sim = simWith();
    const xp = collect<{ amount: number; source: string }>(sim, "ExperienceGained");
    const ups = collect<{ level: number }>(sim, "LevelUp");
    sim.enqueue({ type: "set-flag", flag: "met_fixer" });
    sim.step();
    expect(xp).toEqual([{ amount: QUEST_FIRST_CONTRACT.steps[0]?.xp, source: "quest" }]);
    expect(ups).toEqual([{ level: 2 }]);
    expect(sim.domain.progression).toMatchObject({ xp: 100, level: 2, unspent: { attribute: 1, perk: 1 } });
  });

  it("a finished contract pays by difficulty, and a bonus when nobody saw the player", () => {
    for (const detected of [false, true]) {
      const sim = simWith(withCleared(detected));
      const xp = collect<{ amount: number; source: string }>(sim, "ExperienceGained");
      sim.enqueue({ type: "complete-contract" });
      sim.step();
      const expected = [{ amount: contractXp("eliminate", 3), source: "contract" }];
      if (!detected) expected.push({ amount: UNDETECTED_CONTRACT_XP, source: "stealth" });
      expect(xp.filter((e) => e.source !== "quest")).toEqual(expected);
    }
  });

  it("an enemy killed by the player pays its type's XP; one killed by someone else pays nothing", () => {
    for (const byPlayer of [true, false]) {
      const sim = simWith();
      sim.step();
      const enemy = [...sim.world].find((e) => e.enemy && e.health);
      const player = sim.player();
      if (!enemy?.enemy || !enemy.health || !player) throw new Error("no enemy in the world");
      const xp = collect<{ amount: number; source: string }>(sim, "ExperienceGained");
      enemy.health = { ...enemy.health, current: 0 };
      enemy.lastHitBy = byPlayer ? player.id : enemy.id;
      sim.step();
      expect(xp.filter((e) => e.source === "kill")).toEqual(byPlayer ? [{ amount: killXp(enemy.enemy.type), source: "kill" }] : []);
    }
  });

  it("spends an attribute point by command; without a point nothing changes", () => {
    const poor = simWith();
    poor.enqueue({ type: "spend-attribute-point", attribute: "tech" });
    poor.step();
    expect(poor.domain.progression.attributes.tech).toBe(3);
    const sim = simWith((d) => ({ ...d, progression: progressionFromXp(xpForLevel(3)) }));
    sim.enqueue({ type: "spend-attribute-point", attribute: "tech" });
    sim.step();
    expect(sim.domain.progression.attributes.tech).toBe(4);
    expect(sim.domain.progression.unspent).toEqual({ attribute: 1, perk: 2 });
  });

  it("each level adds 3 maximum health, and it stays after a save", () => {
    const sim = simWith((d) => ({ ...d, progression: progressionFromXp(xpForLevel(10)) }));
    sim.step();
    expect(sim.player()?.health?.max).toBe(100 + 27);
    const loaded = Simulation.fromSnapshot(sim.snapshot(null, "t", ""));
    loaded.step();
    expect(loaded.domain.progression.level).toBe(10);
    expect(loaded.player()?.health?.max).toBe(127);
  });
});
