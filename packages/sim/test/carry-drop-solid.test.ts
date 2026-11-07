import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import { DROP_PROMPT, type Entity, NO_ROOM_PROMPT, type Simulation } from "../src";
import { input, run } from "./helpers";
import { quietStreet, takeDown, ticks, victim } from "./takedown-scenes";

/** G-479: a body put down lands beside the player, clear of solids and of her; with no room she keeps it. */

const STAND = input();

type Xz = { x: number; z: number };

/** A container (no hiding place) with its footprint `min`..`max` on the ground under the player. */
const container = (sim: Simulation, id: number, min: Xz, max: Xz): Entity => {
  const y = sim.player()!.position.y;
  const center = { x: (min.x + max.x) / 2, y: y + 1.3, z: (min.z + max.z) / 2 };
  return sim.world.add({
    id,
    position: center,
    prevPosition: center,
    yaw: 0,
    prevYaw: 0,
    pitch: 0,
    chunk: sim.player()!.chunk ?? "",
    view: { kind: "block", size: { x: max.x - min.x, y: 2.6, z: max.z - min.z }, material: "metal" },
    solid: { min: { x: min.x, y, z: min.z }, max: { x: max.x, y: y + 2.6, z: max.z } },
  });
};

/** The player with a knocked-out guard on her shoulder, facing `yaw`. */
const carrying = (seed: number, yaw: number): { sim: Simulation; body: Entity } => {
  const sim = quietStreet(seed);
  const body = victim(sim);
  takeDown(sim);
  run(sim, ticks(1), STAND);
  sim.step(STAND);
  sim.enqueue({ type: "carry-body" });
  sim.step(STAND);
  expect(sim.session.carrying).toBe(body.id);
  const p = sim.player()!;
  p.yaw = yaw;
  p.prevYaw = yaw;
  return { sim, body };
};

const inside = (s: Entity, at: Vec3): boolean =>
  at.x > s.solid!.min.x && at.x < s.solid!.max.x && at.z > s.solid!.min.z && at.z < s.solid!.max.z;

/** How far the circle of `radius` at (x, z) sinks into the solid's footprint; 0 or less when clear. */
const sunk = (s: Entity, at: Xz, radius: number): number => {
  const cx = Math.max(s.solid!.min.x, Math.min(at.x, s.solid!.max.x));
  const cz = Math.max(s.solid!.min.z, Math.min(at.z, s.solid!.max.z));
  return radius - Math.hypot(at.x - cx, at.z - cz);
};

/** The dropped body does not lie on her: the centres at least the two radii apart. */
const besideHer = (sim: Simulation, body: Entity): void => {
  const p = sim.player()!;
  const d = Math.hypot(body.position.x - p.position.x, body.position.z - p.position.z);
  expect(d).toBeGreaterThanOrEqual(p.body!.radius + body.body!.radius - 1e-9);
};

/**
 * Walking into a body lying by a wall, the movement's push-out ends on the body and leaves her a
 * few centimetres in the wall (3.5 cm at most over 400 steps here; a glitch of its own, not of the
 * drop). A body dropped on her sank her 0.23-0.36 m.
 */
const SINK = 0.05;

/** Walks `frame` for 40 steps: she never sinks into a solid (beyond `SINK`) nor gets past one. */
const walkClear = (sim: Simulation, frame: ReturnType<typeof input>, solids: readonly Entity[]): void => {
  const start = { ...sim.player()!.position };
  const r = sim.player()!.body!.radius;
  for (let i = 0; i < 40; i++) {
    sim.step(frame);
    const q = sim.player()!.position;
    for (const s of solids) {
      expect(sunk(s, q, r)).toBeLessThan(SINK);
      // Past it: on its far side from where she started, along its thin axis.
      const thinZ = s.solid!.max.z - s.solid!.min.z < s.solid!.max.x - s.solid!.min.x;
      const [lo, hi, a, b] = thinZ ? [s.solid!.min.z, s.solid!.max.z, start.z, q.z] : [s.solid!.min.x, s.solid!.max.x, start.x, q.x];
      expect((a < lo && b > hi) || (a > hi && b < lo)).toBe(false);
    }
  }
};

/** Drops the body and checks its centre right after and 30 steps later. */
const dropClear = (sim: Simulation, body: Entity, solids: readonly Entity[]): void => {
  sim.enqueue({ type: "drop-body" });
  sim.step(STAND);
  expect(sim.session.carrying).toBeNull();
  for (const s of solids) expect(inside(s, body.position)).toBe(false);
  run(sim, 30, STAND);
  for (const s of solids) expect(inside(s, body.position)).toBe(false);
  // Still at her feet, not thrown across the street.
  const p = sim.player()!.position;
  expect(Math.hypot(body.position.x - p.x, body.position.z - p.z)).toBeLessThan(1.5);
};

describe("dropping a body by a solid (G-479)", () => {
  it("facing a container right in front of her: the body lands outside it", () => {
    const { sim, body } = carrying(7, 0);
    const p = sim.player()!.position;
    // The container's near face 0.45 m ahead (north), as the one at 391.2..392.8 x -33.6..-32.4.
    const box = container(sim, 9100, { x: p.x - 0.8, z: p.z + 0.45 }, { x: p.x + 0.8, z: p.z + 1.65 });
    dropClear(sim, body, [box]);
  });

  it("facing east, another seed, a container ahead and another on her left: still outside both", () => {
    const { sim, body } = carrying(11, Math.PI / 2);
    const p = sim.player()!.position;
    const ahead = container(sim, 9100, { x: p.x + 0.45, z: p.z - 0.8 }, { x: p.x + 1.65, z: p.z + 0.8 });
    const left = container(sim, 9101, { x: p.x - 0.8, z: p.z + 0.45 }, { x: p.x + 0.8, z: p.z + 1.65 });
    dropClear(sim, body, [ahead, left]);
  });

  it("boxed in on four sides: she keeps the body on her shoulder and the prompt says there is no room", () => {
    const { sim, body } = carrying(7, 0);
    const p = sim.player()!.position;
    const boxes = [
      container(sim, 9100, { x: p.x - 1.6, z: p.z + 0.45 }, { x: p.x + 1.6, z: p.z + 1.65 }),
      container(sim, 9101, { x: p.x - 1.6, z: p.z - 1.65 }, { x: p.x + 1.6, z: p.z - 0.45 }),
      container(sim, 9102, { x: p.x + 0.45, z: p.z - 0.44 }, { x: p.x + 1.65, z: p.z + 0.44 }),
      container(sim, 9103, { x: p.x - 1.65, z: p.z - 0.44 }, { x: p.x - 0.45, z: p.z + 0.44 }),
    ];
    sim.step(STAND);
    expect(sim.session.focusPrompt).toBe(NO_ROOM_PROMPT);
    sim.enqueue({ type: "drop-body" });
    sim.step(STAND);
    expect(sim.session.carrying).toBe(body.id);
    expect(body.downed?.carried).toBe(true);
    walkClear(sim, input({ moveZ: -1 }), boxes);
    walkClear(sim, input({ moveX: 1 }), boxes);
    // A way out: the prompt offers the drop again, and the body lands outside the rest.
    sim.world.remove(boxes[2]!);
    sim.step(STAND);
    expect(sim.session.focusPrompt).toBe(DROP_PROMPT);
    dropClear(sim, body, [boxes[0]!, boxes[1]!, boxes[3]!]);
  });

  it("in a 1.25 m corridor, facing its wall: the body lies along it, beside her, and she walks clear", () => {
    const { sim, body } = carrying(7, 0);
    const p = { ...sim.player()!.position };
    const walls = [
      container(sim, 9100, { x: p.x - 6, z: p.z + 0.45 }, { x: p.x + 6, z: p.z + 0.75 }),
      container(sim, 9101, { x: p.x - 6, z: p.z - 1.1 }, { x: p.x + 6, z: p.z - 0.8 }),
    ];
    dropClear(sim, body, walls);
    besideHer(sim, body);
    expect(Math.abs(body.position.z - p.z)).toBeLessThan(0.05);
    for (const frame of [input({ moveX: 1 }), input({ moveX: -1 }), input({ moveZ: 1 }), input({ moveZ: -1 })]) walkClear(sim, frame, walls);
  });

  // The verifier's probes: a wall ahead and a thin one (6 cm) just behind her back.
  for (const [ahead, behind] of [
    [0.8, -0.39],
    [0.85, -0.385],
    [1.0, -0.4],
  ] as const) {
    for (const frame of [{ moveX: 1 }, { moveX: -1 }, { moveZ: 1 }, { moveZ: -1 }, { moveX: 1, moveZ: -1 }]) {
      it(`walls ${ahead} m ahead and ${behind} m behind, then ${JSON.stringify(frame)}: she stays out of both`, () => {
        const { sim, body } = carrying(7, 0);
        const p = { ...sim.player()!.position };
        const walls = [
          container(sim, 9100, { x: p.x - 6, z: p.z + ahead }, { x: p.x + 6, z: p.z + ahead + 0.3 }),
          container(sim, 9101, { x: p.x - 6, z: p.z + behind - 0.06 }, { x: p.x + 6, z: p.z + behind }),
        ];
        sim.enqueue({ type: "drop-body" });
        sim.step(STAND);
        expect(sim.session.carrying).toBeNull();
        besideHer(sim, body);
        for (const w of walls) expect(sunk(w, body.position, body.body!.radius)).toBeLessThanOrEqual(0);
        walkClear(sim, input(frame), walls);
      });
    }
  }
});
