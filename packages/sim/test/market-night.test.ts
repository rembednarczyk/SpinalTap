import { describe, expect, it } from "vitest";
import { type ReputationState, hm } from "@seki/core";
import { SCHEDULES, SIM_HZ, Simulation, spotNear } from "../src";
import { byKey, run, teleportPlayer } from "./helpers";

/*
 * G-358: at 23:00 the north market's vendors keep to their stalls with the player beside Fumiko's,
 * with no shot or fight: none of them is scared off (the report came from a session probe, on
 * each standing from −100 to +50). A street hostile to the player (−60 and lower, ADR-0070)
 * runs from it by design, so the standings here are the neutral and the liked ones.
 */

const VENDORS = ["fumiko", "kenta", "goro"] as const;

const simWith = (reputation: Partial<ReputationState>): Simulation => {
  const snap = Simulation.create({ seed: 7 }).snapshot(null, "test", "");
  return Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, reputation: { ...snap.domain.reputation, ...reputation } } });
};

/** Skips time to the given minute of the day, in one step. */
const skipTo = (sim: Simulation, minute: number) => {
  const now = Math.floor((sim.clock.seconds % 86400) / 60);
  const minutes = (minute - now + 1440) % 1440;
  if (minutes > 0) sim.enqueue({ type: "wait", minutes });
  sim.step();
};

describe("G-358: the north market at 23:00", () => {
  it.each([{ civilians: 0 }, { civilians: 50 }])("with standing %o no vendor runs from the player at the stall", (reputation) => {
    const sim = simWith(reputation);
    const stall = SCHEDULES.fumiko!.stops.find((s) => s.label === "stragan")!.path.at(-1)!;
    teleportPlayer(sim, spotNear(stall.x + 1.5, stall.z + 0.5), 0);
    run(sim, SIM_HZ);
    // The second night, as in the report: the first one passes in a skip of the clock.
    skipTo(sim, hm(22, 59));
    skipTo(sim, hm(22, 59));
    run(sim, SIM_HZ);
    const vendors = VENDORS.map((key) => byKey(sim, key));
    vendors.forEach((v, i) => expect(v, VENDORS[i]).toBeDefined());
    // Two minutes round 23:00, every step.
    const scared: string[] = [];
    for (let i = 0; i < 2 * 60 * SIM_HZ; i++) {
      sim.step();
      vendors.forEach((v, n) => {
        const state = v!.civilian?.crowd?.state ?? "calm";
        if (state !== "calm") scared.push(`${VENDORS[n]} ${state} at step ${i}`);
      });
    }
    expect(scared).toEqual([]);
    // At their stalls, busy with their work.
    vendors.forEach((v, i) => expect(v!.activity, VENDORS[i]).toBeDefined());
  });
});
