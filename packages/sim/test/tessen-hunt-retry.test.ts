import { describe, expect, it } from "vitest";
import { type DomainState, type SaveSnapshot, TESSEN_HUNT, gameDayOf, isTessenHuntRollFlag, tessenHuntFlag, tessenSquadDue } from "@seki/core";
import { SIM_HZ, Simulation, TESSEN_HUNT_TRIES, TESSEN_SQUAD_LATE_SECONDS, ground, stateHash, tessenHuntStretch } from "../src";
import { SECURITY_ENTRIES } from "../src/content/devices";
import { deriveRandom } from "../src/rng/derive-random";
import { run, teleportPlayer } from "./helpers";

/*
 * G-937: a squad on its way that found no entry it may come in at by 20 s past its tick is gone
 * (G-934), and so is the roll it came of: the next try of the district's roll in the stretch puts
 * another on its way, with its own warning and its own draw, once an entry is there. The hunt is never
 * a warning alone (the user's decision of 17.11).
 */

type Holder = { holder: { domain: DomainState } };
const setDomain = (sim: Simulation, change: (d: DomainState) => DomainState): void => {
  const holder = (sim as unknown as Holder).holder;
  holder.domain = change(holder.domain);
};
const squad = (sim: Simulation) => [...sim.world].filter((e) => e.security && e.enemy?.type === "tessen_guard" && (e.health?.current ?? 0) > 0);

/** At (140; -140) the first of the entries is the only one 45-140 m off her and 60 m off the clinic. */
const SPOT = ground(140, -140);
const ENTRY = SECURITY_ENTRIES[0]!;
/** Facing it, it is in her view: the squad may not come in there. */
const FACING = Math.atan2(ENTRY.x - SPOT.x, ENTRY.z - SPOT.z);
const AWAY = FACING + Math.PI;

const hunted = (seed: number): Simulation => {
  const sim = Simulation.create({ seed });
  const day = gameDayOf(sim.domain.clock);
  setDomain(sim, (d) => ({ ...d, flags: [...d.flags, tessenHuntFlag(day + TESSEN_HUNT.days)], reputation: { ...d.reputation, tessen: -60 } }));
  return sim;
};

/** Warned with her back to the entry, then facing it to 25 s past the squad's tick: it is gone. */
const leftOnce = (seed: number) => {
  const sim = hunted(seed);
  teleportPlayer(sim, SPOT, AWAY);
  run(sim, 2 * SIM_HZ);
  const first = tessenSquadDue(sim.domain.flags);
  expect(first).not.toBeNull();
  teleportPlayer(sim, SPOT, FACING);
  run(sim, first!.tick + 25 * SIM_HZ - sim.tick);
  expect(tessenSquadDue(sim.domain.flags)).toBeNull();
  expect(squad(sim)).toEqual([]);
  return { sim, first: first! };
};

/** Seconds from now to the first one the squad is in (once a second); null if it is not in `limit` s. */
const cameIn = (sim: Simulation, limit: number): number | null => {
  for (let s = 1; s <= limit; s++) {
    run(sim, SIM_HZ);
    if (squad(sim).length > 0) return s;
  }
  return null;
};

describe("a roll whose squad found no entry is tried again in its stretch (G-937)", () => {
  it.each([3, 8])("seed %i: the only entry in her view past the squad's tick, she is warned again and the next squad comes in, in the same stretch", (seed) => {
    const { sim, first } = leftOnce(seed);
    const stretch = tessenHuntStretch(sim.domain.clock);
    teleportPlayer(sim, SPOT, AWAY);
    run(sim, SIM_HZ);
    const second = tessenSquadDue(sim.domain.flags);
    expect(second).not.toBeNull();
    expect(second!.flag).not.toBe(first.flag);
    expect(second!.tick - sim.tick).toBeGreaterThanOrEqual((TESSEN_HUNT.delayMinSeconds - 1) * SIM_HZ);
    const came = cameIn(sim, TESSEN_HUNT.delayMaxSeconds + 2);
    expect(came).not.toBeNull();
    expect(came!).toBeGreaterThanOrEqual(TESSEN_HUNT.delayMinSeconds - 2);
    expect(squad(sim).length).toBe(second!.size);
    expect(tessenHuntStretch(sim.domain.clock)).toBe(stretch);
  });

  it("the next try draws afresh: its flag is the roll's with the try, a draw of its own", () => {
    const { sim } = leftOnce(3);
    teleportPlayer(sim, SPOT, AWAY);
    run(sim, SIM_HZ);
    const rolls = sim.domain.flags.filter(isTessenHuntRollFlag);
    expect(rolls).toEqual([expect.stringMatching(/#1$/)]);
    const key = rolls[0]!.slice(0, -2);
    expect(deriveRandom(sim.seed, rolls[0]!).next()).not.toBe(deriveRandom(sim.seed, key).next());
  });

  it("each try left as she looks at the only entry once one is on its way: three warnings in the stretch, then none to its end", () => {
    // Seed 28: the three tries' warnings are of 22, 23 and 22 s, so they all take 130 s.
    const sim = hunted(28);
    const stretch = tessenHuntStretch(sim.domain.clock);
    const warned = new Set<string>();
    for (let s = 0; s < 3 * (TESSEN_HUNT.delayMaxSeconds + TESSEN_SQUAD_LATE_SECONDS + 2); s++) {
      const due = tessenSquadDue(sim.domain.flags);
      if (due) warned.add(due.flag);
      else if (warned.size === TESSEN_HUNT_TRIES) break;
      // Her back to it until one is on its way, then facing it to its end.
      teleportPlayer(sim, SPOT, due ? FACING : AWAY);
      run(sim, SIM_HZ);
    }
    expect(warned.size).toBe(TESSEN_HUNT_TRIES);
    expect(squad(sim)).toEqual([]);
    // Her back to it, a squad might come in: no try is left in the stretch.
    teleportPlayer(sim, SPOT, AWAY);
    run(sim, 3 * SIM_HZ);
    expect(tessenSquadDue(sim.domain.flags)).toBeNull();
    expect(tessenHuntStretch(sim.domain.clock)).toBe(stretch);
  });

  it("a save between the tries, and one on the next try's way, load to the same state", () => {
    const { sim } = leftOnce(3);
    const load = (s: Simulation) => Simulation.fromSnapshot(JSON.parse(JSON.stringify(s.snapshot(null, "t", ""))) as SaveSnapshot);
    const between = load(sim);
    teleportPlayer(sim, SPOT, AWAY);
    teleportPlayer(between, SPOT, AWAY);
    run(sim, 2 * SIM_HZ);
    run(between, 2 * SIM_HZ);
    expect(tessenSquadDue(sim.domain.flags)).not.toBeNull();
    const onWay = load(sim);
    for (const s of [sim, between, onWay]) run(s, (TESSEN_HUNT.delayMaxSeconds + 2) * SIM_HZ);
    expect(squad(sim).length).toBeGreaterThan(0);
    const hash = stateHash(sim.snapshot(null, "t", ""));
    expect(stateHash(between.snapshot(null, "t", ""))).toBe(hash);
    expect(stateHash(onWay.snapshot(null, "t", ""))).toBe(hash);
  });
});
