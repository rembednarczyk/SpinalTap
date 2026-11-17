import { describe, expect, it } from "vitest";
import { GroundField, Simulation, gangerEntity } from "../src";
import { offTheBank } from "../src/systems/bank";
import { STEP_HEIGHT } from "../src/systems/movement-system";
import { makeDeck } from "../src/world/deck";
import { BRIDGE_DECKS } from "../src/content/lublin/decks";
import { WORLD_CHUNKS } from "../src/content/world-map";
import { input, teleportPlayer } from "./helpers";
import { gridOf } from "./terrain-world";

type P = { readonly x: number; readonly z: number };

/**
 * A small floor (G-903): level terrain a metre under a bridge's deck at y = 0, no room under it,
 * its long sides on the skew (45°), so a step past them lands where the slope over half a metre
 * is the deck's, level. West of x = 0 the terrain rises to the deck's height: its abutment.
 */
const floor = (): GroundField => {
  const terrain = gridOf(-4, -4, 0.05, 241, 241, (x) => (x < 0 ? 0 : -1));
  const deck = makeDeck([0, 0, 6, 6, 6, 8, 0, 2], [0, 1, 6, 7], () => 0);
  return new GroundField([{ bounds: { minX: -4, maxX: 8, minZ: -4, maxZ: 8 }, terrain, decks: [deck] }]);
};

/** The highest rise of the feet in one step walking from `o` along `d` by steps of `step`, `n` of them, by the movement's own rule. */
const walk = (field: GroundField, o: P, d: P, step: number, n: number) => {
  let [at, feet, rise] = [o, field.heightAt(o.x, o.z, -Infinity), 0];
  for (let i = 0; i < n; i++) {
    const to = offTheBank(field, { x: at.x, y: feet, z: at.z }, at.x + d.x * step, at.z + d.z * step, feet);
    const h = field.heightAt(to.x, to.z, feet + STEP_HEIGHT);
    rise = Math.max(rise, h - feet);
    [at, feet] = [to, h];
  }
  return { at, feet, rise };
};

/** The kurator's sweep (G-903): how far out from a side, how long a step, at what angle to it. */
const FULL = { offs: [0.05, 0.15, 0.3, 0.6], steps: [0.03, 0.06, 0.12, 0.25], angs: [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2], from: 1 };

/** Every side of the deck walked at from beside it, along it every 25 cm from `sweep.from` metres off its ends. */
const sweepSides = (field: GroundField, ring: readonly P[], keep: (a: P, b: P) => boolean, sweep = FULL) => {
  const over: string[] = [];
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length]!;
    if (!keep(a, b)) return;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const [nx, nz] = [(b.z - a.z) / len, (a.x - b.x) / len];
    for (let s = sweep.from; s < len - sweep.from; s += 0.25)
      for (const off of sweep.offs)
        for (const step of sweep.steps)
          for (const ang of sweep.angs) {
            const o = { x: a.x + ((b.x - a.x) * s) / len + nx * off, z: a.z + ((b.z - a.z) * s) / len + nz * off };
            const d = { x: -nx * Math.cos(ang) + nz * Math.sin(ang), z: -nx * Math.sin(ang) - nz * Math.cos(ang) };
            const { rise } = walk(field, o, d, step, Math.ceil((off + 0.4) / step));
            if (!(rise <= STEP_HEIGHT)) over.push(`(${o.x.toFixed(2)}, ${o.z.toFixed(2)}) step ${step} at ${ang}: +${rise.toFixed(2)}`);
          }
  });
  return over;
};

describe("the side of a bridge's deck more than a step over the terrain beside it (G-903)", () => {
  const field = floor();
  const ring = [
    { x: 0, z: 0 },
    { x: 6, z: 6 },
    { x: 6, z: 8 },
    { x: 0, z: 2 },
  ];

  it("is a wall to feet on the terrain beside it, however level the deck past its edge", () => {
    // The long sides, out of the deck's ring both ways (its winding left open), a metre short of
    // their ends: the abutment's terrain is a bank of its own there.
    const skew = (a: P, b: P) => Math.abs(b.x - a.x) > 1;
    expect(sweepSides(field, ring, skew)).toEqual([]);
    expect(sweepSides(field, [...ring].reverse(), skew)).toEqual([]);
  });

  it("the feet slide along it, they do not stick to it", () => {
    // Beside the south-east side, a walk 0.4 rad off square into it at a walker's step of 60 Hz.
    const n = { x: Math.SQRT1_2, z: -Math.SQRT1_2 };
    const o = { x: 3 + n.x * 0.05, z: 3 + n.z * 0.05 };
    const d = { x: -n.x * Math.cos(0.4) + n.z * Math.sin(0.4), z: -n.x * Math.sin(0.4) - n.z * Math.cos(0.4) };
    const { at, feet } = walk(field, o, d, 0.08, 20);
    expect(feet).toBeCloseTo(-1, 6);
    expect(Math.abs((at.x - o.x) * Math.SQRT1_2 + (at.z - o.z) * Math.SQRT1_2)).toBeGreaterThan(0.4);
  });

  it("but onto the deck from its end, level with the terrain at its abutment, the feet go as before", () => {
    const { at, feet, rise } = walk(field, { x: -1, z: 0 }, { x: Math.SQRT1_2, z: Math.SQRT1_2 }, 0.08, 60);
    expect(at.x).toBeGreaterThan(2);
    expect(feet).toBeCloseTo(0, 6);
    expect(rise).toBeLessThanOrEqual(STEP_HEIGHT);
  });
});

/** The highest rise of the feet in a step on the ground over `frames` steps of the simulation, calling `each` before each. */
const highestRise = (sim: Simulation, e: { position: { y: number }; fall?: number }, frames: number, each: () => void, frame = input()) => {
  let rise = 0;
  for (let f = 0; f < frames; f++) {
    each();
    const [y, air] = [e.position.y, e.fall !== undefined];
    sim.step(frame);
    if (!air && e.fall === undefined) rise = Math.max(rise, e.position.y - y);
  }
  return rise;
};

describe("by the sides of the bridges in Lublin, with every collider (G-903)", () => {
  const sim = Simulation.create({ seed: 3 });
  const ground = () => sim.streamer.ground;
  const put = (at: P, yaw: number) => {
    teleportPlayer(sim, { x: at.x, y: ground().heightAt(at.x, at.z, -Infinity), z: at.z }, yaw);
    sim.step();
    teleportPlayer(sim, { x: at.x, y: ground().heightAt(at.x, at.z, -Infinity), z: at.z }, yaw);
  };

  it("no feet get onto a bridge's deck more than a step up from beside it or under it, anywhere", () => {
    // The kurator's sweep thinned out (305 such steps of 1 007 328 before): both ways out of every side, near its ends too.
    const field = new GroundField(WORLD_CHUNKS, WORLD_CHUNKS.flatMap((c) => c.cuts ?? []), WORLD_CHUNKS.flatMap((c) => c.vaults ?? []));
    const sweep = { offs: [0.05, 0.3], steps: [0.06, 0.25], angs: [0, 0.8, -0.8], from: 0.1 };
    const over: string[] = [];
    for (const [chunk, decks] of BRIDGE_DECKS)
      for (const d of decks.filter((e) => e.flight !== true))
        for (const ring of [d.ring, [...d.ring].reverse()]) over.push(...sweepSides(field, ring, () => true, sweep).map((s) => `${chunk} ${s}`));
    expect(over).toEqual([]);
  }, 60_000);

  it("the player walking or running into a side from the terrain under it stays on the terrain", () => {
    // The viaduct of Zamkowa's eastern deck (podzamcze-1-0) and the bridge of Lutosławskiego (nabrzeze-0-1): 2 m up in one step.
    const p = sim.player()!;
    const over: string[] = [];
    for (const [o, d] of [
      [{ x: 752.41, z: 176.91 }, { x: 0.084, z: 0.996 }],
      [{ x: 752.41, z: 176.91 }, { x: 0.466, z: 0.885 }],
      [{ x: 2446.51, z: 436.19 }, { x: -0.616, z: 0.788 }],
    ] as const)
      for (const sprint of [false, true])
        for (const back of [0, 0.02, 0.04, 0.06]) {
          put({ x: o.x - d.x * back, z: o.z - d.z * back }, Math.atan2(d.x, d.z));
          const rise = highestRise(sim, p, 30, () => {}, input({ moveZ: 1, sprint }));
          if (rise > STEP_HEIGHT) over.push(`(${o.x}, ${o.z}) ${sprint ? "running" : "walking"} from ${back} m back: +${rise.toFixed(2)}`);
        }
    expect(over).toEqual([]);
  }, 60_000);

  it("nor does a fighter knocked against the side of Zamkowa's causeway past its walls get onto it", () => {
    // A knockback (or a dash) of 0.25 m a step towards the causeway's deck (stare-miasto-1-1), by the walls w294098689/690.
    const [o, d] = [{ x: 739.11, z: 157.78 }, { x: -0.351, z: -0.936 }];
    put({ x: o.x - 6, z: o.z + 2 }, 0);
    const g = gangerEntity(9001, { key: "g903", position: { x: o.x, y: ground().heightAt(o.x, o.z, -Infinity), z: o.z }, yaw: 0 }, null, 200, "stare-miasto-1-1", undefined, "hebi_brawler");
    delete g.ai;
    sim.world.add(g);
    const rise = highestRise(sim, g, 10, () => (g.velocity = { x: d.x * 15, y: 0, z: d.z * 15 }));
    sim.world.remove(g);
    expect(rise).toBeLessThanOrEqual(STEP_HEIGHT);
  });

  it("feet in the cellar under the deck of Zamkowa's viaduct stay where they are, never NaN", () => {
    const o = { x: 735.4, z: 165.56 };
    const { at } = walk(ground(), o, { x: -0.381, z: -0.925 }, 0.25, 4);
    expect(Number.isFinite(at.x) && Number.isFinite(at.z)).toBe(true);
  });
});
