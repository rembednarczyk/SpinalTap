import { describe, expect, it } from "vitest";
import { Simulation } from "../src";
import { input, run, teleportPlayer } from "./helpers";

const EAST = Math.PI / 2;
const WEST = -Math.PI / 2;
const SOUTH = Math.PI;

/** The player at a spot, with the chunks around it streamed in. */
const at = (x: number, y: number, z: number, yaw: number): Simulation => {
  const sim = Simulation.create({ seed: 1 });
  teleportPlayer(sim, { x, y, z }, yaw);
  run(sim, 2);
  teleportPlayer(sim, { x, y, z }, yaw);
  return sim;
};

/** Sprints along the yaw, jumping every half second, for a few seconds. */
const runAndJump = (sim: Simulation, seconds = 6) => {
  for (let i = 0; i < seconds * 60; i++) sim.step(input({ moveZ: 1, sprint: true, jump: i % 30 === 0 }));
  run(sim, 120);
};

describe("edge of the world (audit K1-K4)", () => {
  it.each([
    ["west end of the overpass", 72, 9.9, 93, WEST],
    ["east end of the overpass", 120, 9.9, 92, EAST],
    ["low market roof, south", 75, 9.1, 61, SOUTH],
    ["low market roof, west onto the wall", 70, 9.1, 61, WEST],
    ["top of the south market wall, east", 110, 6, 57, EAST],
  ] as const)("running and jumping off the %s never leaves every district", (_, x, y, z, yaw) => {
    const sim = at(x, y, z, yaw);
    runAndJump(sim);
    const p = sim.player()!.position;
    expect(sim.streamer.chunkIdAt(p), `ended at ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`).not.toBe("");
  });
});
