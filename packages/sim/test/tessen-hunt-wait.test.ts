import { describe, expect, it } from "vitest";
import { type DomainState, SECONDS_PER_HOUR, TESSEN_HUNT, gameDayOf, isTessenHuntRollFlag, tessenHuntFlag, tessenHuntRollFlag, tessenSquadDue, tessenSquadFlag } from "@seki/core";
import { CLINIC_WAKE_SPOT, SIM_HZ, Simulation, TESSEN_SQUAD_BACK_PREFIX, TESSEN_SQUAD_LATE_SECONDS, ground, tessenHuntStretch, tessenSquadAfterHer, tessenSquadBack, tessenSquadBackFlag } from "../src";
import { GIVE_UP } from "../src/systems/ai/ganger-perception";
import { run, teleportPlayer } from "./helpers";

/*
 * ADR-0082, after the playtest of 17.11: while a squad of Tessen's hunt is after her, she cannot
 * wait. On its way (G-911) to its tick and 20 s past it (round 3), and in the city on its feet; gone back to wait for her where a way leads
 * (G-922) only in the stretch of the day it went back in (round 2 of 17.11); not once the hunt is
 * over, nor once a squad that lost her went home. The `wait` command
 * refuses nothing (ADR-0017): the window asks `tessenSquadAfterHer`, as it asks for a fight.
 */

type Holder = { holder: { domain: DomainState } };
const setDomain = (sim: Simulation, change: (d: DomainState) => DomainState): void => {
  const holder = (sim as unknown as Holder).holder;
  holder.domain = change(holder.domain);
};
const squad = (sim: Simulation) => [...sim.world].filter((e) => e.security && e.enemy?.type === "tessen_guard" && (e.health?.current ?? 0) > 0);
const afterHer = (sim: Simulation) => tessenSquadAfterHer(sim.world, sim.domain, sim.tick);

const STRETCH = TESSEN_HUNT.everyHours * SECONDS_PER_HOUR;
/** The clock moved to `second` s into the next stretch of the day (negative: before its start). */
const toNextStretch = (sim: Simulation, second: number): void =>
  setDomain(sim, (d) => ({ ...d, clock: { ...d.clock, seconds: d.clock.seconds - (d.clock.seconds % STRETCH) + STRETCH + second } }));

/** On the hunt's first day, with Tessen at -60, by the Rynek, with `flags` of the hunt besides. */
const hunted = (seed: number, ...flags: string[]): Simulation => {
  const sim = Simulation.create({ seed });
  const day = gameDayOf(sim.domain.clock);
  setDomain(sim, (d) => ({ ...d, flags: [...d.flags, tessenHuntFlag(day + TESSEN_HUNT.days), ...flags], reputation: { ...d.reputation, tessen: -60 } }));
  teleportPlayer(sim, ground(575, -38), 0);
  return sim;
};

describe("no waiting with Tessen's squad after her (ADR-0082, 17.11)", () => {
  it("the hunt alone, with no squad out, lets her wait", () => {
    expect(afterHer(hunted(3))).toBe(false);
  });

  it("a squad on its way refuses it, until the hunt is over", () => {
    const sim = hunted(3, tessenSquadFlag(TESSEN_HUNT.squadMin, 30 * SIM_HZ));
    expect(afterHer(sim)).toBe(true);
    run(sim, SIM_HZ);
    expect(tessenSquadDue(sim.domain.flags)).not.toBeNull();
    expect(afterHer(sim)).toBe(true);
    // Three days on: the hunt and its flags are gone.
    setDomain(sim, (d) => ({ ...d, clock: { ...d.clock, seconds: (gameDayOf(d.clock) + TESSEN_HUNT.days) * 86_400 + 3600 } }));
    expect(afterHer(sim)).toBe(false);
    run(sim, 2);
    expect(sim.domain.flags.some((f) => f.startsWith("tessen-hunt"))).toBe(false);
    expect(afterHer(sim)).toBe(false);
  });

  it("a squad on its way with no entry where she is (the clinic) refuses it to its tick and 20 s past it, then it is gone and she waits", () => {
    expect(TESSEN_SQUAD_LATE_SECONDS).toBe(TESSEN_HUNT.delayMinSeconds);
    const sim = hunted(3);
    teleportPlayer(sim, CLINIC_WAKE_SPOT, 0);
    const due = sim.tick + 2 * SIM_HZ;
    const flag = tessenSquadFlag(TESSEN_HUNT.squadMin, due);
    setDomain(sim, (d) => ({ ...d, flags: [...d.flags, flag] }));
    const late = due + TESSEN_SQUAD_LATE_SECONDS * SIM_HZ;
    run(sim, late - 1 - sim.tick);
    // No entry 60 m from the clinic: its flag waits, the squad is not in, she is refused.
    expect(sim.domain.flags).toContain(flag);
    expect(squad(sim)).toEqual([]);
    expect(afterHer(sim)).toBe(true);
    run(sim, 1);
    expect(sim.tick).toBe(late);
    expect(afterHer(sim)).toBe(false);
    // Late as that, it is gone on the hunt's next look (G-934): it never comes in long after her warning.
    run(sim, SIM_HZ);
    expect(sim.domain.flags).not.toContain(flag);
    // Still none in a minute and a half on: she keeps her wait.
    run(sim, 90 * SIM_HZ);
    expect(tessenSquadDue(sim.domain.flags)).toBeNull();
    expect(squad(sim)).toEqual([]);
    expect(afterHer(sim)).toBe(false);
  });

  it("a squad gone back to wait for her where a way leads refuses it in the stretch it went back in, not past it (G-922)", () => {
    // The Trybunał's block: no way leads to her from an entry, so the squad goes back at once.
    const sim = hunted(7, tessenSquadFlag(TESSEN_HUNT.squadMin, 0));
    teleportPlayer(sim, ground(608, -5), 0);
    for (let s = 0; s < 10 && !tessenSquadBack(sim.domain.flags); s++) run(sim, SIM_HZ);
    const back = tessenSquadBack(sim.domain.flags);
    expect(back).toMatchObject({ size: TESSEN_HUNT.squadMin, stretch: tessenHuntStretch(sim.domain.clock) });
    // Gone back, it is no roll's: no roll comes while it waits (G-934).
    expect(sim.domain.flags.some(isTessenHuntRollFlag)).toBe(false);
    expect(squad(sim)).toEqual([]);
    expect(tessenSquadDue(sim.domain.flags)).toBeNull();
    expect(afterHer(sim)).toBe(true);
    // To the stretch's last second it refuses; from the next one's first, she waits.
    toNextStretch(sim, -1);
    expect(afterHer(sim)).toBe(true);
    toNextStretch(sim, 0);
    expect(tessenSquadBack(sim.domain.flags)).not.toBeNull();
    expect(afterHer(sim)).toBe(false);
  });

  it("a save of v44 with the squad gone back by its size alone lets her wait; the next roll's squad comes in, with its warning (G-934)", () => {
    const sim = hunted(3, `${TESSEN_SQUAD_BACK_PREFIX}${TESSEN_HUNT.squadMin}`);
    expect(tessenSquadBack(sim.domain.flags)).toMatchObject({ size: TESSEN_HUNT.squadMin, stretch: null });
    expect(afterHer(sim)).toBe(false);
    run(sim, 2 * SIM_HZ);
    expect(tessenSquadBack(sim.domain.flags)).toBeNull();
    const due = tessenSquadDue(sim.domain.flags);
    expect(due).not.toBeNull();
    expect(squad(sim)).toEqual([]);
    run(sim, due!.tick - sim.tick + SIM_HZ);
    expect(squad(sim).length).toBe(due!.size);
  });

  it("the flag of a squad gone back keeps the stretch of the roll", () => {
    const sim = hunted(3);
    expect(tessenSquadBackFlag(3, sim.domain.clock)).toBe(`${TESSEN_SQUAD_BACK_PREFIX}3@${tessenHuntStretch(sim.domain.clock)}`);
    expect(tessenHuntRollFlag("x", sim.domain.clock)).toBe(`tessen-hunt-roll:x@${tessenHuntStretch(sim.domain.clock)}`);
  });

  it("a squad come in refuses it while on its feet; once it lost her and went home, she waits", () => {
    const sim = hunted(3, tessenSquadFlag(TESSEN_HUNT.squadMin, 0));
    run(sim, 2 * SIM_HZ);
    const out = squad(sim);
    expect(out.length).toBe(TESSEN_HUNT.squadMin);
    expect(sim.domain.flags.some((f) => f.startsWith("tessen-hunt-squad:") || f.startsWith(TESSEN_SQUAD_BACK_PREFIX))).toBe(false);
    expect(afterHer(sim)).toBe(true);
    // Crippled where they came in, out of her view, they lose her as any chase does and go home.
    for (const g of out) g.hackFx = { pinged: 0, blind: 0, crippled: 60 };
    run(sim, (GIVE_UP + 4) * SIM_HZ);
    expect(squad(sim)).toEqual([]);
    expect(afterHer(sim)).toBe(false);
  });

  it("knocked out, the squad is not after her", () => {
    const sim = hunted(3, tessenSquadFlag(TESSEN_HUNT.squadMin, 0));
    run(sim, 2 * SIM_HZ);
    for (const g of squad(sim)) g.health = { current: 0, max: g.health!.max };
    run(sim, 2);
    expect(afterHer(sim)).toBe(false);
  });
});
