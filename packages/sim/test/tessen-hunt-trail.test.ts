import { describe, expect, it } from "vitest";
import { type DomainState, HEAT_SEARCH_SECONDS, NO_HEAT, TESSEN_HUNT, gameDayOf, tessenHuntFlag, tessenSquadDue, tessenSquadFlag } from "@seki/core";
import { SIM_HZ, Simulation, ground } from "../src";
import { GIVE_UP } from "../src/systems/ai/ganger-perception";
import type { Entity } from "../src/world/components";
import { run, teleportPlayer } from "./helpers";

/*
 * G-922: Tessen's squad (ADR-0082 §3.7) came in 45-140 m from Seki on her trail and lost her
 * before it got there: a chase gives up a lead it has not reached in 20 s, some 60 m on, and from
 * an entry off the window its way is planned in, on another floor, in a closed cell or cut off, it
 * found no way and stood there. Now it walks the trail to where she stands, from near and far
 * entries alike, and stands at no entry it has no way to her from. The seed of each case only
 * draws the world; the place is what differs.
 */

type Holder = { holder: { domain: DomainState } };
const setDomain = (sim: Simulation, change: (d: DomainState) => DomainState): void => {
  const holder = (sim as unknown as Holder).holder;
  holder.domain = change(holder.domain);
};
const squad = (sim: Simulation) => [...sim.world].filter((e) => e.security && e.enemy?.type === "tessen_guard" && (e.health?.current ?? 0) > 0);
const apart = (a: Entity, b: Entity) => Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);

/** On the hunt's first day, with Tessen at -60, standing at `at`, a squad of `size` due at once (its 20-40 s on the way are G-911's). */
const hunted = (seed: number, at: { x: number; z: number }, size: number): Simulation => {
  const sim = Simulation.create({ seed });
  const day = gameDayOf(sim.domain.clock);
  const flags = [tessenHuntFlag(day + TESSEN_HUNT.days), tessenSquadFlag(size, 0)];
  setDomain(sim, (d) => ({ ...d, flags: [...d.flags, ...flags], reputation: { ...d.reputation, tessen: -60 } }));
  teleportPlayer(sim, ground(at.x, at.z), 0);
  return sim;
};

/** Seconds the squad takes from coming in until one of them has her in sight, and how far off it came in; null when it never does. */
const contact = (sim: Simulation, limit: number): { entry: number; seconds: number } | null => {
  let came = -1;
  let entry = 0;
  for (let s = 0; s < limit; s++) {
    run(sim, SIM_HZ);
    const out = squad(sim);
    const me = sim.player()!;
    if (came < 0 && out.length > 0) [came, entry] = [s, Math.min(...out.map((g) => apart(g, me)))];
    if (came >= 0 && out.length === 0) return null;
    if (out.some((g) => g.ai?.sees)) return { entry, seconds: s - came };
  }
  return null;
};

describe("Tessen's hunt walks her trail (G-922)", () => {
  // Krakowskie Przedmieście, Stare Miasto, Podzamcze and the deptak's west end: entries some 50 to 125 m off.
  const SPOTS = [
    { x: 520, z: -60 },
    { x: 700, z: 300 },
    { x: 575, z: -38 },
    { x: 300, z: -84 },
    { x: 240, z: -66 },
  ];

  it.each([1, 2, 3, 4, 5])("seed %i: a squad of 2-3 comes in 45-140 m off and finds her standing where she was", (seed) => {
    const at = SPOTS[seed - 1]!;
    const met = contact(hunted(seed, at, TESSEN_HUNT.squadMin + (seed % 2)), 70);
    expect(met, `at ${at.x},${at.z}`).not.toBeNull();
    expect(met!.entry).toBeGreaterThan(TESSEN_HUNT.minDistance - 5);
    expect(met!.entry).toBeLessThan(140);
    // At a walk of 3.1 m/s, with the way round the blocks.
    expect(met!.seconds).toBeLessThan(met!.entry / 2);
  });

  it("no squad comes in at an entry it has no way to her from; it comes once she is where it has one", () => {
    // The east end of the deptak: the nearest entry beyond 45 m is on Stare Miasto, 120 m off past the gate.
    const sim = hunted(1, { x: 450, z: -96 }, TESSEN_HUNT.squadMax);
    run(sim, 5 * SIM_HZ);
    expect(squad(sim)).toEqual([]);
    teleportPlayer(sim, ground(520, -60), 0);
    expect(contact(sim, 40)).not.toBeNull();
  });

  it("from an entry its made way does not lead from (Grodzka's, in a closed cell) it comes in at the next one that does", () => {
    // By the Rynek: the nearest entry, 46 m off, stands in a wall's clearance; the next is Bramowa's, 94 m off.
    const sim = hunted(7, { x: 568, z: -42 }, TESSEN_HUNT.squadMin);
    const met = contact(sim, 60);
    expect(met).not.toBeNull();
    expect(met!.seconds).toBeLessThan(40);
  });

  it("where no way leads to her, no squad stands at its entry: it goes back at once and is due again", () => {
    // Spots no field reaches (the Trybunał's block; the foot of the castle hill under its terrace).
    for (const at of [{ x: 608, z: -5 }, { x: 708, z: 128 }]) {
      const sim = hunted(7, at, TESSEN_HUNT.squadMin);
      let out = 0;
      let longest = 0;
      for (let s = 0; s < 30; s++) {
        run(sim, SIM_HZ);
        out = squad(sim).length > 0 ? out + 1 : 0;
        longest = Math.max(longest, out);
      }
      expect(longest, `at ${at.x},${at.z}`).toBeGreaterThan(0);
      expect(longest, `at ${at.x},${at.z}`).toBeLessThanOrEqual(3);
      expect(tessenSquadDue(sim.domain.flags), `at ${at.x},${at.z}`).not.toBeNull();
    }
  });

  it("one stopped in its tracks loses her as any chase does; the rest keep the trail", () => {
    const sim = hunted(3, { x: 575, z: -38 }, TESSEN_HUNT.squadMax);
    run(sim, 3 * SIM_HZ);
    const [stopped, ...rest] = squad(sim).sort((a, b) => a.security!.n - b.security!.n);
    // Crippled (ADR-0029): it turns and shoots, but does not walk.
    stopped!.hackFx = { pinged: 0, blind: 0, crippled: 60 };
    run(sim, (GIVE_UP + 2) * SIM_HZ);
    expect(stopped!.ai?.alerted).toBe(false);
    expect(rest.length).toBeGreaterThan(0);
    for (const g of rest) expect(g.ai?.alerted).toBe(true);
  });

  it("while Tessen's heat is up its reinforcements are the heat's: the squad keeps no trail of the hunt's", () => {
    const sim = hunted(3, { x: 575, z: -38 }, TESSEN_HUNT.squadMin);
    run(sim, 2 * SIM_HZ);
    // The hunt's squad, not the heat's own reinforcements coming in after it.
    const out = squad(sim);
    expect(out.length).toBe(TESSEN_HUNT.squadMin);
    setDomain(sim, (d) => ({ ...d, heat: { ...NO_HEAT, level: 1, faction: "tessen", searchLeft: HEAT_SEARCH_SECONDS[1] } }));
    run(sim, 12 * SIM_HZ);
    for (const g of out) expect(g.ai?.lost ?? 0).toBeGreaterThan(10);
  });
});
