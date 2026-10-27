import { describe, expect, it } from "vitest";
import { MANTLE_TIME, Simulation, aabbFromCenter } from "../src";
import { collect, input, run, teleportPlayer } from "./helpers";

/** A wall of the given height across the street ahead (north) of the player at z = 14. */
const withWall = (height: number, roofOver = false) => {
  const sim = Simulation.create({ seed: 1 });
  const add = (id: number, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number) =>
    sim.world.add({ id, position: { x: cx, y: cy, z: cz }, prevPosition: { x: cx, y: cy, z: cz }, yaw: 0, prevYaw: 0, pitch: 0, solid: aabbFromCenter({ x: cx, y: cy, z: cz }, { x: sx, y: sy, z: sz }) });
  add(90001, 0, height / 2, 15, 3, height, 2);
  // A slab right over the wall top: no room to stand there.
  if (roofOver) add(90002, 0, height + 1, 15, 3, 0.2, 2);
  teleportPlayer(sim, { x: 0, y: 0, z: 13.3 }, 0);
  run(sim, 1);
  return sim;
};

const pos = (sim: Simulation) => sim.player()!.position;

describe("mantle (ADR-0021 addendum)", () => {
  it("pulls up onto a wall caught at the top of a jump and stands on it", () => {
    const sim = withWall(2.2);
    const mantles = collect<{ at: { y: number } }>(sim, "Mantled");
    sim.step(input({ jump: true, moveZ: 1 }));
    run(sim, 60, input({ moveZ: 1 }));
    expect(mantles).toHaveLength(1);
    expect(mantles[0]!.at.y).toBeCloseTo(2.2, 5);
    expect(pos(sim).y).toBeCloseTo(2.2, 5);
    expect(pos(sim).z).toBeGreaterThan(14);
    expect(sim.player()!.mantle).toBeUndefined();
  });

  it("takes about MANTLE_TIME and allows no jump or shot meanwhile", () => {
    const sim = withWall(1.6);
    sim.step(input({ jump: true, moveZ: 1 }));
    let steps = 0;
    for (let i = 0; i < 30 && !sim.player()!.mantle; i++) sim.step(input({ moveZ: 1 }));
    expect(sim.player()!.mantle).toBeDefined();
    const shots = collect(sim, "ShotFired");
    let shotsWhileHanging = 0;
    while (sim.player()!.mantle && steps < 120) {
      sim.step(input({ moveZ: 1, jump: true, fire: true }));
      steps++;
      if (sim.player()!.mantle) shotsWhileHanging = shots.length;
    }
    expect(steps * (1 / 60)).toBeCloseTo(MANTLE_TIME, 1);
    expect(shotsWhileHanging).toBe(0);
    expect(sim.player()!.fall).toBeUndefined();
  });

  it("does not catch a wall out of reach, one without room on top, or without pushing into it", () => {
    const high = withWall(3.4);
    high.step(input({ jump: true, moveZ: 1 }));
    run(high, 60, input({ moveZ: 1 }));
    expect(pos(high).y).toBe(0);

    const roofed = withWall(2, true);
    roofed.step(input({ jump: true, moveZ: 1 }));
    run(roofed, 60, input({ moveZ: 1 }));
    expect(pos(roofed).y).toBe(0);

    const still = withWall(1.6);
    still.step(input({ jump: true }));
    run(still, 60);
    expect(pos(still).y).toBe(0);
  });
});
