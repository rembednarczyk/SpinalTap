import { describe, expect, it } from "vitest";
import { ALCHEMIA_CHUNK, ALCHEMIA_LIFT, ALCHEMIA_LIFT_PROPS, ALCHEMIA_LIFT_SITE, ALCHEMIA_MODULES, ALCHEMIA_PROPS, ALCHEMIA_TERRACE, GRAVITY, JUMP_SPEED, MANTLE_REACH, Simulation, WORLD_CHUNKS, alchemiaPoint, gangerEntity, screenCorners } from "../src";
import { surfaceY } from "../src/content/lublin/terrain";
import { STEP_HEIGHT } from "../src/systems/movement-system";
import { input, run, teleportPlayer } from "./helpers";

/**
 * The lift of Alchemia to the hall's roof (G-284, G-289): the shaft stands on its site, the cage
 * serves the paving and the roof's back slab, its gates guard the shaft, and the bridge and the roof
 * terrace are fenced so that nobody walking, running or jumping comes off them.
 */

type Pt = { readonly x: number; readonly z: number };

const hall = ALCHEMIA_MODULES[0]!;
const L = ALCHEMIA_LIFT;
const [GROUND, TOP] = L.levels;
const C = L.centre;
/** Steps of a ride between the levels at 2.5 m/s (ADR-0020), and a few for the gate. */
const RIDE = Math.ceil(((TOP - GROUND) / 2.5) * 60) + 15;
const lift = (sim: Simulation) => sim.world.with("elevator", "solid").entities.find((e) => e.elevator.key === L.key)!;

/** True when a point lies in the convex polygon (either winding). */
const insideConvex = (p: Pt, poly: readonly Pt[]): boolean => {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const s = Math.sign((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x));
    if (s !== 0 && sign !== 0 && s !== sign) return false;
    if (s !== 0) sign = s;
  }
  return true;
};

/** A world with the player at `p` on floor `y`, its chunk streamed in, nobody else about. */
const at = (p: Pt, y: number, yaw = 0): Simulation => {
  const sim = Simulation.create({ seed: 3 });
  teleportPlayer(sim, { x: p.x, y, z: p.z }, yaw);
  run(sim, 2);
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  teleportPlayer(sim, { x: p.x, y, z: p.z }, yaw);
  run(sim, 2);
  return sim;
};

/** Walks towards `to`, turning to it each step, `n` steps (sprinting and jumping when asked). */
const walkTo = (sim: Simulation, to: Pt, n: number, how: { sprint?: boolean; jump?: boolean; phase?: number } = {}): void => {
  const p = sim.player()!;
  for (let i = 0; i < n; i++) {
    p.yaw = Math.atan2(to.x - p.position.x, to.z - p.position.z);
    sim.step(input({ moveZ: 1, sprint: how.sprint ?? false, jump: (how.jump ?? false) && (i + 13 * (how.phase ?? 0)) % 40 === 0 }));
  }
};

/**
 * Jumps at a shut gate from `from` (on floor `y`), facing `yaw` turned 0..75° either way every 15°,
 * from its middle and 0.6 m either side along it (`along`: the gate's direction), as a run at it
 * would (G-289, round 2: a slanting jump pulled her up onto a gate's top, and from there over the
 * screens). Returns the highest and the lowest feet seen over each try, over the floor.
 */
const jumpsAtGate = (sim: Simulation, from: Pt, y: number, yaw: number, along: Pt): { high: number; low: number; worst: string } => {
  const p = sim.player()!;
  let high = -Infinity;
  let low = Infinity;
  let worst = "";
  for (const side of [-0.6, 0, 0.6]) {
    for (let deg = 0; deg <= 75; deg += 15) {
      for (const sign of deg === 0 ? [1] : [1, -1]) {
        teleportPlayer(sim, { x: from.x + along.x * side, y, z: from.z + along.z * side }, yaw);
        delete p.mantle;
        delete p.fall;
        p.velocity = { x: 0, y: 0, z: 0 };
        run(sim, 2);
        for (let i = 0; i < 60; i++) {
          p.yaw = yaw + (sign * deg * Math.PI) / 180;
          sim.step(input({ moveZ: 1, jump: i === 8 || i === 40 }));
          if (p.position.y - y > high) worst = `side ${side}, ${sign * deg}°, step ${i}`;
          high = Math.max(high, p.position.y - y);
          low = Math.min(low, p.position.y - y);
        }
      }
    }
  }
  return { high, low, worst };
};

const terraceMid = (): Pt => {
  const c = ALCHEMIA_TERRACE.corners;
  return { x: c.reduce((s, q) => s + q.x, 0) / c.length, z: c.reduce((s, q) => s + q.z, 0) / c.length };
};

describe("the lift of Alchemia to the hall's roof (G-284, G-289)", () => {
  it("stands on its site behind the hall: a shaft square to the world inside the 3 m square kept for it", () => {
    const fx = Math.sin(ALCHEMIA_LIFT_SITE.yaw);
    const fz = Math.cos(ALCHEMIA_LIFT_SITE.yaw);
    const out = L.half + L.wall;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      const dx = C.x + sx * out - ALCHEMIA_LIFT_SITE.centre.x;
      const dz = C.z + sz * out - ALCHEMIA_LIFT_SITE.centre.z;
      expect(Math.abs(dx * fz - dz * fx)).toBeLessThanOrEqual(ALCHEMIA_LIFT_SITE.size / 2 + 1e-6);
      expect(Math.abs(dx * fx + dz * fz)).toBeLessThanOrEqual(ALCHEMIA_LIFT_SITE.size / 2 + 1e-6);
    }
    // Its bottom level a step over the paving at its door, its top on the roof's back slab, under the name's top.
    const door = surfaceY(C.x, C.z + L.half + 0.9);
    expect(GROUND - door).toBeGreaterThan(0);
    expect(GROUND - door).toBeLessThan(STEP_HEIGHT);
    expect(TOP).toBeCloseTo(ALCHEMIA_TERRACE.slab, 6);
    expect(L.cap - hall.floor).toBeLessThan(15);
  });

  it("is solid in the plot's chunk after the hall and the stalls, so no id before it moves", () => {
    const chunk = WORLD_CHUNKS.find((c) => c.id === ALCHEMIA_CHUNK)!;
    const rooms = chunk.rooms!;
    const from = rooms.indexOf(ALCHEMIA_PROPS[ALCHEMIA_PROPS.length - 1]!) + 1;
    expect(rooms.slice(from, from + ALCHEMIA_LIFT_PROPS.length)).toEqual([...ALCHEMIA_LIFT_PROPS]);
    expect(ALCHEMIA_LIFT_PROPS.filter((p) => p.mechanism?.kind === "platform")).toHaveLength(1);
    expect(ALCHEMIA_LIFT_PROPS.filter((p) => p.mechanism?.kind === "gate")).toHaveLength(2);
    expect(ALCHEMIA_LIFT_PROPS.filter((p) => p.mechanism?.kind === "button")).toHaveLength(2);
  });

  it("fences the bridge and the terrace out of a jump's and a pull-up's reach, the shaft over a jump's", () => {
    const jump = (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY);
    for (const s of L.screens) expect(s.top - TOP, `${s.a.x},${s.a.z}`).toBeGreaterThan(jump + MANTLE_REACH);
    expect(L.head - TOP).toBeGreaterThan(jump + MANTLE_REACH);
    for (const g of L.gates) expect(g.y1 - g.y0).toBeGreaterThan(jump + STEP_HEIGHT);
    // The terrace for the stages to come: some 15 m² inside its screens.
    const c = ALCHEMIA_TERRACE.corners;
    const area = Math.abs(c.reduce((s, p, i) => s + p.x * c[(i + 1) % c.length]!.z - c[(i + 1) % c.length]!.x * p.z, 0)) / 2;
    expect(area).toBeGreaterThan(14.5);
    for (const s of L.screens) expect(screenCorners(s)).toHaveLength(4);
  });

  it("carries her from the paving up to the roof and back down, its gates opening only where the cage is", () => {
    const door = { x: C.x, z: C.z + L.half + 1.4 };
    const sim = at(door, surfaceY(door.x, door.z), Math.PI);
    expect(lift(sim).solid.max.y).toBeCloseTo(GROUND, 6);
    walkTo(sim, C, 90);
    const p = sim.player()!;
    expect(p.position.y).toBeCloseTo(GROUND, 3);
    run(sim, 2);
    expect(sim.session.focusPrompt).toBe("prompt.elevator");
    sim.step(input({ interact: true }));
    run(sim, RIDE);
    expect(lift(sim).solid.max.y).toBeCloseTo(TOP, 6);
    expect(p.position.y).toBeCloseTo(TOP, 3);
    run(sim, 60);
    // Off south over the bridge onto the terrace.
    walkTo(sim, terraceMid(), 240);
    expect(insideConvex(p.position, ALCHEMIA_TERRACE.corners)).toBe(true);
    expect(p.position.y).toBeGreaterThan(ALCHEMIA_TERRACE.roof - 0.05);
    const hp = p.health!.current;
    // Back to the cage and down.
    walkTo(sim, C, 240);
    expect(Math.hypot(p.position.x - C.x, p.position.z - C.z)).toBeLessThan(0.5);
    run(sim, 2);
    sim.step(input({ interact: true }));
    run(sim, RIDE);
    expect(lift(sim).solid.max.y).toBeCloseTo(GROUND, 6);
    expect(p.position.y).toBeCloseTo(GROUND, 3);
    run(sim, 60);
    walkTo(sim, door, 120);
    expect(Math.hypot(p.position.x - door.x, p.position.z - door.z)).toBeLessThan(0.4);
    expect(p.health!.current).toBe(hp);
  });

  it("keeps the shaft shut: the top gate while the cage is down, the bottom one while it is up", () => {
    // On the bridge, the cage at the paving: running and jumping at the shaft stops at the gate.
    const bridge = { x: C.x, z: C.z - L.half - 1 };
    const top = at(bridge, TOP);
    walkTo(top, C, 180, { sprint: true, jump: true });
    const p = top.player()!;
    expect(p.position.z).toBeLessThan(C.z - L.half - L.wall);
    expect(p.position.y).toBeGreaterThan(TOP - 0.05);
    // The cage up: from the paving nobody walks or jumps into the pit.
    const door = { x: C.x, z: C.z + L.half + 1.4 };
    const low = at(door, surfaceY(door.x, door.z), Math.PI);
    const cage = lift(low);
    cage.elevator.target = 1;
    run(low, RIDE);
    expect(cage.solid.max.y).toBeCloseTo(TOP, 6);
    walkTo(low, C, 180, { sprint: true, jump: true });
    expect(low.player()!.position.z).toBeGreaterThan(C.z + L.half + L.wall);
    // And nobody under it, so it comes back down when called.
    cage.elevator.target = 0;
    run(low, RIDE);
    expect(cage.solid.max.y).toBeCloseTo(GROUND, 6);
  });

  it("gives no foothold on a shut gate: no pull-up onto either, so nobody gets over the screens from the bridge (G-289)", () => {
    const out = L.half + L.wall;
    // The top gate, the cage below: from the bridge, then on to a jump at the screens.
    const top = at({ x: C.x, z: C.z - out - 0.9 }, TOP);
    const up = jumpsAtGate(top, { x: C.x, z: C.z - out - 0.88 }, TOP, 0, { x: 1, z: 0 });
    expect(up.high, `top gate: ${up.worst}`).toBeLessThan(1.5);
    expect(up.low, "off the bridge").toBeGreaterThan(-0.05);
    // The bottom gate, the cage up: from the sill and the paving before it.
    const low = at({ x: C.x, z: C.z + out + 1 }, GROUND, Math.PI);
    lift(low).elevator.target = 1;
    run(low, RIDE);
    const down = jumpsAtGate(low, { x: C.x, z: C.z + out + 0.88 }, GROUND, Math.PI, { x: 1, z: 0 });
    expect(down.high, `bottom gate: ${down.worst}`).toBeLessThan(1.5);
  });

  it("lets nobody off the terrace or the bridge, walking, running or jumping at any edge", () => {
    const mid = terraceMid();
    const c = ALCHEMIA_TERRACE.corners;
    const out = L.half + L.wall;
    // Aims past every edge and corner of the terrace and both sides of the bridge.
    const aims: Pt[] = [];
    for (let i = 0; i < c.length; i++) {
      const a = c[i]!;
      const b = c[(i + 1) % c.length]!;
      for (const t of [0, 0.25, 0.5, 0.75]) {
        const q = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
        aims.push({ x: mid.x + (q.x - mid.x) * 3, z: mid.z + (q.z - mid.z) * 3 });
      }
    }
    const runs: [Pt, Pt][] = [
      ...aims.map((to): [Pt, Pt] => [mid, to]),
      ...[{ x: C.x - 5, z: C.z - out - 0.9 }, { x: C.x + 5, z: C.z - out - 0.9 }, { x: C.x - 5, z: C.z - out - 2 }, { x: C.x + 5, z: C.z - out - 2.4 }].map((to): [Pt, Pt] => [{ x: C.x, z: C.z - out - 0.9 }, to]),
    ];
    // From inside each corner along both screens meeting there, past their ends: a run along a screen's line.
    const inset = (q: Pt): Pt => ({ x: q.x + (mid.x - q.x) * 0.2, z: q.z + (mid.z - q.z) * 0.2 });
    c.forEach((q, i) => {
      const a = inset(q);
      for (const n of [c[(i + 1) % c.length]!, c[(i + c.length - 1) % c.length]!]) {
        const b = inset(n);
        runs.push([b, { x: a.x + (a.x - b.x) * 0.5, z: a.z + (a.z - b.z) * 0.5 }]);
      }
    });
    runs.forEach(([from, to], k) => {
      const onBridge = from.z > C.z - out - 1;
      const sim = at(from, onBridge ? TOP : ALCHEMIA_TERRACE.roof);
      walkTo(sim, to, 150, { sprint: true, jump: true, phase: k % 3 });
      const p = sim.player()!.position;
      expect(p.y, `from ${from.x.toFixed(1)},${from.z.toFixed(1)} towards ${to.x.toFixed(1)},${to.z.toFixed(1)}`).toBeGreaterThan(ALCHEMIA_TERRACE.roof - 0.05);
    });
  }, 30_000);

  it("is no way up for the AI: a ganger after her at the cage's door stays on the paving when she rides up (ADR-0020)", () => {
    const sim = at(C, GROUND, Math.PI);
    const from = { x: C.x + 1, z: C.z + L.half + 3 };
    const g = gangerEntity(9001, { key: "lift-chaser", position: { x: from.x, y: surfaceY(from.x, from.z), z: from.z }, yaw: Math.PI }, null, 200, ALCHEMIA_CHUNK, undefined, "hebi_brawler");
    g.ai!.alerted = true;
    sim.world.add(g);
    const out = L.half + L.wall;
    let nearest = Infinity;
    let highest = -Infinity;
    const watch = (n: number) => {
      for (let i = 0; i < n; i++) {
        sim.step(i === 0 && n === RIDE ? input({ interact: true }) : input());
        highest = Math.max(highest, g.position.y);
        nearest = Math.min(nearest, Math.hypot(g.position.x - C.x, g.position.z - C.z));
        // Up to the door and the sill before it, never into the shaft: nobody calls a lift but the player.
        expect(Math.abs(g.position.x - C.x) < out && Math.abs(g.position.z - C.z) < out, `step ${i}`).toBe(false);
      }
    };
    // It comes for her at the door; she rides up from under its nose.
    watch(60);
    watch(RIDE);
    watch(120);
    expect(nearest).toBeLessThan(out + 1);
    expect(highest).toBeLessThan(GROUND + 0.5);
    expect(sim.player()!.position.y).toBeCloseTo(TOP, 3);
    expect(lift(sim).solid.max.y).toBeCloseTo(TOP, 6);
  });

  it("keeps the terrace off what the hall's model draws on its roof: the box in front of the name (0.7 m), the box and the overhang at its sides", () => {
    // The hall's frame (alchemia-props.glb, measured off its faces): x0, x1, z0, z1 of each, over the roof.
    const drawn = [
      [-0.85, 0.6, -0.25, 1.2],
      [-4.1, -2.15, -3.9, -2.05],
      [1.5, 2.7, -3.8, -2.6],
    ] as const;
    const fx = Math.sin(hall.yaw);
    const fz = Math.cos(hall.yaw);
    const inDrawn = (p: Pt) => {
      const dx = p.x - hall.x;
      const dz = p.z - hall.z;
      const x = -dx * fz + dz * fx;
      const z = dx * fx + dz * fz;
      return drawn.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
    };
    for (const [x, z] of [[-0.1, 1], [-0.8, 1], [0.6, 1], [-3, -3], [2, -3.2]] as const) {
      const sim = at(terraceMid(), ALCHEMIA_TERRACE.roof);
      const p = sim.player()!;
      const to = alchemiaPoint(hall, x, z);
      for (let i = 0; i < 120; i++) {
        p.yaw = Math.atan2(to.x - p.position.x, to.z - p.position.z);
        sim.step(input({ moveZ: 1 }));
        expect(inDrawn(p.position), `towards ${x},${z} step ${i}`).toBe(false);
      }
    }
  });

  it("lands the bridge on the roof's back slab, behind the drawn parapet, with no step taller than a step", () => {
    const sim = at({ x: C.x, z: C.z - L.half - 0.6 }, TOP);
    const p = sim.player()!;
    let last = p.position.y;
    let worst = 0;
    const to = terraceMid();
    for (let i = 0; i < 200; i++) {
      p.yaw = Math.atan2(to.x - p.position.x, to.z - p.position.z);
      sim.step(input({ moveZ: 1 }));
      worst = Math.max(worst, Math.abs(p.position.y - last));
      last = p.position.y;
    }
    expect(worst).toBeLessThan(STEP_HEIGHT);
    expect(insideConvex(p.position, ALCHEMIA_TERRACE.corners)).toBe(true);
    // The slab's back edge is the roof's, where the bridge comes in.
    const edge = alchemiaPoint(hall, -1, -4.55);
    expect(Math.abs(edge.z - L.bridge[1]!.z)).toBeLessThan(1);
  });
});
