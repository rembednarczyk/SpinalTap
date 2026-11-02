import { describe, expect, it } from "vitest";
import type { DomainEvents } from "@seki/core";
import { SIM_HZ } from "../src";
import { collect, run } from "./helpers";
import { CROUCH, offset, quietStreet, stallholder, takeDown, victim } from "./takedown-scenes";

/**
 * Two witnesses of one takedown, the save in the middle of their calls (G-240): the save settles
 * one report, as the street without a save gets, drops the second witness's call and marks the
 * body reported, so no second report follows.
 */
const scene = (seed: number) => {
  const sim = quietStreet(seed);
  victim(sim);
  stallholder(sim, 4300, offset(sim, -2, 0));
  stallholder(sim, 4301, offset(sim, 2, 0));
  const reports = collect<DomainEvents["CrimeReported"]>(sim, "CrimeReported");
  takeDown(sim);
  return { sim, reports };
};

describe("a save during two witnesses' calls (G-240)", () => {
  for (const seed of [7, 11]) {
    it(`settles one report, marks the body and lets no second one follow (seed ${seed})`, () => {
      const plain = scene(seed);
      run(plain.sim, 40 * SIM_HZ, CROUCH);

      const saved = scene(seed);
      saved.sim.calmForSave();
      expect(saved.reports.length).toBe(1);
      const body = [...saved.sim.world.with("downed")][0]!;
      expect(body.downed.reported).toBe(true);
      run(saved.sim, 40 * SIM_HZ, CROUCH);
      expect(saved.reports.length).toBe(plain.reports.length);
      expect(saved.sim.domain.heat.level).toBe(plain.sim.domain.heat.level);
    });
  }
});
