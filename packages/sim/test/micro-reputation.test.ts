import { describe, expect, it } from "vitest";
import { MICRO_EVENT_REWARD, SECONDS_PER_HOUR, STREET_CRIME_SLOT_HOURS, type SaveSnapshot, bandLevel, streetCrimePay, streetCrimesAt } from "@seki/core";
import { type BoardCrime, DISTRICT_BANDS, Simulation, crimeBoard, ground } from "../src";
import { collect, input, run, teleportPlayer } from "./helpers";
import { enterKanal } from "./micro-scenes";

/**
 * ADR-0070, stage 5, on the street's board (ADR-0091 stage 5b): while the street thinks badly of
 * the player (civilians below −10) every district's board holds two crimes, not one or two; its
 * first crime is the same either way. An aid and a mugging thank her with +3.
 */

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;

/** The first board of seed 13 whose Old Town holds one crime as rolled: its second comes only with the distrust. */
const SPARE = (() => {
  for (let slot = 0; ; slot++) {
    const kanal = (distrusted: boolean) => crimeBoard(13, slot, distrusted).filter((c) => c.district === "kanal");
    if (kanal(false).length === 1) return { slot, first: kanal(false)[0]!, second: kanal(true)[1]! };
  }
})();

/** On the board of `SPARE` with the civilians at `civilians` (a save's round trip on `reload`). */
const onSpare = (civilians: number, reload = false): Simulation => {
  const snap = Simulation.create({ seed: 13 }).snapshot(null, "t", "");
  const clock = { seconds: SPARE.slot * STREET_CRIME_SLOT_HOURS * SECONDS_PER_HOUR + 60 };
  const reputation = { ...snap.domain.reputation, civilians };
  const streetCrimes = { ...streetCrimesAt(clock), done: [SPARE.first.id] };
  const sim = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, reputation, flags: ["met_fixer"], clock, streetCrimes } });
  run(sim, 1);
  return reload ? Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", ""))) : sim;
};

/** The crimes started once the player comes 30 m south of `c`. */
const near = (sim: Simulation, c: BoardCrime): string[] => {
  const started = collect<{ encounterId: string }>(sim, "EncounterStarted");
  teleportPlayer(sim, ground(c.at.x, c.at.z - 30));
  run(sim, 2);
  return started.map((e) => e.encounterId);
};

describe("the street's crimes while it thinks badly of the player (ADR-0070, ADR-0091 stage 5b)", () => {
  it("holds two crimes in every district below −10, the first one the same", () => {
    for (let slot = 0; slot < 24; slot++) {
      const even = crimeBoard(13, slot);
      const low = crimeBoard(13, slot, true);
      for (const d of ["shinsekai-7", "kanal", "targ", "doki"]) {
        expect(low.filter((c) => c.district === d)).toHaveLength(2);
        expect(low.find((c) => c.district === d)).toEqual(even.find((c) => c.district === d));
      }
    }
    expect(SPARE.second.id).toMatch(/:kanal:1$/);
  });

  it.each([-11, -30, -60])("starts the spare crime of the Old Town at %i", (civilians) => {
    expect(near(onSpare(civilians), SPARE.second)).toEqual([expect.stringMatching(new RegExp(`^micro:${SPARE.second.kind}:`))]);
  });

  it.each([-10, 0, 30])("has no spare crime at %i", (civilians) => {
    expect(near(onSpare(civilians), SPARE.second)).toEqual([]);
  });

  it("takes the standing from the save: saved and loaded at −30, the spare crime starts", () => {
    expect(near(onSpare(-30, true), SPARE.second)).toHaveLength(1);
  });

  it("an aid thanks with +3 and its pay", () => {
    const { sim, ended, crime } = enterKanal("aid", 13, -30);
    const victim = [...sim.world].find((e) => e.id === sim.session.street2.micro!.victim)!;
    teleportPlayer(sim, { x: victim.position.x + 1, y: victim.position.y, z: victim.position.z });
    run(sim, 1);
    const [eddies, civ] = [sim.domain.wallet.eddies, sim.domain.reputation.civilians];
    const pay = streetCrimePay("aid", bandLevel(sim.domain.progression.level, DISTRICT_BANDS[crime.district]), 0, sim.domain.reputation.tessen);
    sim.step(input({ interact: true }));
    expect(ended.map((e) => e.outcome)).toEqual(["helped"]);
    expect([sim.domain.wallet.eddies - eddies, sim.domain.reputation.civilians - civ]).toEqual([pay, 3]);
  });

  it("a mugging beaten in a fight at −30: +3 from the street, the muggers do not count on their own", () => {
    const { sim, ended } = enterKanal("mugging", 13, -30);
    const run0 = sim.session.street2.micro!;
    const player = sim.player()!.id;
    const civ = sim.domain.reputation.civilians;
    for (const e of [...sim.world]) {
      if (!run0.attackers.includes(e.id)) continue;
      e.ai!.alerted = true;
      e.lastHitBy = player;
      e.health = { current: 0, max: e.health!.max };
    }
    run(sim, 2);
    expect(ended.map((e) => e.outcome)).toEqual(["won"]);
    expect(sim.domain.reputation.civilians - civ).toBe(MICRO_EVENT_REWARD.mugging.civilians);
  });
});
