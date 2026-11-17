import { describe, expect, it } from "vitest";
import { type DomainState, TESSEN_HUNT, gameDayOf, tessenHuntFlag, tessenSquadDue, tessenSquadFlag } from "@seki/core";
import { SIM_HZ, Simulation, TESSEN_SQUAD_BACK_PREFIX, ground, tessenSquadAfterHer } from "../src";
import { GIVE_UP } from "../src/systems/ai/ganger-perception";
import { run, teleportPlayer } from "./helpers";

/*
 * ADR-0082, after the playtest of 17.11: while a squad of Tessen's hunt is after her, she cannot
 * wait. On its way (G-911), gone back to wait for her where a way leads (G-922) and in the city on
 * its feet; not once the hunt is over, nor once a squad that lost her went home. The `wait` command
 * refuses nothing (ADR-0017): the window asks `tessenSquadAfterHer`, as it asks for a fight.
 */

type Holder = { holder: { domain: DomainState } };
const setDomain = (sim: Simulation, change: (d: DomainState) => DomainState): void => {
  const holder = (sim as unknown as Holder).holder;
  holder.domain = change(holder.domain);
};
const squad = (sim: Simulation) => [...sim.world].filter((e) => e.security && e.enemy?.type === "tessen_guard" && (e.health?.current ?? 0) > 0);
const afterHer = (sim: Simulation) => tessenSquadAfterHer(sim.world, sim.domain);

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

  it("a squad gone back to wait for her where a way leads refuses it (G-922)", () => {
    const sim = hunted(5, `${TESSEN_SQUAD_BACK_PREFIX}${TESSEN_HUNT.squadMin}`);
    expect(tessenSquadDue(sim.domain.flags)).toBeNull();
    expect(afterHer(sim)).toBe(true);
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
