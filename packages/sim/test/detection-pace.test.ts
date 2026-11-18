import { describe, expect, it } from "vitest";
import { SIM_HZ, type Simulation, type Entity } from "../src";
import { input, teleportPlayer } from "./helpers";
import { quietStreet, victim } from "./takedown-scenes";

/*
 * ADR-0069 after the 17.11 audit, as in Cyberpunk 2077: a guard's meter fills over seconds, not
 * in a blink. A Tessen guard (the slowest eyes) facing the player alerts in some 2 s with her a
 * few metres off standing, in some 4 s at the far end of its sight, and a crouching player fills
 * it half as fast. Light and the hour play no part.
 */

/** Seconds until the guard is alerted with the player `d` m straight ahead of it, standing or crouching. */
const secondsToAlert = (d: number, crouch: boolean): number => {
  const sim: Simulation = quietStreet(7);
  const g: Entity = victim(sim);
  const p = sim.player()!;
  p.posture = { ...p.posture!, crouched: crouch, amount: crouch ? 1 : 0, prevAmount: crouch ? 1 : 0 };
  // The guard faces the player, who stands `d` m in front of it, still.
  teleportPlayer(sim, { x: g.position.x, y: g.position.y, z: g.position.z + d }, Math.PI);
  g.yaw = g.prevYaw = 0;
  for (let i = 0; i < 10 * SIM_HZ; i++) {
    sim.step(input({ crouch }));
    if (g.ai?.alerted) return i / SIM_HZ;
  }
  return Infinity;
};

describe("ADR-0069: how fast a guard makes the player out", () => {
  it("standing a few metres off: about 2 s, not a blink", () => {
    const t = secondsToAlert(3, false);
    expect(t).toBeGreaterThan(1.5);
    expect(t).toBeLessThan(3);
  });

  it("at the far end of its sight: about 4 s", () => {
    const t = secondsToAlert(15, false);
    expect(t).toBeGreaterThan(3);
    expect(t).toBeLessThan(5.5);
  });

  it("crouching, within its crouch sight: about twice as long as standing there", () => {
    const standing = secondsToAlert(6, false);
    const crouching = secondsToAlert(6, true);
    expect(crouching).toBeGreaterThan(standing * 1.8);
  });
});
