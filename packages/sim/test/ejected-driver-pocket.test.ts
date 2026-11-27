import { describe, expect, it } from "vitest";
import { World } from "miniplex";
import type { Entity } from "../src/world/components";
import type { SimContext } from "../src/world/context";
import { stepEjectedDrivers } from "../src/world/vehicle/ejected-driver";

/*
 * A taken car's driver running off out of a walled pocket by the pavement (G-990): by Lubartowska
 * (643; 506) a driver thrown onto the pavement ran into the gap between two houses, none of his
 * five ways had 8 m clear, and picked anew each second he ran to and fro between its ends.
 */

const still = { position: { x: 0, y: 0, z: 0 }, prevPosition: { x: 0, y: 0, z: 0 }, yaw: 0, prevYaw: 0, pitch: 0 };
const box = (x0: number, z0: number, x1: number, z1: number) => ({ min: { x: x0, y: 0, z: z0 }, max: { x: x1, y: 3, z: z1 } });

/** A pocket 2 m wide from z −4 to 6, walled round but for a gap in its east wall at z 3–5. */
const pocket = (): { world: World<Entity>; ctx: SimContext } => {
  const world = new World<Entity>();
  const walls = [box(-2, -5, -1, 7), box(1, -5, 2, 3), box(1, 5, 2, 7), box(-2, 6, 2, 7), box(-2, -5, 2, -4)];
  walls.forEach((solid, k) => world.add({ ...still, id: 10 + k, solid }));
  const ctx = { world, dt: 1 / 60, streamer: { streamedOut: new Set<number>() } } as unknown as SimContext;
  return { world, ctx };
};

describe("a taken car's driver out of a walled pocket (G-990)", () => {
  it("runs out through its gap, without turning to and fro", () => {
    const { world, ctx } = pocket();
    // Up and off at a run in the pocket's middle; the car (heading north, his left the west) stood 1 m east of him.
    const d = world.add({ ...still, id: 1, ejected: { phase: "run", t: 0, yaw: 0, spot: { x: 1, y: 0, z: 0 }, floor: 0 } });
    let far = 0;
    let turns = 0;
    let last: { x: number; z: number } | undefined;
    for (let i = 0; i < 60 * 8 && world.has(d); i++) {
      stepEjectedDrivers(ctx);
      far = Math.max(far, Math.hypot(d.position.x, d.position.z));
      const away = d.ejected?.away;
      if (away && last && away.x * last.x + away.z * last.z < -0.5) turns++;
      last = away;
    }
    // Out of the pocket (its far corner lies 6.1 m off), east past its wall.
    expect(far).toBeGreaterThan(8);
    expect(d.position.x).toBeGreaterThan(2);
    expect(turns).toBe(0);
  });
});
