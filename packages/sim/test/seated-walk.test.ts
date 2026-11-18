import { describe, expect, it } from "vitest";
import type { ActivityId } from "@seki/core";
import { ACTIVITY_STILL_SPEED, SCHEDULES, SIM_HZ, Simulation, spotNear } from "../src";
import { byKey, run, teleportPlayer } from "./helpers";

/*
 * G-732: a figure never walks while seated. From a seated stop of its daily plan to the next
 * one it sits until it gets up and walks with no activity, and back at a seat it sits once it
 * stands still there. The renderer keeps the seated pose (the dropped hips, the bent legs) only
 * while the simulation says it sits.
 */

const SEATED: readonly ActivityId[] = ["sit", "sleep"];

/** Skips time to the given minute of the day, in one step. */
const skipTo = (sim: Simulation, minute: number) => {
  const now = Math.floor((sim.clock.seconds % 86400) / 60);
  const minutes = (minute - now + 1440) % 1440;
  if (minutes > 0) sim.enqueue({ type: "wait", minutes });
  sim.step();
};

const seatedLegs = Object.entries(SCHEDULES).flatMap(([key, def]) =>
  def.stops.flatMap((stop, i) => {
    const plan = stop.activity;
    const seated = typeof plan === "string" ? SEATED.includes(plan) : (plan?.cycle.some((a) => SEATED.includes(a)) ?? false);
    if (!seated) return [];
    const next = def.stops[(i + 1) % def.stops.length]!;
    // Leaving the seat and coming back to it, a few minutes before each (a game minute is a second).
    const seat = stop.path[stop.path.length - 1]!;
    return [
      { key, label: `${stop.label} → ${next.label}`, at: next.at, seat, arriving: false },
      { key, label: `→ ${stop.label}`, at: stop.at, seat, arriving: true },
    ];
  }),
);

describe("G-732: nobody walks seated", () => {
  it("has seated stops to check", () => {
    expect(seatedLegs.length).toBeGreaterThanOrEqual(4);
  });

  it.each(seatedLegs)("$key, $label: seated only while standing still", ({ key, at, seat, arriving }) => {
    const sim = Simulation.create({ seed: 7 });
    // By the seat, so its chunk is loaded with the figure in it.
    teleportPlayer(sim, spotNear(seat.x + 3, seat.z + 3), 0);
    run(sim, SIM_HZ);
    skipTo(sim, (at - 3 + 1440) % 1440);
    run(sim, SIM_HZ);
    const npc = byKey(sim, key);
    expect(npc, key).toBeDefined();
    // Coming back from far off (Hideo from the Rynek), the clock goes on a minute at a time until it is a short walk away.
    for (let m = 0; m < 30 && arriving && Math.hypot(npc!.position.x - seat.x, npc!.position.z - seat.z) > 20; m++) {
      sim.enqueue({ type: "wait", minutes: 1 });
      sim.step();
    }
    let seatedSteps = 0;
    let walkedSeated = 0;
    let walked = 0;
    for (let i = 0; i < 8 * 60 * SIM_HZ; i++) {
      const before = { ...npc!.position };
      sim.step();
      const speed = Math.hypot(npc!.position.x - before.x, npc!.position.z - before.z) * SIM_HZ;
      if (speed > 0.6) walked++;
      const seated = npc!.activity !== undefined && SEATED.includes(npc!.activity);
      if (seated) seatedSteps++;
      if (seated && speed > ACTIVITY_STILL_SPEED + 0.05) walkedSeated++;
      // Both seen for a second, so the switch between them too (seated then walking, or the other way).
      if (seatedSteps > SIM_HZ && walked > SIM_HZ) break;
    }
    // It walked one way or the other, sat somewhere along it, and never both at once.
    expect(walked, "walked").toBeGreaterThan(SIM_HZ);
    expect(seatedSteps, "sat").toBeGreaterThan(0);
    expect(walkedSeated, "steps walking seated").toBe(0);
  });
});
