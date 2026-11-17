import { describe, expect, it } from "vitest";
import { type DomainState, type SaveSnapshot, TESSEN_HUNT, gameDayOf, isTessenHuntRollFlag, tessenHuntFlag, tessenSquadDue, tessenSquadFlag } from "@seki/core";
import { CLINIC_WAKE_SPOT, SIM_HZ, Simulation, TESSEN_SQUAD_BACK_PREFIX, TESSEN_SQUAD_LATE_SECONDS, ground, stateHash, tessenHuntStretch, tessenSquadBack } from "../src";
import { run, teleportPlayer } from "./helpers";

/*
 * G-934: the flags of Tessen's hunt outlived the squad they were of. Gone back from where no way led
 * to her (G-922), the squad waited past the stretch of the day it went back in, so no roll came
 * then and, once she stood where a way led, it came in at once, unwarned, hours after the warning.
 * One on its way with no entry where she was (the clinic) waited for one for good. Now the squad
 * gone back, and the entries it found no way from, are the stretch's: past it the next roll warns
 * her as any does (the user's decision of 17.11). One on its way is gone once it is late past its
 * tick as the wait's refusal allows (#682): a squad never comes in long after the warning.
 */

type Holder = { holder: { domain: DomainState } };
const setDomain = (sim: Simulation, change: (d: DomainState) => DomainState): void => {
  const holder = (sim as unknown as Holder).holder;
  holder.domain = change(holder.domain);
};
const squad = (sim: Simulation) => [...sim.world].filter((e) => e.security && e.enemy?.type === "tessen_guard" && (e.health?.current ?? 0) > 0);
const waylessFlags = (sim: Simulation) => sim.domain.flags.filter((f) => f.startsWith("tessen-hunt-wayless:"));
const RYNEK = ground(575, -38);

/** On the hunt's first day, with Tessen at -60, with `flags` of the hunt besides. */
const hunted = (seed: number, ...flags: string[]): Simulation => {
  const sim = Simulation.create({ seed });
  const day = gameDayOf(sim.domain.clock);
  setDomain(sim, (d) => ({ ...d, flags: [...d.flags, tessenHuntFlag(day + TESSEN_HUNT.days), ...flags], reputation: { ...d.reputation, tessen: -60 } }));
  return sim;
};

/** The squad gone back from the Trybunał's block, where no way leads to her from an entry. */
const goneBack = (seed: number): Simulation => {
  const sim = hunted(seed, tessenSquadFlag(TESSEN_HUNT.squadMin, 0));
  teleportPlayer(sim, ground(608, -5), 0);
  for (let s = 0; s < 10 && !tessenSquadBack(sim.domain.flags); s++) run(sim, SIM_HZ);
  expect(tessenSquadBack(sim.domain.flags)).toMatchObject({ stretch: tessenHuntStretch(sim.domain.clock) });
  return sim;
};

const wait = (sim: Simulation, hours: number): void => {
  sim.enqueue({ type: "wait", minutes: hours * 60 });
  run(sim, 1);
};

/** Seconds from now to the first one the squad is in (once a second); null if it is not in `limit` s. */
const cameIn = (sim: Simulation, limit: number): number | null => {
  for (let s = 1; s <= limit; s++) {
    run(sim, SIM_HZ);
    if (squad(sim).length > 0) return s;
  }
  return null;
};

describe("the hunt's flags of a squad are its stretch's (G-934)", () => {
  it.each([7, 11])("seed %i: gone back, past its stretch the squad is gone and the next roll warns her before one comes in", (seed) => {
    const sim = goneBack(seed);
    expect(waylessFlags(sim).length).toBeGreaterThan(0);
    // In its stretch it waits for her: no roll.
    run(sim, 3 * SIM_HZ);
    expect(tessenSquadBack(sim.domain.flags)).not.toBeNull();
    expect(tessenSquadDue(sim.domain.flags)).toBeNull();
    wait(sim, 10);
    teleportPlayer(sim, RYNEK, 0);
    run(sim, SIM_HZ);
    expect(sim.domain.flags.filter((f) => f.startsWith(TESSEN_SQUAD_BACK_PREFIX))).toEqual([]);
    expect(waylessFlags(sim)).toEqual([]);
    // The stretch's roll put a squad on its way, the HUD's warning (G-911), 20-40 s ahead.
    const due = tessenSquadDue(sim.domain.flags);
    expect(due).not.toBeNull();
    expect(sim.domain.flags.filter(isTessenHuntRollFlag)).toEqual([expect.stringMatching(`@${tessenHuntStretch(sim.domain.clock)}$`)]);
    const came = cameIn(sim, 60);
    expect(came).not.toBeNull();
    expect(came!).toBeGreaterThanOrEqual(TESSEN_HUNT.delayMinSeconds - 2);
    expect(squad(sim).length).toBe(due!.size);
  });

  it("past its stretch, where she stood, the entries no way led from are free again: the next roll warns her", () => {
    const sim = goneBack(7);
    const wayless = waylessFlags(sim);
    expect(wayless.length).toBeGreaterThan(0);
    wait(sim, 10);
    run(sim, SIM_HZ);
    expect(sim.domain.flags.filter((f) => wayless.includes(f) || f.startsWith(TESSEN_SQUAD_BACK_PREFIX))).toEqual([]);
    expect(tessenSquadDue(sim.domain.flags)).not.toBeNull();
    expect(squad(sim)).toEqual([]);
  });

  it("a squad on its way with no entry where she is (the clinic) is gone once late; out of it, the next roll warns her first", () => {
    const sim = hunted(3);
    teleportPlayer(sim, CLINIC_WAKE_SPOT, 0);
    const due = sim.tick + 2 * SIM_HZ;
    setDomain(sim, (d) => ({ ...d, flags: [...d.flags, tessenSquadFlag(TESSEN_HUNT.squadMin, due)] }));
    run(sim, due + TESSEN_SQUAD_LATE_SECONDS * SIM_HZ - sim.tick + SIM_HZ);
    expect(tessenSquadDue(sim.domain.flags)).toBeNull();
    expect(squad(sim)).toEqual([]);
    // Past its stretch, still where no entry is: no roll, nothing on its way.
    wait(sim, 10);
    run(sim, 3 * SIM_HZ);
    expect(sim.domain.flags.some((f) => f.startsWith("tessen-hunt-squad:") || f.startsWith(TESSEN_SQUAD_BACK_PREFIX))).toBe(false);
    teleportPlayer(sim, RYNEK, 0);
    run(sim, SIM_HZ);
    expect(tessenSquadDue(sim.domain.flags)).not.toBeNull();
    expect(cameIn(sim, 60)!).toBeGreaterThanOrEqual(TESSEN_HUNT.delayMinSeconds - 2);
  });

  it("a squad on its way comes in at its tick in the next stretch: it was warned", () => {
    const sim = hunted(3);
    teleportPlayer(sim, RYNEK, 0);
    const due = sim.tick + 5 * SIM_HZ;
    const flag = tessenSquadFlag(TESSEN_HUNT.squadMin, due);
    setDomain(sim, (d) => ({ ...d, flags: [...d.flags, flag] }));
    wait(sim, 10);
    run(sim, 2 * SIM_HZ);
    expect(sim.domain.flags).toContain(flag);
    expect(squad(sim)).toEqual([]);
    expect(cameIn(sim, 10)).not.toBeNull();
    expect(tessenSquadDue(sim.domain.flags)).toBeNull();
  });

  it("a save of v44 with the squad gone back by its size alone is of a stretch past: the next roll warns her", () => {
    const sim = hunted(3, `${TESSEN_SQUAD_BACK_PREFIX}${TESSEN_HUNT.squadMin}`, "tessen-hunt-wayless:0@1,2,3");
    teleportPlayer(sim, RYNEK, 0);
    run(sim, SIM_HZ);
    expect(tessenSquadBack(sim.domain.flags)).toBeNull();
    expect(waylessFlags(sim)).toEqual([]);
    expect(tessenSquadDue(sim.domain.flags)).not.toBeNull();
    expect(cameIn(sim, 60)!).toBeGreaterThanOrEqual(TESSEN_HUNT.delayMinSeconds - 2);
  });

  it("a save while the squad waits gone back loads to the same state past its stretch", () => {
    const sim = goneBack(7);
    const loaded = Simulation.fromSnapshot(JSON.parse(JSON.stringify(sim.snapshot(null, "t", ""))) as SaveSnapshot);
    for (const s of [sim, loaded]) {
      wait(s, 10);
      teleportPlayer(s, RYNEK, 0);
      run(s, 3 * SIM_HZ);
    }
    expect(tessenSquadBack(sim.domain.flags)).toBeNull();
    expect(tessenSquadDue(loaded.domain.flags)).toEqual(tessenSquadDue(sim.domain.flags));
    expect(tessenSquadDue(sim.domain.flags)).not.toBeNull();
    expect(stateHash(loaded.snapshot(null, "t", ""))).toBe(stateHash(sim.snapshot(null, "t", "")));
  });
});
