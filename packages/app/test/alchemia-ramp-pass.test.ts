import { describe, expect, it } from "vitest";
import { type AudioPort, EMPTY_INPUT } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { createUiStore } from "@seki/ui";
import { P1_PIECES, P1_RAMP, TRAFFIC_ROUTES, type Entity, p1RampY } from "@seki/sim";
import { FakeRender, teleport } from "./story-helpers";
import { GameSession } from "../src/game-session";

/**
 * A car of Alchemia's ramp held up by Seki on its lane (ADR-0074 §4, review of #399): it goes
 * round her only as far as the ramp's walls leave room, else it waits and sounds the horn; its
 * body never goes into the ramp's walls or P-1's, and once she steps off it drives on.
 */

const audio: AudioPort = { play() {}, stopAll() {} };
const IN = TRAFFIC_ROUTES.length - 2;
const OUT = TRAFFIC_ROUTES.length - 1;
const AXIS = (P1_RAMP.minX + P1_RAMP.walk) / 2;
const DOWN = AXIS + 1.6;
const UP = AXIS - 1.6;

type Car = Entity & { vehicle: NonNullable<Entity["vehicle"]> };

/** Arc length along a polyline of its point nearest (x, z). */
const arcAt = (pts: readonly (readonly [number, number])[], x: number, z: number): number => {
  let [best, at, acc] = [Infinity, 0, 0];
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1]!, pts[i]!];
    const [dx, dz] = [b[0] - a[0], b[1] - a[1]];
    const len = Math.hypot(dx, dz);
    const t = len > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (len * len))) : 0;
    const d = Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z);
    if (d < best) [best, at] = [d, acc + len * t];
    acc += len;
  }
  return at;
};

const start = () => {
  const session = new GameSession({
    render: new FakeRender(),
    audio,
    persistence: new SavePersistence(new MemorySaveStore()),
    ui: createUiStore(),
    story: STORY_SOURCE,
    seed: () => 77,
    now: () => new Date(2026, 9, 27),
    traffic: "high",
  });
  session.newGame();
  // The morning's rush hour: a car on each of the ramp's routes.
  session.sim.enqueue({ type: "wait", minutes: 11 * 60 });
  session.step(EMPTY_INPUT);
  for (const g of [...session.sim.world.with("ai")]) session.sim.world.remove(g);
  return session;
};

/** P-1's solids a car's body could meet (its walls, the ramp's, the cabins', the fittings): not the floors, the roofs or the cabins' shutters (they rise before it). */
const SOLIDS = P1_PIECES.filter((p) => p.solid && p.kind !== "shutter" && p.kind !== "floor" && p.kind !== "roof").map((p) => p.box);

/** Points of a car's footprint, every quarter metre, that lie in one of P-1's solids at its body's height. */
const inSolid = (c: Car): string[] => {
  const [tx, tz] = [Math.sin(c.yaw), Math.cos(c.yaw)];
  const { l, w } = c.vehicle.half;
  const out: string[] = [];
  for (let a = -l; a <= l + 1e-6; a += 0.25)
    for (let b = -w; b <= w + 1e-6; b += 0.25) {
      const [x, z] = [c.position.x + tx * a + tz * b, c.position.z + tz * a - tx * b];
      const hit = SOLIDS.find((s) => x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1 && s.y1 > c.position.y + 0.3 && s.y0 < c.position.y + 1.3);
      if (hit) out.push(`${x.toFixed(2)},${z.toFixed(2)} in ${hit.x0}..${hit.x1}`);
    }
  return out;
};

describe("a car of Alchemia's ramp held up by Seki on its lane", () => {
  // Her heading: at z 8 facing the ramp's foot she sees all its way up from the north cabin, so no car comes into being
  // there and drives up to her (none in 50 s since C7); one comes behind her back instead, as she faces up the ramp.
  // The route's index stays out of the test's name: it moves whenever the city gets lanes (the Podzamcze
  // row of 23.11 moved it), and the time gate would take the test for a new one each time.
  it.each([
    ["up", UP + 0.4, 4.5, 0, OUT],
    ["up", UP - 0.6, 8, Math.PI, OUT],
    ["up", UP + 1.2, 6, 0, OUT],
    ["down", DOWN, 6, 0, IN],
    ["down", DOWN + 0.8, 8, 0, IN],
    ["down", DOWN - 1, 4, 0, IN],
  ] as const)("on the %s lane, at x %f, z %f: round her within the walls or waits, then on", (_lane, x, z, yaw, route) => {
    const session = start();
    teleport(session, x, z, yaw, 0, p1RampY(z));
    const r = TRAFFIC_ROUTES[route]!;
    const sHer = arcAt(r.points, x, z);
    const walls: string[] = [];
    /**
     * Each of the route's cars (two since C7) on its own: where it was the step before, whether it came up from behind her
     * and its steps within 8 m of her. One `find` over the world followed whichever of them was last in its array, which
     * changed with every entity taken out (the same poses gave 310 steps by her or 45), and one car's coming up from behind
     * with the other's being past her made a pass neither drove.
     */
    const cars = new Map<number, { last: number; behind: boolean; near: number }>();
    let near = 0;
    let passed = false;
    const watch = (tag: string) => {
      for (const c of session.sim.world.with("vehicle")) {
        if (c.vehicle.route !== route) continue;
        const seen = cars.get(c.id) ?? { last: -Infinity, behind: false, near: 0 };
        cars.set(c.id, seen);
        walls.push(...inSolid(c).map((h) => `${tag}: ${h}`));
        // A car round to its route's start again is a new one: it has to come up from behind her.
        if (c.vehicle.s < seen.last - 5) seen.behind = false;
        seen.last = c.vehicle.s;
        if (c.vehicle.s < sHer - 3) seen.behind = true;
        if (seen.behind && c.vehicle.s > sHer + 3) passed = true;
        if (Math.hypot(c.position.x - x, c.position.z - z) >= 8) continue;
        seen.near++;
        near++;
      }
    };
    // Until a car has gone round her (up from behind her and on past) or stood by her for 8 s (waiting), at most 50 s: the
    // state, not the clock (ADR-0046); the steps after it were the other car doing the same.
    for (let i = 0; i < 60 * 50 && !passed && ![...cars.values()].some((c) => c.near >= 60 * 8); i++) {
      session.step(EMPTY_INPUT);
      // Without the walkers and gangers T0's chunks bring in at the first step: no car gives them way here (every car's
      // pose and hers at every step the same with them and without), and their minds and steps were a third of the time.
      if (i === 0) for (const b of [...session.sim.world.with("body")]) if (!b.player) session.sim.world.remove(b);
      watch(`${i}`);
    }
    expect(near, "the car came up to her").toBeGreaterThan(0);
    // She steps off onto T0: the car drives on past where she stood.
    teleport(session, 404, 8, 0);
    for (let i = 0; i < 60 * 15 && !passed; i++) {
      session.step(EMPTY_INPUT);
      watch(`after ${i}`);
    }
    expect(walls).toEqual([]);
    expect(passed, "the car drove on past her place").toBe(true);
  });
});
