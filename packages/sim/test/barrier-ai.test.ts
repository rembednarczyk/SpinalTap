import { describe, expect, it } from "vitest";
import { type StreetPropItem, barrierLayout } from "@seki/core";
import { Simulation, WORLD_BARRIERS, gangerEntity } from "../src";
import { distanceToBarrier } from "../src/content/lublin/barriers";
import { teleportPlayer } from "./helpers";

/**
 * An alerted ganger and the player on two sides of a fence of the map (ADR-0077, G-610): it sees
 * her through the bars, but its shot would stop in them, so it does not stand and fire into the
 * fence; it goes round, or finds a clear shot.
 */

const all = Object.entries(WORLD_BARRIERS).flatMap(([chunk, items]) => items.map((item) => ({ chunk, item })));
/** A point `a` metres off a piece's middle, square to it. */
const off = (i: StreetPropItem, a: number) => ({ x: i.x + Math.cos(i.yaw) * a, z: i.z - Math.sin(i.yaw) * a });
/** Long fences with the ground 4 m before and 2 m behind clear of every other barrier. */
const lone = all.filter(
  ({ item }) =>
    barrierLayout(item.variant).kind === "fence" &&
    barrierLayout(item.variant).length > 2.5 &&
    [-4, -2, -1, 1, 2].every((a) => {
      const p = off(item, a);
      return all.every((o) => o.item === item || distanceToBarrier(o.item, p.x, p.z) > 1.5);
    }),
);

describe("a ganger and the player on two sides of a fence (G-610)", () => {
  it("does not stand firing into the fence: the player loses health or the ganger moves", () => {
    expect(lone.length).toBeGreaterThan(1);
    for (const { chunk, item } of lone.slice(0, 2)) {
      const sim = Simulation.create({ seed: 2 });
      const to = off(item, 1.5);
      const from = off(item, -4);
      teleportPlayer(sim, { x: to.x, y: 0, z: to.z });
      sim.step();
      const ground = sim.streamer.ground;
      const p = sim.player()!;
      p.position = p.prevPosition = { x: to.x, y: ground.heightAt(to.x, to.z), z: to.z };
      const hp = p.health!.current;
      const g = gangerEntity(9001, { key: "g610", position: { x: from.x, y: ground.heightAt(from.x, from.z), z: from.z }, yaw: 0 }, null, 200, chunk);
      g.ai!.alerted = true;
      sim.world.add(g);
      let shots = 0;
      sim.bus.on("ShotFired" as never, () => {
        shots++;
      });
      const start = { ...g.position };
      for (let i = 0; i < 60 * 12; i++) sim.step();
      const moved = Math.hypot(g.position.x - start.x, g.position.z - start.z);
      const lost = hp - p.health!.current;
      expect(lost > 0 || moved > 1, `fence at ${item.x}, ${item.z}: moved ${moved.toFixed(2)} m, ${shots} shots, ${lost} health`).toBe(true);
      // No volley into the bars: whatever it fired, some of it got through.
      if (shots > 3) expect(lost, `fence at ${item.x}, ${item.z}: ${shots} shots into the fence`).toBeGreaterThan(0);
    }
  }, 120_000);
});
