import { describe, expect, it } from "vitest";
import { EMPTY_INPUT } from "@seki/core";
import { Simulation, groundY } from "../src";
import { teleportPlayer } from "./helpers";

/**
 * The way down from behind Grodzka's houses to Kowalska by Brama Grodzka (G-755, OSM w179264855,
 * `highway=pedestrian`, no steps mapped): the NMT falls 9 m over 10 m of its axis there, a bank
 * no walker climbs. The player walks it down and back up along the map's axis.
 */

type P = { readonly x: number; readonly z: number };

/** The way's axis (world metres, from the map) from the top of the bank down to its end. */
const AXIS: readonly P[] = [
  { x: 650, z: 128.8 },
  { x: 672.5, z: 136.2 },
  { x: 688, z: 145 },
];

/** Walks to (x, z), turning towards it every step; the distance left when it stopped. */
const walkTo = (sim: Simulation, { x, z }: P): number => {
  for (let i = 0; i < 900; i++) {
    const p = sim.player()!;
    const d = Math.hypot(x - p.position.x, z - p.position.z);
    if (d < 0.5) return d;
    const want = Math.atan2(x - p.position.x, z - p.position.z);
    sim.step({ ...EMPTY_INPUT, moveZ: 1, lookYaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) });
  }
  const p = sim.player()!;
  return Math.hypot(x - p.position.x, z - p.position.z);
};

describe("the way down from Grodzka to Kowalska, w179264855 (G-755)", () => {
  it("is walked down the bank and back up along its axis", () => {
    const sim = Simulation.create({ seed: 3 });
    const [start] = AXIS;
    teleportPlayer(sim, { x: start!.x, y: groundY(start!.x, start!.z), z: start!.z }, Math.PI / 2);
    sim.step();
    for (const p of AXIS.slice(1)) expect(walkTo(sim, p), `down to ${p.x}, ${p.z}`).toBeLessThan(0.5);
    for (const p of [...AXIS].reverse().slice(1)) expect(walkTo(sim, p), `up to ${p.x}, ${p.z}`).toBeLessThan(0.5);
    const p = sim.player()!.position;
    expect(p.y).toBeCloseTo(groundY(p.x, p.z), 1);
  }, 60_000);
});
