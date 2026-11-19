import { describe, expect, it } from "vitest";
import { type DomainEvents, SECONDS_PER_HOUR, STREET_CRIME_SLOT_HOURS, streetCrimesAt } from "@seki/core";
import { SIM_HZ, Simulation, crimeBoard, ground } from "../src";
import { collect, run, teleportPlayer } from "./helpers";

/*
 * G-938: a mugging by Brama Krakowska, the Rynek's Hebi patrol a dozen metres off. The muggers
 * fire at their victim; their shots must not set the gang on the player, who has done nothing.
 * Once she fights them, their shots call the gang as before.
 */

/** The first board of seed 13 with a mugging at the spot by the gate (528; −58). */
const SLOT = (() => {
  for (let slot = 0; ; slot++) if (crimeBoard(13, slot).some((c) => c.kind === "mugging" && Math.hypot(c.at.x - 528, c.at.z + 58) < 3)) return slot;
})();

const scene = () => {
  const snap = Simulation.create({ seed: 13 }).snapshot(null, "t", "");
  const clock = { seconds: SLOT * STREET_CRIME_SLOT_HOURS * SECONDS_PER_HOUR + 60 };
  const done = crimeBoard(13, SLOT)
    .filter((c) => !(c.kind === "mugging" && Math.hypot(c.at.x - 528, c.at.z + 58) < 3))
    .map((c) => c.id);
  const sim = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, flags: ["met_fixer"], clock, streetCrimes: { ...streetCrimesAt(clock), done } } });
  run(sim, 1);
  const provoked = collect<DomainEvents["TerritoryProvoked"]>(sim, "TerritoryProvoked");
  const shots = collect<DomainEvents["ShotFired"]>(sim, "ShotFired");
  // In Brama Krakowska, 37 m off the spot: the mugging starts.
  teleportPlayer(sim, ground(497, -79));
  sim.step();
  expect(sim.session.street2.micro?.kind).toBe("mugging");
  return { sim, provoked, shots };
};

describe("the muggers' shots at their victim (G-938)", () => {
  it("leave the Rynek's patrol calm and the gang unprovoked while the player only watches", () => {
    const { sim, provoked, shots } = scene();
    run(sim, 3 * SIM_HZ);
    const muggers = sim.session.street2.micro?.attackers ?? [];
    expect(shots.filter((s) => muggers.includes(s.shooterId)).length).toBeGreaterThan(0);
    expect(provoked).toEqual([]);
    const patrol = sim.world.with("ai").entities.filter((g) => g.ai.territory === "rynek");
    expect(patrol.length).toBeGreaterThan(0);
    expect(patrol.filter((g) => g.ai.alerted).map((g) => g.key)).toEqual([]);
    expect(shots.filter((s) => !muggers.includes(s.shooterId))).toEqual([]);
  });

  it("call the gang once she fights them: an alerted mugger's shot alerts its own as before", () => {
    const { sim, provoked } = scene();
    const muggers = sim.session.street2.micro!.attackers;
    for (const e of sim.world.with("ai").entities) if (muggers.includes(e.id)) e.ai.alerted = true;
    run(sim, 3 * SIM_HZ);
    expect(provoked.map((p) => p.cause)).toContain("alarm");
  });
});
