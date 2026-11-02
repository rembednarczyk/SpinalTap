import { describe, expect, it } from "vitest";
import type { Entity } from "../src/world/components";
import { Simulation, groundY } from "../src";
import { STEP_HEIGHT } from "../src/systems/movement-system";
import { SEAM_STEP } from "../src/world/ground";
import { bridgeDeckAt } from "../src/content/lublin/decks";
import { input, teleportPlayer } from "./helpers";

/**
 * Walking the steps from the viaduct of Zamkowa (G-255, OSM w56965515), up and down, as the
 * player does: along the map's line from Plac Zamkowy below its foot, by its bend, up to where
 * it leaves the deck and on along the viaduct, on it or up to 1.2 m either side of it, at a walk
 * and at a run, turning to each point within 0.2 to 1.2 m of it. The steps' band is a niche in
 * the viaduct's sidewalk (G-274): drawn and walked alike. Each walk gets to its end, no step of
 * it climbs or drops more than a step, and the feet are never under the ground drawn there
 * (`groundY`, the viaduct's deck too): nobody walks under the flight or the deck, through them.
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

it("measures the seam beside a flight in the step the movement climbs (G-273)", () => {
  expect(SEAM_STEP).toBe(STEP_HEIGHT);
});

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

  it("keeps the viaduct's deck a wall from the bend's landing to a dash too: a body at 14 m/s steps up no more than a step", () => {
    for (const [fx, fz, tx, tz] of [
      [731.6, 159.4, 731.27, 158.79],
      [729.9, 158.6, 729.37, 157.25],
      [729.2, 158.4, 728.61, 157.45],
      [732.5, 160.1, 732.19, 159.59],
      [730.6, 160.6, 730.24, 159.97],
    ] as const) {
      const y0 = sim.streamer.ground.heightAt(fx, fz, -15.31 + STEP_HEIGHT);
      const e = sim.world.add({ id: 9_257, position: { x: fx, y: y0, z: fz }, prevPosition: { x: fx, y: y0, z: fz }, yaw: 0, prevYaw: 0, pitch: 0, body: { radius: 0.38, height: 1.8 }, velocity: { x: 0, y: 0, z: 0 } });
      const l = Math.hypot(tx - fx, tz - fz);
      let up = 0;
      for (let i = 0; i < 60; i++) {
        const y = e.position.y;
        e.velocity = { x: ((tx - fx) / l) * 14, y: e.velocity?.y ?? 0, z: ((tz - fz) / l) * 14 };
        sim.step();
        up = Math.max(up, e.position.y - y);
      }
      sim.world.remove(e);
      expect(up, `(${fx}, ${fz})`).toBeLessThanOrEqual(STEP_HEIGHT);
    }
  }, 60_000);

  it("keeps the viaduct's deck a wall from the bend's landing: no step up onto it over a step", () => {
    // From the landing (−15.31) towards the deck 1.6–1.8 m higher beside it, walking, running, crouching.
    for (const [fx, fz, tx, tz] of [
      [731.6, 159.4, 731.27, 158.79],
      [729.9, 158.6, 729.37, 157.25],
      [729.2, 158.4, 728.61, 157.45],
      [732.5, 160.1, 732.19, 159.59],
    ] as const) {
      for (const mode of [{}, { sprint: true }, { crouch: true }]) {
        teleportPlayer(sim, { x: fx, y: sim.streamer.ground.heightAt(fx, fz, -15.31 + STEP_HEIGHT), z: fz });
        sim.step();
        let up = 0;
        for (let i = 0; i < 120; i++) {
          const p = sim.player()!;
          p.yaw = Math.atan2(tx - fx, tz - fz);
          const y = p.position.y;
          sim.step(input({ moveZ: 1, ...mode }));
          up = Math.max(up, sim.player()!.position.y - y);
        }
        expect(up, `(${fx}, ${fz}) ${JSON.stringify(mode)}`).toBeLessThanOrEqual(STEP_HEIGHT);
      }
    }
  }, 60_000);

  it("keeps the flight's sides a wall: a body pushed into them from 4 m off never steps up more than a step", () => {
    const bad: string[] = [];
    for (let seg = 1; seg <= 3; seg++) {
      const [a, b] = [LINE[seg]!, LINE[seg + 1]!];
      const l = Math.hypot(b.x - a.x, b.z - a.z);
      const u = { x: (b.x - a.x) / l, z: (b.z - a.z) / l };
      for (const s of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        for (const side of [1, -1]) {
          for (const v of [1.4, 3, 6, 14]) {
            // The run on the viaduct has the viaduct's edges for sides: a dash onto a deck with
            // under 2 m of room under it lifts onto it as on main (G-062), not the flight's doing.
            if (seg === 3 && v > 6) continue;
            for (const ang of [0, 0.6]) {
              const from = { x: a.x + u.x * s * l - u.z * 4 * side, z: a.z + u.z * s * l + u.x * 4 * side };
              const y0 = sim.streamer.ground.heightAt(from.x, from.z, sim.streamer.ground.heightAt(from.x, from.z, -1e9) + STEP_HEIGHT);
              const e = sim.world.add({ id: 9_256, position: { ...from, y: y0 }, prevPosition: { ...from, y: y0 }, yaw: 0, prevYaw: 0, pitch: 0, body: { radius: 0.38, height: 1.8 }, velocity: { x: 0, y: 0, z: 0 } });
              const d0 = { x: u.z * side, z: -u.x * side };
              const d = { x: d0.x * Math.cos(ang) - d0.z * Math.sin(ang), z: d0.x * Math.sin(ang) + d0.z * Math.cos(ang) };
              let up = 0;
              for (let i = 0; i < 90; i++) {
                const y = e.position.y;
                e.velocity = { x: d.x * v, y: e.velocity?.y ?? 0, z: d.z * v };
                sim.step();
                up = Math.max(up, e.position.y - y);
              }
              sim.world.remove(e);
              if (up > STEP_HEIGHT) bad.push(`run ${seg} at ${s} side ${side} ${v} m/s ${ang}: ${up.toFixed(2)} m`);
            }
          }
        }
      }
    }
    expect(bad).toEqual([]);
  }, 120_000);

  it("keeps a floor under the viaduct's sidewalk by the niche: its edge walked past the steps never sinks under the deck or the steps drawn (G-274)", () => {
    // Zamkowa's axis on the viaduct (OSM w232362907), and its deck's edge on the steps' side ~4 m off it.
    const [a, b] = [
      { x: 761, z: 185.6 },
      { x: 730.1, z: 154.5 },
    ];
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    const u = { x: (b.x - a.x) / l, z: (b.z - a.z) / l };
    const side = (734.1 - a.x) * -u.z + (163.9 - a.z) * u.x > 0 ? 1 : -1;
    for (const off of [2.5, 3.0, 3.5]) {
      const at = (t: number): P => ({ x: a.x + u.x * l * t - u.z * off * side, z: a.z + u.z * l * t + u.x * off * side });
      for (const way of [
        [at(0.6), at(0.95)],
        [at(0.95), at(0.6)],
      ]) {
        // Along the deck's edge it may step down into the niche, onto the steps drawn there.
        const w = playerWalk(sim, way, 0.6, false);
        expect(w.sunk, `${off} m off: ${w.at}`).toBeLessThan(0.05);
      }
    }
  }, 60_000);

  it("hangs no slab of the viaduct over the flight or its landings: where the flight is the ground, no deck is over it (G-274)", () => {
    const over: string[] = [];
    for (let x = 724; x <= 738; x += 0.25) {
      // Off the line z = 160 itself: there `GroundField` takes the decks of the chunk south of it
      // only, and the viaduct's piece north of it is missing (a seam of main, reported apart).
      for (let z = 155.125; z <= 167; z += 0.25) {
        if (sim.streamer.ground.onFlight(x, z) && bridgeDeckAt(x, z) !== null) over.push(`(${x}, ${z})`);
      }
    }
    expect(over).toEqual([]);
  });

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
