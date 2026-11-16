import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import { SIM_HZ, type Simulation } from "../src";
import { straightWalk } from "../src/systems/ai/steering";
import { lineOfSight } from "../src/world/hitscan";
import { solidIndexOf } from "../src/world/solid-index";
import { raySolidEntity } from "../src/world/solids";
import { AWAY, byKey, run, teleportPlayer } from "./helpers";
import { alarmed } from "./contract-save-helpers";

/**
 * G-884: a guard pinned after the player (G-188) asks every step whether the walk to her is free,
 * her 2.4 km away. The sight line's solids were all those of its box, a strip of the city 2.4 km
 * by 400 m: some 2300 a step, where those whose boxes the line passes are 5.
 */

/** Solids handed back by the index per step, the guard after her 2.4 km away (2300 before G-884, 5 after). */
const PER_STEP_LIMIT = 130;

/** Sent after her (as a wave is): he never gives her up by himself. */
const sentAfter = (sim: Simulation, key: string): void => {
  const g = byKey(sim, key)!;
  g.ai = { ...g.ai!, alerted: true, victim: "nobody" };
};

/** `lineOfSight` without the terrain, by every solid of the world: what the index must give. */
const throughAll = (sim: Simulation, from: Vec3, to: Vec3): boolean => {
  const len = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  if (len < 1e-6) return true;
  const dir = { x: (to.x - from.x) / len, y: (to.y - from.y) / len, z: (to.z - from.z) / len };
  return !sim.world.with("solid").entities.some((e) => raySolidEntity(from, dir, e, len) !== null);
};

describe("the walk of a guard to a player far off (G-884)", () => {
  it("is asked of the solids along it, not of all of its box", () => {
    const { sim, id } = alarmed(10);
    const key = `${id}-g1`;
    sentAfter(sim, key);
    teleportPlayer(sim, AWAY);
    run(sim, SIM_HZ);
    const index = solidIndexOf(sim.world);
    const before = index.stats.candidates;
    run(sim, SIM_HZ);
    const perStep = (index.stats.candidates - before) / SIM_HZ;
    expect(byKey(sim, key)?.ai?.alerted).toBe(true);
    expect(perStep).toBeLessThan(PER_STEP_LIMIT);
    const once = index.stats.candidates;
    expect(straightWalk(sim.world, byKey(sim, key)!.position, sim.player()!.position)).toBe(false);
    expect(index.stats.candidates - once).toBeLessThan(PER_STEP_LIMIT);
  });

  it("sees the same solids in the way as a test of every solid of the world", () => {
    const { sim, id } = alarmed(10);
    const key = `${id}-g1`;
    const seen: boolean[] = [];
    // Fans of lines from the door guard and from her (the docks loaded), short and long, along the
    // axes and on the cells' lines (16 m) too; and from the far guard, his chunk asleep, to the
    // city round him.
    const fan = (at: Vec3): void => {
      const from = { ...at, y: at.y + 0.6 };
      for (let i = 0; i < 96; i++) {
        const a = (i * 2 * Math.PI) / 96;
        const r = [5, 16, 40, 120, 400, 2400][i % 6]!;
        const [x, z] = [i % 8 === 0 ? from.x : Math.round(from.x + Math.cos(a) * r), i % 12 === 6 ? from.z : from.z + Math.sin(a) * r];
        const to = { x, y: sim.streamer.ground.heightAt(x, z) + 0.6 + (i % 3), z };
        const free = lineOfSight(sim.world, from, to, false);
        expect(free, `${from.x}, ${from.z} to ${to.x}, ${to.z}`).toBe(throughAll(sim, from, to));
        seen.push(free);
      }
    };
    fan(byKey(sim, key)!.position);
    fan(sim.player()!.position);
    sentAfter(sim, key);
    teleportPlayer(sim, AWAY);
    run(sim, SIM_HZ);
    fan(byKey(sim, key)!.position);
    fan(sim.player()!.position);
    expect([seen.filter((f) => f).length, seen.filter((f) => !f).length].map((n) => n > 20)).toEqual([true, true]);
  });
});
