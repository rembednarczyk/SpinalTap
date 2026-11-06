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

describe("thin tops (G-372)", () => {
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
