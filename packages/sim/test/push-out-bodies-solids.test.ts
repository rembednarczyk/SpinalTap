import { describe, expect, it } from "vitest";
import { type Entity, type Simulation, makePrism } from "../src";
import { input, run, teleportPlayer } from "./helpers";
import { quietStreet, takeDown, ticks, victim } from "./takedown-scenes";

/**
 * G-485: the push-out ends on the solids. A body lying by a wall (it does not move, so it is not
 * pushed) neither presses the player walking into it into the wall nor through a thin one.
 */

const STAND = input();
const SINK = 0.001;

/** A clear patch around a knocked-out guard: the solids of the square near it removed. */
const lyingBody = (seed: number): { sim: Simulation; body: Entity } => {
  const sim = quietStreet(seed);
  const body = victim(sim);
  takeDown(sim);
  run(sim, ticks(1), STAND);
  expect(body.downed).toBeDefined();
  const b = body.position;
  for (const s of [...sim.world.with("solid")]) {
    if (s.solid.max.x > b.x - 8 && s.solid.min.x < b.x + 8 && s.solid.max.z > b.z - 8 && s.solid.min.z < b.z + 8) sim.world.remove(s);
  }
  return { sim, body };
};

/** A wall 12 m long, `thick` across, its near face `gap` from the body's centre, north (+z) or east (+x) of it. */
const wall = (sim: Simulation, b: Entity["position"], gap: number, thick: number, east: boolean): Entity => {
  const y = sim.player()!.position.y;
  const [lo, hi] = east ? [{ x: b.x + gap, z: b.z - 6 }, { x: b.x + gap + thick, z: b.z + 6 }] : [{ x: b.x - 6, z: b.z + gap }, { x: b.x + 6, z: b.z + gap + thick }];
  const center = { x: (lo.x + hi.x) / 2, y: y + 1.3, z: (lo.z + hi.z) / 2 };
  return sim.world.add({
    id: 9200,
    position: center,
    prevPosition: center,
    yaw: 0,
    prevYaw: 0,
    pitch: 0,
    chunk: sim.player()!.chunk ?? "",
    view: { kind: "block", size: { x: hi.x - lo.x, y: 2.6, z: hi.z - lo.z }, material: "concrete" },
    solid: { min: { x: lo.x, y, z: lo.z }, max: { x: hi.x, y: y + 2.6, z: hi.z } },
  });
};

/** How far the circle at (x, z) sinks into the wall; 0 or less when clear. */
const sunk = (w: Entity, x: number, z: number, r: number): number => {
  const cx = Math.max(w.solid!.min.x, Math.min(x, w.solid!.max.x));
  const cz = Math.max(w.solid!.min.z, Math.min(z, w.solid!.max.z));
  return r - Math.hypot(x - cx, z - cz);
};

interface Case {
  readonly seed: number;
  readonly gap: number;
  readonly thick: number;
  readonly east: boolean;
  /** Start along the wall (`along` from the body, hugging the wall) or on the body (`along` 0.1). */
  readonly along: number;
  /** Walk along the wall (`moveX`/`moveZ` of the yaw-0 frame) towards the body, `into` the wall too. */
  readonly into: boolean;
}

const walk = ({ seed, gap, thick, east, along, into }: Case): { sink: number; through: boolean } => {
  const { sim, body } = lyingBody(seed);
  const b = { ...body.position };
  const w = wall(sim, b, gap, thick, east);
  const r = sim.player()!.body!.radius;
  const off = gap - r - 0.01;
  teleportPlayer(sim, east ? { x: b.x + off, y: sim.player()!.position.y, z: b.z - along } : { x: b.x - along, y: sim.player()!.position.y, z: b.z + off }, 0);
  const toBody = Math.sign(along) || 1;
  const frame = east ? input({ moveZ: toBody, moveX: into ? 1 : 0 }) : input({ moveX: toBody, moveZ: into ? 1 : 0 });
  let sink = -Infinity;
  let through = false;
  for (let i = 0; i < 60; i++) {
    sim.step(frame);
    const q = sim.player()!.position;
    sink = Math.max(sink, sunk(w, q.x, q.z, r));
    if ((east ? q.x - b.x : q.z - b.z) > gap + thick / 2) through = true;
  }
  // The body lay still and was not pushed through the wall either.
  expect(Math.hypot(body.position.x - b.x, body.position.z - b.z)).toBeLessThan(1e-9);
  return { sink, through };
};

describe("push-out against a body lying by a wall (G-485)", () => {
  for (const seed of [7, 11]) {
    for (const east of [false, true]) {
      for (const thick of [0.06, 0.3]) {
        for (const gap of [0.45, 0.6, 0.7]) {
          for (const [along, into] of [
            [1.2, false],
            [1.2, true],
            [-1.2, true],
            [0.1, true],
            [0.1, false],
          ] as const) {
            it(`seed ${seed}, wall ${east ? "east" : "north"} ${thick} m thick ${gap} m from the body, from ${along} m${into ? ", into the wall" : ""}`, () => {
              const { sink, through } = walk({ seed, gap, thick, east, along, into });
              expect(sink).toBeLessThanOrEqual(SINK);
              expect(through).toBe(false);
            });
          }
        }
      }
    }
  }

  // A building's wall from the city's import: a prism, here a thin one turned off the axes.
  for (const angle of [0.5, -2.2]) {
    for (const [along, into] of [
      [1.2, true],
      [0.1, true],
      [-1.2, false],
    ] as const) {
      it(`a thin prism wall turned ${angle} rad, from ${along} m${into ? ", into the wall" : ""}`, () => {
        const { sim, body } = lyingBody(11);
        const b = { ...body.position };
        const [gap, thick] = [0.6, 0.06];
        const [ux, uz, nx, nz] = [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle)];
        const at = (n: number, u: number) => ({ x: b.x + nx * n + ux * u, z: b.z + nz * n + uz * u });
        const y = sim.player()!.position.y;
        const prism = makePrism([at(gap, -6), at(gap, 6), at(gap + thick, 6), at(gap + thick, -6)], y, y + 2.6);
        const center = { x: (prism.box.min.x + prism.box.max.x) / 2, y: y + 1.3, z: (prism.box.min.z + prism.box.max.z) / 2 };
        sim.world.add({ id: 9200, position: center, prevPosition: center, yaw: 0, prevYaw: 0, pitch: 0, chunk: sim.player()!.chunk ?? "", solid: prism.box, prisms: [prism] });
        const r = sim.player()!.body!.radius;
        const start = at(gap - r - 0.01, -along);
        teleportPlayer(sim, { x: start.x, y, z: start.z }, 0);
        const toBody = Math.sign(along) || 1;
        const frame = input({ moveX: ux * toBody + (into ? nx : 0), moveZ: uz * toBody + (into ? nz : 0) });
        for (let i = 0; i < 60; i++) {
          sim.step(frame);
          const q = sim.player()!.position;
          const s = (q.x - b.x) * nx + (q.z - b.z) * nz;
          expect(s).toBeLessThan(gap + thick / 2);
          expect(r - (gap - s)).toBeLessThanOrEqual(SINK);
        }
      });
    }
  }

  it("in the open the body still stops her: she walks round it, not through it", () => {
    const { sim, body } = lyingBody(7);
    const b = { ...body.position };
    const r = sim.player()!.body!.radius + body.body!.radius;
    teleportPlayer(sim, { x: b.x - 1.5, y: sim.player()!.position.y, z: b.z + 0.1 }, 0);
    let closest = Infinity;
    for (let i = 0; i < 60; i++) {
      sim.step(input({ moveX: 1 }));
      const q = sim.player()!.position;
      closest = Math.min(closest, Math.hypot(q.x - b.x, q.z - b.z));
    }
    expect(closest).toBeGreaterThan(r - 0.01);
  });
});
