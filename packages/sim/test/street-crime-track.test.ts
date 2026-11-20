import { describe, expect, it } from "vitest";
import { SECONDS_PER_HOUR, STREET_CRIME_SLOT_HOURS, bandLevel, streetCrimePay, streetCrimesAt } from "@seki/core";
import { DISTRICT_BANDS, Simulation, boardOpen, crimeReward } from "../src";
import { run } from "./helpers";

/*
 * Following a crime of the board on the map (ADR-0091 stage 6): one at a time, only one of the open
 * board, and one target on the HUD: following a crime lets go of the journal's pin, pinning an entry
 * lets go of the crime. The board the map shows is the one the simulation runs.
 */

/** After Kaito's first word, at 13:00. */
const street = (seed = 6): Simulation => {
  const snap = Simulation.create({ seed }).snapshot(null, "t", "");
  const clock = { seconds: 13 * SECONDS_PER_HOUR };
  const domain = { ...snap.domain, flags: ["met_fixer"], clock, streetCrimes: streetCrimesAt(clock) };
  const sim = Simulation.fromSnapshot({ ...snap, domain });
  run(sim, 1);
  return sim;
};

describe("following a street crime (ADR-0091 stage 6)", () => {
  it("shows the simulation's own open board, with what foiling each pays now", () => {
    const sim = street();
    const board = boardOpen(sim.seed, sim.domain);
    expect(board.length).toBeGreaterThan(0);
    for (const c of board) {
      const level = bandLevel(sim.domain.progression.level, DISTRICT_BANDS[c.district]);
      expect(crimeReward(sim.domain, c)).toBe(streetCrimePay(c.kind, level, sim.domain.streetCrimes.paidToday, sim.domain.reputation.tessen));
      expect(crimeReward(sim.domain, c)).toBeGreaterThan(0);
    }
  });

  it("follows one crime of the open board, and lets go of it on null", () => {
    const sim = street();
    const [a, b] = boardOpen(sim.seed, sim.domain);
    sim.enqueue({ type: "track-street-crime", id: a!.id });
    run(sim, 1);
    expect(sim.domain.streetCrimes.tracked).toBe(a!.id);
    sim.enqueue({ type: "track-street-crime", id: b!.id });
    run(sim, 1);
    expect(sim.domain.streetCrimes.tracked).toBe(b!.id);
    sim.enqueue({ type: "track-street-crime", id: null });
    run(sim, 1);
    expect(sim.domain.streetCrimes.tracked).toBeNull();
  });

  it("refuses a crime not on the open board", () => {
    const sim = street();
    sim.enqueue({ type: "track-street-crime", id: "crime:0:nowhere:9" });
    run(sim, 1);
    expect(sim.domain.streetCrimes.tracked).toBeNull();
  });

  it("keeps one target on the HUD: a crime lets go of the pin, a pin of the crime", () => {
    const sim = street();
    const crime = boardOpen(sim.seed, sim.domain)[0]!;
    sim.enqueue({ type: "track-quest", questId: "m0" });
    run(sim, 1);
    expect(sim.domain.preferences.trackedQuest).toBe("m0");
    sim.enqueue({ type: "track-street-crime", id: crime.id });
    run(sim, 1);
    expect(sim.domain.streetCrimes.tracked).toBe(crime.id);
    expect(sim.domain.preferences.trackedQuest).toBeUndefined();
    sim.enqueue({ type: "track-quest", questId: "m0" });
    run(sim, 1);
    expect(sim.domain.preferences.trackedQuest).toBe("m0");
    expect(sim.domain.streetCrimes.tracked).toBeNull();
  });

  it("lets go of the crime with its board", () => {
    const sim = street();
    const crime = boardOpen(sim.seed, sim.domain)[0]!;
    sim.enqueue({ type: "track-street-crime", id: crime.id });
    run(sim, 1);
    sim.enqueue({ type: "wait", minutes: STREET_CRIME_SLOT_HOURS * 60 });
    run(sim, 2);
    expect(sim.domain.streetCrimes.tracked).toBeNull();
  });
});
