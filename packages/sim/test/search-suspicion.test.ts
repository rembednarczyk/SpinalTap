import { describe, expect, it } from "vitest";
import { TRACK_GRACE } from "../src/systems/ai/ganger-perception";
import { teleportPlayer } from "./helpers";
import { offset, quietStreet, victim } from "./takedown-scenes";

/*
 * G-295: a guard that gave up the chase searches (ADR-0029) with its suspicion meter where the
 * HUD has it (half full), not left full from the alarm: seeing the player again in its first
 * seconds of searching fills the meter first, it does not raise the alarm in one step.
 */

describe("G-295: the suspicion after an alarm", () => {
  it("the search starts half full, and a glimpse in its first step does not alert at once", () => {
    const sim = quietStreet(7);
    const g = victim(sim);
    const here = { ...g.position };
    // The player far off, out of its sight.
    teleportPlayer(sim, offset(sim, 0, -80), 0);
    // Alerted, full meter, the chase run out where it stands: this step it gives up and searches.
    g.ai = { ...g.ai!, alerted: true, suspicion: 1, lastKnown: here, lost: TRACK_GRACE + 0.5 };
    sim.step();
    expect(g.ai!.alerted).toBe(false);
    expect(g.ai!.search ?? 0).toBeGreaterThan(0);
    expect(g.ai!.suspicion ?? 0).toBeLessThanOrEqual(0.5);
    // She steps into view 8 m ahead of it, standing: one step is not enough.
    const yaw = g.yaw;
    teleportPlayer(sim, { x: g.position.x + Math.sin(yaw) * 8, y: g.position.y, z: g.position.z + Math.cos(yaw) * 8 }, yaw + Math.PI);
    sim.step();
    expect(g.ai!.alerted).toBe(false);
    expect(g.ai!.suspicion ?? 0).toBeGreaterThan(0.5);
  });
});
