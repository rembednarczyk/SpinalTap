import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, type Vec3 } from "@seki/core";
import {
  ALCHEMIA_CHUNK,
  ALCHEMIA_LIFT,
  ALCHEMIA_LIFT_NE,
  ALCHEMIA_NAV,
  ALCHEMIA_PROPS,
  ATRIUM,
  CORE_GOING,
  ESCALATORS,
  ESCALATOR_LANDINGS,
  MALL,
  MALL_FLOORS,
  MALL_LEVELS,
  MALL_RAIL,
  P1_DOORS,
  STAIR_CORES,
  Simulation,
  WORLD_NAV,
  beforeKeeper,
  coreRisers,
  gangerEntity,
  groundY,
  mallGlass,
  stairwell,
} from "../src";
import { prismsAt } from "../src/world/prism";
import { routeAcrossLevels } from "../src/world/nav";
import { EYE_HEIGHT, lineOfSight } from "../src/world/hitscan";
import { teleportPlayer } from "./helpers";

/*
 * Alchemia as a gallery round an atrium (ADR-0093 O1), measured on the simulation's own solids and
 * level graph: the atrium open from P0's floor to the sky, the slabs whole round it, balustrades on
 * its edges open only where an escalator lands, every floor reached from T1, T0 and P-1 by the
 * cores' stairs and the escalators, both lifts at every floor of theirs.
 */

const L = MALL_LEVELS;
const prisms = ALCHEMIA_PROPS.flatMap((p) => prismsAt(p.prisms ?? [], p.center));
const inside = (q: (typeof prisms)[number], x: number, z: number): boolean =>
  q.points.every((p, i) => {
    const n = q.points[(i + 1) % q.points.length]!;
    return (n.x - p.x) * (z - p.z) - (n.z - p.z) * (x - p.x) >= 0;
  });
const solidAt = (x: number, y: number, z: number): boolean => prisms.some((q) => y > q.bottom && y < q.top && inside(q, x, z));
/** The highest solid top at (x, z) within `reach` under `y`. */
const topUnder = (x: number, y: number, z: number, reach = 0.2): number | null => {
  let best: number | null = null;
  for (const q of prisms) if (q.top <= y + 1e-6 && q.top >= y - reach && inside(q, x, z)) best = Math.max(best ?? -Infinity, q.top);
  return best;
};
type R = { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number };
const within = (r: R, x: number, z: number, pad = 0): boolean => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
/** The escalators' lanes and landings in the atrium, balustrades included. */
const ESCALATOR_ZONE: R = { x0: ATRIUM.x0, x1: ATRIUM.x1, z0: ATRIUM.z0 - 0.1, z1: Math.max(...ESCALATORS.map((e) => e.lane.z1)) + 0.2 };
const shaft = (l: typeof ALCHEMIA_LIFT): R => ({ x0: l.centre.x - 1.3, x1: l.centre.x + 1.3, z0: l.centre.z - 1.3, z1: l.centre.z + 1.3 });

/** The world with Alchemia's chunk loaded, nobody in it but the player. */
const loaded = (() => {
  let sim: Simulation | null = null;
  return (): Simulation => {
    if (sim) return sim;
    sim = Simulation.create({ seed: 5 });
    teleportPlayer(sim, { x: 418, y: groundY(418, 28) + 0.05, z: 28 });
    sim.step();
    for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
    return sim;
  };
})();

describe("the gallery's body round its atrium (ADR-0093 O1)", () => {
  it("keeps the atrium open from P0's floor to the sky, but for the escalators along its south edge", () => {
    for (let x = ATRIUM.x0 + 0.2; x < ATRIUM.x1; x += 0.7) {
      for (let z = ATRIUM.z0 + 0.2; z < ATRIUM.z1; z += 0.7) {
        if (within(ESCALATOR_ZONE, x, z)) continue;
        for (let y = L.p0 + 2.5; y < L.roof + 6; y += 0.5) expect(solidAt(x, y, z), `${x.toFixed(1)},${y.toFixed(1)},${z.toFixed(1)}`).toBe(false);
      }
    }
  });

  it("lays every floor over P0 whole round the atrium: a slab under the feet everywhere but the atrium, the stairwells and the lifts' shafts", () => {
    const holes: R[] = [ATRIUM, ...STAIR_CORES.map(stairwell), shaft(ALCHEMIA_LIFT), shaft(ALCHEMIA_LIFT_NE)];
    for (const y of [L.p1, L.p2, L.p3, L.roof]) {
      let checked = 0;
      for (let x = MALL.x0 + 0.5; x < MALL.x1 - 0.4; x += 0.9) {
        for (let z = MALL.z0 + 0.5; z < MALL.z1 - 0.4; z += 0.9) {
          // The rounded north corners, the hall's stair house and its flight's hole under P1.
          if (holes.some((h) => within(h, x, z, 0.3)) || (z > MALL.z1 - 2.2 && (x < MALL.x0 + 2.2 || x > MALL.x1 - 2.2))) continue;
          if (y === L.p1 && x < 408 && z < 35) continue;
          checked++;
          expect(topUnder(x, y + 0.01, z), `${y}: ${x.toFixed(1)},${z.toFixed(1)}`).toBeCloseTo(y, 2);
        }
      }
      expect(checked).toBeGreaterThan(600);
    }
  });

  it("rails the atrium on every floor over P0 with a solid balustrade 1.1 m high, open only where an escalator lands", () => {
    for (const y of [L.p1, L.p2, L.p3, L.roof]) {
      const gaps = ESCALATOR_LANDINGS.filter((l) => Math.abs(l.y - y) < 0.01);
      let open = 0;
      let along = 0;
      const edge: [number, number][] = [];
      for (let x = ATRIUM.x0 + 0.25; x < ATRIUM.x1; x += 0.5) edge.push([x, ATRIUM.z0 - 0.06], [x, ATRIUM.z1 + 0.06]);
      for (let z = ATRIUM.z0 + 0.25; z < ATRIUM.z1; z += 0.5) edge.push([ATRIUM.x0 - 0.06, z], [ATRIUM.x1 + 0.06, z]);
      for (const [x, z] of edge) {
        along++;
        if (solidAt(x, y + MALL_RAIL - 0.05, z)) continue;
        open++;
        // Open only beside a landing at this floor.
        expect(
          gaps.some((l) => x > l.x0 - 0.5 && x < l.x1 + 0.5 && z > l.z0 - 0.5 && z < l.z1 + 0.5),
          `${y}: ${x},${z}`,
        ).toBe(true);
      }
      expect(open / along).toBeLessThan(0.1);
      expect(solidAt(ATRIUM.x0 + 5, y + MALL_RAIL + 0.05, ATRIUM.z1 + 0.06)).toBe(false);
    }
  });

  it("glazes P1..P3 all round with thin solids, open at P1's doors, the front's L2 and L3 the wall where they stand", () => {
    const panes = mallGlass().filter((p) => p.kind === "pane");
    expect(panes.every((p) => p.solid)).toBe(true);
    // Thin: a hand's breadth.
    for (const p of panes) expect(Math.min(p.box.x1 - p.box.x0, p.box.z1 - p.box.z0)).toBeLessThan(1.2);
    for (const y of [L.p1 + 1, L.p2 + 1, L.p3 + 1]) {
      // West, north and east faces glazed.
      expect(solidAt(MALL.x0 + 0.06, y, 45)).toBe(true);
      expect(solidAt(418, y, MALL.z1 - 0.06)).toBe(true);
      expect(solidAt(MALL.x1 - 0.06, y, 45)).toBe(true);
    }
    for (const d of P1_DOORS) {
      const [x, z] = [(d.gap.x0 + d.gap.x1) / 2, (d.lintel.z0 + d.lintel.z1) / 2];
      expect(solidAt(Math.min(Math.max(x, MALL.x0 + 0.06), MALL.x1 - 0.06), L.p1 + 1, z), `door ${x},${z}`).toBe(false);
    }
    // From T0's strip in through the main doors to the gallery; through the glass beside them, not.
    const sim = loaded();
    const eye = (p: Vec3) => ({ ...p, y: p.y + EYE_HEIGHT });
    expect(lineOfSight(sim.world, eye({ x: 420, y: groundY(420, 30.8), z: 30.8 }), eye({ x: 420, y: L.p1, z: 37 }))).toBe(true);
    expect(lineOfSight(sim.world, eye({ x: 428, y: groundY(428, 30.8), z: 30.8 }), eye({ x: 428, y: L.p1, z: 37 }))).toBe(false);
  });

  it("builds both cores' stairs to the rules (risers 0.15-0.18 m, treads 0.28-0.30 m, a landing every 13 risers at most) and the escalators' too", () => {
    for (const c of STAIR_CORES) {
      c.floors.slice(0, -1).forEach((y, i) => {
        const rise = c.floors[i + 1]! - y;
        const n = coreRisers(rise);
        expect(n).toBeLessThanOrEqual(13);
        expect(rise / (2 * n)).toBeGreaterThanOrEqual(0.15);
        expect(rise / (2 * n)).toBeLessThanOrEqual(0.18);
      });
      expect(CORE_GOING).toBeGreaterThanOrEqual(0.28);
      // Both lanes and the doors wide enough for an NPC's way (1.46 m) and the camera (1.2 m).
      expect((c.z1 - c.z0 - 0.1) / 2).toBeGreaterThanOrEqual(1.46);
      expect(c.door.a1 - c.door.a0).toBeGreaterThanOrEqual(1.46);
    }
    for (const e of ESCALATORS) {
      expect((e.to - e.from) / e.risers).toBeLessThanOrEqual(0.18);
      expect(e.going).toBeGreaterThanOrEqual(0.28);
      expect(e.lane.z1 - e.lane.z0).toBeGreaterThanOrEqual(1.46);
    }
  });
});

describe("the gallery's ways up (ADR-0093 O1)", () => {
  it("serves every floor with a lift: the hall's from P-2 to the roof, the north-east core's from P0 (O3; from P1 until then)", () => {
    expect(ALCHEMIA_LIFT.levels.slice(1)).toEqual([L.p0, ...MALL_FLOORS.slice(1)]);
    expect(ALCHEMIA_LIFT_NE.levels).toEqual(MALL_FLOORS);
    expect(ALCHEMIA_LIFT_NE.key).not.toBe(ALCHEMIA_LIFT.key);
    for (const l of [ALCHEMIA_LIFT, ALCHEMIA_LIFT_NE]) {
      // Nothing but the lift's own pieces in its shaft from its pit to its head: no slab across it.
      const s = { x0: l.centre.x - l.half + 0.05, x1: l.centre.x + l.half - 0.05, z0: l.centre.z - l.half + 0.05, z1: l.centre.z + l.half - 0.05 };
      for (let y = l.levels[0] + 0.3; y < l.head; y += 0.5) expect(solidAt((s.x0 + s.x1) / 2, y, (s.z0 + s.z1) / 2), `${l.key} ${y}`).toBe(false);
      // Each door a step out of its opening, on a floor.
      l.doors.forEach((d, i) => {
        if (d.y < L.p1 - 0.01) return;
        expect(topUnder(d.x, d.y + 0.01, d.z, 0.3) ?? groundY(d.x, d.z), `${l.key} door ${i}`).toBeCloseTo(d.y, 0);
      });
    }
  });

  it("stands every node of the gallery's graph on a floor", () => {
    for (const n of ALCHEMIA_NAV.nodes.filter((q) => /^alchemia-(g[0-9r]|core|sh)-/.test(q.id))) {
      const top = topUnder(n.at.x, n.at.y + 0.01, n.at.z, 0.3);
      // P0's are on the hall's floor, the ground dug out to it (its cut); those outside on the terrain.
      const ground = within(MALL, n.at.x, n.at.z) ? L.p0 : groundY(n.at.x, n.at.z);
      expect(top !== null || Math.abs(ground - n.at.y) < 0.3, n.id).toBe(true);
    }
  });

  it("leads from T1, T0 and P-1 to every floor and the roof", () => {
    const sim = loaded();
    const starts: [string, Vec3][] = [
      ["T1", { x: 416, y: groundY(416, 62), z: 62 }],
      ["T0", { x: 420, y: groundY(420, 30.6), z: 30.6 }],
      ["P-1", { x: 409, y: L.p0, z: 27 }],
    ];
    const goals: [string, Vec3][] = [
      // North of the fountain in the atrium (O3).
      ["P0", { x: 418, y: L.p0, z: 51 }],
      ["P1", { x: 426.5, y: L.p1, z: 50 }],
      ["P2", { x: 409.5, y: L.p2, z: 50 }],
      ["P3", { x: 426.5, y: L.p3, z: 46 }],
      ["roof", { x: 418, y: L.roof, z: 52 }],
    ];
    for (const [a, from] of starts) for (const [b, to] of goals) expect(routeAcrossLevels(sim.world, WORLD_NAV, from, to), `${a} to ${b}`).not.toBeNull();
  });

  it("takes the player up the escalators from P0 to P3, round the gallery and up the south-west core to the roof", () => {
    const sim = Simulation.create({ seed: 3 });
    const walk = (x: number, z: number, steps = 400) => {
      for (let i = 0; i < steps; i++) {
        const p = sim.player()!;
        if (Math.hypot(x - p.position.x, z - p.position.z) < 0.3) return;
        const want = Math.atan2(x - p.position.x, z - p.position.z);
        sim.step({ ...EMPTY_INPUT, moveZ: 1, sprint: true, lookYaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) });
      }
    };
    const [e1, e2, e3] = ESCALATORS as readonly [(typeof ESCALATORS)[number], (typeof ESCALATORS)[number], (typeof ESCALATORS)[number]];
    const za = (e1.lane.z0 + e1.lane.z1) / 2;
    const zb = (e2.lane.z0 + e2.lane.z1) / 2;
    teleportPlayer(sim, { x: e1.x0 + 0.8, y: L.p0, z: za }, -Math.PI / 2);
    sim.step();
    const at = () => sim.player()!.position;
    walk(416.3, za);
    expect(at().y).toBeCloseTo(L.p1, 1);
    walk(416.3, zb);
    walk(e2.x0 + e2.dir * 7.4, zb);
    expect(at().y).toBeCloseTo(L.p2, 1);
    walk(e3.x0 + 0.2, za);
    walk(416.3, za);
    expect(at().y).toBeCloseTo(L.p3, 1);
    // Off the landing onto the gallery, west to the core's door, up its last storey to the roof.
    const c = STAIR_CORES[0]!;
    const door = (c.door.a0 + c.door.a1) / 2;
    walk(416.3, 38.6);
    walk(door, 38.6);
    walk(door, c.z1 - 0.7);
    walk(c.x1 - 0.8, c.z1 - 0.7);
    walk(c.x1 - 0.8, c.z0 + 0.7);
    walk(c.x0 + 0.6, c.z0 + 0.7);
    expect(at().y).toBeCloseTo(L.roof, 1);
    walk(door, c.z1 + 1.2);
    expect(at().z).toBeGreaterThan(c.z1);
    expect(at().y).toBeCloseTo(L.roof, 1);
    // Over the roof's balustrade, no.
    walk(MALL.x0 - 2, c.z1 + 1.2, 120);
    expect(at().x).toBeGreaterThan(MALL.x0 - 0.3);
  });

  /** Seconds an alerted brawler at `from` takes to hurt the player at `to` or stand by her, or null. */
  const chase = (from: Vec3, to: Vec3, seconds: number, seed = 3): number | null => {
    const sim = Simulation.create({ seed });
    teleportPlayer(sim, to);
    sim.step();
    const p = sim.player()!;
    const g = gangerEntity(9001, { key: "mall-chaser", position: { ...from }, yaw: 0 }, null, 200, ALCHEMIA_CHUNK, undefined, "hebi_brawler");
    g.ai!.alerted = true;
    sim.world.add(g);
    const health = p.health!.current;
    for (let i = 0; i < 60 * seconds; i++) {
      sim.step();
      if (p.health!.current < health || (Math.hypot(g.position.x - p.position.x, g.position.z - p.position.z) < 2.5 && Math.abs(g.position.y - p.position.y) < 1)) return i / 60;
    }
    return null;
  };

  it("an alerted brawler in the hall gets to the player on P1 up the escalator", () => {
    // On P0's north walkway (before Kenta's counter until O3 took it up to the food hall on P3).
    expect(chase({ x: 420, y: L.p0, z: 51.6 }, { x: 434.9, y: L.p1, z: 50 }, 25)).not.toBeNull();
  });

  it("an alerted brawler on the roof gets down a core to the player at a counter of the food hall on P3 (O3)", () => {
    expect(chase({ x: 418, y: L.roof, z: 52 }, beforeKeeper("kenta"), 30)).not.toBeNull();
  });
});
