import { describe, expect, it } from "vitest";
import { OVERPASS_TOP, Simulation, aabbFromCenter, market } from "../src";
import { STREET_START, collect, input, run, teleportPlayer } from "./helpers";

/** Open ground on Plac Litewski (ADR-0045). */
const O = STREET_START;

/**
 * A run and a jump at a railing `thick` metres thick and 1.1 m high across the square, its near
 * face `d` ahead, at `deg` off square to it. Returns the pull-ups and the highest the feet stood.
 */
const jumpAt = (thick: number, deg: number, d: number, sprint: boolean) => {
  const sim = Simulation.create({ seed: 1 });
  const c = { x: O.x, y: O.y + 0.55, z: O.z + d + thick / 2 };
  sim.world.add({ id: 90001, position: c, prevPosition: c, yaw: 0, prevYaw: 0, pitch: 0, solid: aabbFromCenter(c, { x: 14, y: 1.1, z: thick }) });
  teleportPlayer(sim, O, (deg * Math.PI) / 180);
  run(sim, 1);
  const mantles = collect(sim, "Mantled");
  sim.step(input({ jump: true, moveZ: 1, sprint }));
  let stood = 0;
  for (let i = 0; i < 80; i++) {
    sim.step(input({ moveZ: 1, sprint }));
    const p = sim.player()!;
    if (p.fall === undefined && !p.mantle) stood = Math.max(stood, p.position.y - O.y);
  }
  return { mantles: mantles.length, stood };
};

type Rect = readonly [x0: number, x1: number, z0: number, z1: number];

/**
 * A run and a jump from `from` at `yaw` into railings 1.1 m high, all of one height, given as
 * rectangles from the corner of the square. Returns the pull-ups, the highest the feet stood
 * and where she ended up (from the corner).
 */
const jumpInto = (rails: readonly Rect[], from: { x: number; z: number }, yaw: number) => {
  const sim = Simulation.create({ seed: 1 });
  rails.forEach(([x0, x1, z0, z1], i) => {
    const c = { x: O.x + (x0 + x1) / 2, y: O.y + 0.55, z: O.z + (z0 + z1) / 2 };
    sim.world.add({ id: 90001 + i, position: c, prevPosition: c, yaw: 0, prevYaw: 0, pitch: 0, solid: aabbFromCenter(c, { x: x1 - x0, y: 1.1, z: z1 - z0 }) });
  });
  teleportPlayer(sim, { x: O.x + from.x, y: O.y, z: O.z + from.z }, yaw);
  run(sim, 1);
  const mantles = collect(sim, "Mantled");
  sim.step(input({ jump: true, moveZ: 1, sprint: true }));
  let stood = 0;
  for (let i = 0; i < 80; i++) {
    sim.step(input({ moveZ: 1, sprint: true }));
    const p = sim.player()!;
    if (p.fall === undefined && !p.mantle) stood = Math.max(stood, p.position.y - O.y);
  }
  const p = sim.player()!.position;
  return { mantles: mantles.length, stood, x: p.x - O.x, z: p.z - O.z };
};

describe("thin tops (G-372)", () => {
  // Two railings of one height meeting at a corner are no floor together (round 2 of #321).
  it.each([0.1, 0.2])("gives no foothold on an L corner of railings %s m thick, nor a way over it", (t) => {
    const footholds: string[] = [];
    // The outer corner at (2, 2), the railings running east and north of it, the L's inside beyond.
    const rails: Rect[] = [[2, 6, 2, 2 + t], [2, 2 + t, 2, 6]];
    for (let deg = -60; deg <= 60; deg += 15)
      for (const d of [0.9, 1.4]) {
        const yaw = ((45 + deg) * Math.PI) / 180;
        const r = jumpInto(rails, { x: 2 - d * Math.sin(yaw), z: 2 - d * Math.cos(yaw) }, yaw);
        const over = r.x > 2 + t && r.z > 2 + t;
        if (r.mantles > 0 || r.stood > 0.5 || over) footholds.push(`${deg}° ${d} m: ${r.mantles} pull-ups, stood ${r.stood.toFixed(2)}${over ? ", over" : ""}`);
      }
    expect(footholds).toEqual([]);
  });

  it.each([0.1, 0.2])("gives no foothold on a T of railings %s m thick, nor a way over it", (t) => {
    const footholds: string[] = [];
    // A railing along x at z 2, a second one meeting it from the south (her side) at x 4.
    const rails: Rect[] = [[0, 8, 2, 2 + t], [4 - t / 2, 4 + t / 2, -2, 2]];
    for (const side of [-1, 1])
      for (let deg = -60; deg <= 60; deg += 15)
        for (const d of [0.9, 1.3]) {
          // At the corner 0.6 m beside the stem, from her side of it.
          const yaw = (deg * Math.PI) / 180;
          const from = { x: 4 + side * 0.6 - d * Math.sin(yaw), z: 2 - d * Math.cos(yaw) };
          if (side * (from.x - 4) < t / 2 + 0.45) continue;
          const r = jumpInto(rails, from, yaw);
          const over = r.z > 2 + t;
          if (r.mantles > 0 || r.stood > 0.5 || over) footholds.push(`${side} ${deg}° ${d} m: ${r.mantles} pull-ups, stood ${r.stood.toFixed(2)}${over ? ", over" : ""}`);
        }
    expect(footholds).toEqual([]);
  });

  // Before: on top of it in 9 (0.1 m) and 11 (0.2 m) of the 12 runs, by a pull-up at 60-75°.
  it.each([0.1, 0.2])("gives no foothold on a railing %s m thick, run at from 0 to 75 degrees", (thick) => {
    const footholds: string[] = [];
    for (let deg = 0; deg <= 75; deg += 15)
      for (const [d, sprint] of [[0.45, false], [0.8, true]] as const) {
        const r = jumpAt(thick, deg, d, sprint);
        if (r.mantles > 0 || r.stood > 0.5) footholds.push(`${deg}° ${d} m${sprint ? " sprint" : ""}: ${r.mantles} pull-ups, stood ${r.stood.toFixed(2)}`);
      }
    expect(footholds).toEqual([]);
  });

  it("gives none on the targ lift's top gate, the shaft's walls or the deck's railing beside them", () => {
    const top = market(0, OVERPASS_TOP, 0).y;
    const first = Simulation.create({ seed: 3 });
    teleportPlayer(first, market(108, OVERPASS_TOP, 89), Math.PI);
    run(first, 2);
    const snap = first.snapshot(null, "t", "");
    const footholds: string[] = [];
    // From the deck at the closed gate (the cage down), straight and towards both walls.
    for (const sx of [-0.8, 0.8])
      for (let deg = -75; deg <= 75; deg += 15) {
        const sim = Simulation.fromSnapshot(snap);
        for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
        const yaw = Math.PI + (deg * Math.PI) / 180;
        teleportPlayer(sim, market(108 + sx, OVERPASS_TOP, 87.7), yaw);
        run(sim, 1);
        const mantles = collect(sim, "Mantled");
        const p = sim.player()!;
        let stood = 0;
        for (let i = 0; i < 60; i++) {
          p.yaw = yaw;
          sim.step(input({ moveZ: 1, sprint: true, jump: i === 0 }));
          if (p.fall === undefined && !p.mantle) stood = Math.max(stood, p.position.y - top);
        }
        // Before: on top of the gate, a wall or the railing in 20 of the 22 runs, 4 by a pull-up.
        if (mantles.length > 0 || stood > 0.5) footholds.push(`${sx} ${deg}°: ${mantles.length} pull-ups, stood ${stood.toFixed(2)}`);
      }
    expect(footholds).toEqual([]);
  });
});
