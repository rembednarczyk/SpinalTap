import { describe, expect, it } from "vitest";
import type { Entity } from "../src/world/components";
import { Simulation, groundY } from "../src";
import { STEP_HEIGHT } from "../src/systems/movement-system";
import { input, teleportPlayer } from "./helpers";

/**
 * Walking the steps from the viaduct of Zamkowa (G-255, OSM w56965515), up and down, as the
 * player does: along the map's line from Plac Zamkowy below its foot, by its bend, up to where
 * it leaves the deck and on along the viaduct, 1 m either side of it or on it, at a walk and at
 * a run, turning to each point within 0.2 to 1.2 m of it. Each walk gets to its end, no step of
 * it climbs or drops more than a step, and the feet are never under the ground the treads are
 * drawn on (`groundY`): nobody walks under the flight, through its treads.
 */

type P = { readonly x: number; readonly z: number };

const LINE: readonly P[] = [
  { x: 726.5, z: 165.5 },
  { x: 727.3, z: 164 },
  { x: 729.5, z: 159.9 },
  { x: 734.1, z: 163.9 },
  { x: 736.8, z: 160.9 },
  { x: 738.5, z: 159.0 },
];

/** The line moved `off` m to its left. */
const aside = (off: number): P[] =>
  LINE.map((p, i) => {
    const q = LINE[Math.min(i + 1, LINE.length - 1)]!;
    const r = LINE[Math.max(i - 1, 0)]!;
    const [dx, dz] = [q.x - r.x, q.z - r.z];
    const l = Math.hypot(dx, dz);
    return { x: p.x - (dz / l) * off, z: p.z + (dx / l) * off };
  });

interface Walk {
  readonly left: number;
  readonly step: number;
  readonly sunk: number;
  readonly at: string;
}

/** A walk of `body` (steered each frame by `steer`) along `way` from its first point, turning to the next within `R` m. */
const walk = (sim: Simulation, body: () => Entity, steer: (e: Entity, to: P) => void, way: readonly P[], R: number): Walk => {
  let next = 1;
  let step = 0;
  let sunk = 0;
  let at = "";
  for (let i = 0; i < 60 * 40 && next < way.length; i++) {
    const e = body();
    const to = way[next]!;
    if (Math.hypot(to.x - e.position.x, to.z - e.position.z) < R) {
      next++;
      continue;
    }
    const y = e.position.y;
    steer(e, to);
    const q = body().position;
    step = Math.max(step, Math.abs(q.y - y));
    const under = groundY(q.x, q.z) - q.y;
    if (under > sunk) [sunk, at] = [under, `(${q.x.toFixed(2)}, ${q.z.toFixed(2)}) feet ${q.y.toFixed(2)} drawn ${groundY(q.x, q.z).toFixed(2)}`];
  }
  const end = way[way.length - 1]!;
  const p = body().position;
  return { left: Math.hypot(end.x - p.x, end.z - p.z), step, sunk, at };
};

const playerWalk = (sim: Simulation, way: readonly P[], R: number, run: boolean): Walk => {
  teleportPlayer(sim, { x: way[0]!.x, y: sim.streamer.ground.heightAt(way[0]!.x, way[0]!.z), z: way[0]!.z });
  sim.step();
  return walk(
    sim,
    () => sim.player()!,
    (e, to) => {
      e.yaw = Math.atan2(to.x - e.position.x, to.z - e.position.z);
      sim.step(input({ moveZ: 1, ...(run ? { sprint: true } : {}) }));
    },
    way,
    R,
  );
};

const check = (label: string, w: Walk, R: number) => {
  expect(w.left, `${label}: ${w.left.toFixed(2)} m short`).toBeLessThan(R + 0.5);
  expect(w.step, `${label}: a step of ${w.step.toFixed(2)} m`).toBeLessThanOrEqual(STEP_HEIGHT);
  expect(w.sunk, `${label}: ${w.at}`).toBeLessThan(0.05);
};

describe("walking the steps from the viaduct of Zamkowa (G-255)", () => {
  const sim = Simulation.create({ seed: 3 });
  for (const off of [-1.2, -1, -0.5, 0, 0.5, 1, 1.2]) {
    it(`gets up and down them ${off} m to the side of the line, walking and running`, () => {
      for (const R of [0.2, 0.6, 1.2]) {
        for (const run of [false, true]) {
          const up = aside(off);
          check(`up off ${off} R ${R} run ${run}`, playerWalk(sim, up, R, run), R);
          check(`down off ${off} R ${R} run ${run}`, playerWalk(sim, [...up].reverse(), R, run), R);
        }
      }
    }, 120_000);
  }

  it("lets nobody under the flight from beside it: across it from either side, the feet are never under its treads", () => {
    // Across the run from the bend (729.5, 159.9) up to the deck (734.1, 163.9), 4 m either side of it.
    const [a, b] = [LINE[2]!, LINE[3]!];
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    const u = { x: (b.x - a.x) / l, z: (b.z - a.z) / l };
    const at = (s: number, off: number): P => ({ x: a.x + u.x * s * l - u.z * off, z: a.z + u.z * s * l + u.x * off });
    for (const s of [0.3, 0.5, 0.7, 0.9]) {
      for (const side of [1, -1]) {
        const w = playerWalk(sim, [at(s, 4 * side), at(s, -4 * side)], 0.6, false);
        expect(w.sunk, `across at ${s} from ${side}: ${w.at}`).toBeLessThan(0.05);
      }
    }
  }, 60_000);

  it("lets a body the AI steers (by its velocity) up them as the player", () => {
    const way = aside(0);
    const start = way[0]!;
    const y = sim.streamer.ground.heightAt(start.x, start.z);
    const npc = sim.world.add({
      id: 9_255,
      position: { x: start.x, y, z: start.z },
      prevPosition: { x: start.x, y, z: start.z },
      yaw: 0,
      prevYaw: 0,
      pitch: 0,
      body: { radius: 0.38, height: 1.8 },
      velocity: { x: 0, y: 0, z: 0 },
    });
    const w = walk(
      sim,
      () => npc,
      (e, to) => {
        const d = Math.hypot(to.x - e.position.x, to.z - e.position.z);
        e.velocity = { x: ((to.x - e.position.x) / d) * 1.4, y: e.velocity?.y ?? 0, z: ((to.z - e.position.z) / d) * 1.4 };
        sim.step();
      },
      way,
      0.6,
    );
    sim.world.remove(npc);
    check("npc up", w, 0.6);
  }, 60_000);
});
