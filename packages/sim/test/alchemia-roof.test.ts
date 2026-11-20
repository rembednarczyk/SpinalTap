import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, type Vec3 } from "@seki/core";
import {
  ALCHEMIA_LIFT,
  ALCHEMIA_LIFT_NE,
  ALCHEMIA_NAV,
  ALCHEMIA_PROPS,
  ALCHEMIA_ROOF_PIECES,
  ALCHEMIA_ROOF_PROPS,
  ATRIUM,
  BED_RAISED,
  CRATES,
  MALL,
  MALL_LEVELS,
  MALL_RAIL,
  PERGOLAS,
  ROOF_BEDS,
  ROOF_BENCHES,
  ROOF_CROWD,
  ROOF_PATHS,
  ROOF_TABLES,
  ROOF_TREES,
  STAIR_CORES,
  Simulation,
  WORLD_NAV,
  groundY,
  inBed,
} from "../src";
import { prismsAt } from "../src/world/prism";
import { routeAcrossLevels } from "../src/world/nav";
import { seatGroups } from "../src/content/lublin/seats";
import { teleportPlayer } from "./helpers";

/*
 * The gallery's green roof (ADR-0093 O4), measured on the simulation's own solids and level graph: the
 * atrium's opening open and railed, the paved ways clear between the beds, every bench and both cores'
 * doors reached from T1, T0 and P-1, solid where one stops and drawn only over the heads.
 */

const R = MALL_LEVELS.roof;
const prisms = ALCHEMIA_PROPS.flatMap((p) => prismsAt(p.prisms ?? [], p.center));
const inside = (q: (typeof prisms)[number], x: number, z: number): boolean =>
  q.points.every((p, i) => {
    const n = q.points[(i + 1) % q.points.length]!;
    return (n.x - p.x) * (z - p.z) - (n.z - p.z) * (x - p.x) >= 0;
  });
const solidAt = (x: number, y: number, z: number): boolean => prisms.some((q) => y > q.bottom && y < q.top && inside(q, x, z));
const path = (key: string) => ROOF_PATHS.find((p) => p.key === key)!;
const onPath = (x: number, z: number, keys = ROOF_PATHS.map((p) => p.key)): boolean => keys.some((k) => {
  const p = path(k);
  return x >= p.x0 - 1e-6 && x <= p.x1 + 1e-6 && z >= p.z0 - 1e-6 && z <= p.z1 + 1e-6;
});

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

/** A bench's seats, as the street furniture's (in front of it, a body's radius off its solid). */
const seats = (b: (typeof ROOF_BENCHES)[number]) => seatGroups({ prop: "bench", x: b.x, y: R, z: b.z, yaw: b.yaw, variant: b.variant })[0]!;

describe("the gallery's green roof (ADR-0093 O4)", () => {
  it("keeps the atrium's opening open to the sky and railed all round on the roof", () => {
    for (const p of ALCHEMIA_ROOF_PIECES) {
      const b = p.box;
      expect(b.x1 <= ATRIUM.x0 - 0.1 || b.x0 >= ATRIUM.x1 + 0.1 || b.z1 <= ATRIUM.z0 - 0.1 || b.z0 >= ATRIUM.z1 + 0.1, `${p.kind} ${b.x0},${b.z0}`).toBe(true);
    }
    for (let x = ATRIUM.x0 + 0.3; x < ATRIUM.x1; x += 0.7) for (let z = ATRIUM.z0 + 0.3; z < ATRIUM.z1; z += 0.7) expect(solidAt(x, R + 1, z), `${x},${z}`).toBe(false);
    // The balustrade a hand outside the opening, whole on every side, up to the rail's height.
    for (let t = 0.2; t < 1; t += 0.05) {
      const x = ATRIUM.x0 + (ATRIUM.x1 - ATRIUM.x0) * t;
      const z = ATRIUM.z0 + (ATRIUM.z1 - ATRIUM.z0) * t;
      for (const [px, pz] of [
        [x, ATRIUM.z0 - 0.06],
        [x, ATRIUM.z1 + 0.06],
        [ATRIUM.x0 - 0.06, z],
        [ATRIUM.x1 + 0.06, z],
      ] as const) expect(solidAt(px, R + MALL_RAIL - 0.1, pz), `${px.toFixed(1)},${pz.toFixed(1)}`).toBe(true);
    }
  });

  it("keeps the paved ways clear between the beds, a head's height and more over them", () => {
    const ways = ["ring-s", "ring-w", "ring-e", "ring-n", "core-sw", "lift-sw", "core-ne", "lift-ne", "cross-w"];
    for (const k of ways) {
      const p = path(k);
      for (let x = p.x0 + 0.15; x < p.x1 - 0.1; x += 0.25)
        for (let z = p.z0 + 0.15; z < p.z1 - 0.1; z += 0.25) for (const y of [R + 0.1, R + 0.5, R + 1.2, R + 2.2]) expect(solidAt(x, y, z), `${k} ${x.toFixed(2)},${y},${z.toFixed(2)}`).toBe(false);
    }
    // Nothing of the garden hangs under 2 m over any way or the pergolas' floors (but the leaves down a post, round it, and what lies on the table).
    type B = (typeof ALCHEMIA_ROOF_PIECES)[number]["box"];
    const onPost = (b: B) => PERGOLAS.some((p) => p.xs.some((x) => p.zs.some((z) => b.x0 < x && b.x1 > x && b.z0 < z && b.z1 > z)));
    const onTable = (b: B) => ROOF_TABLES.some((t) => b.x0 >= t.x0 && b.x1 <= t.x1 && b.z0 >= t.z0 && b.z1 <= t.z1);
    for (const p of ALCHEMIA_ROOF_PIECES.filter((q) => q.box.y0 > R + 0.5 && !onPost(q.box) && !onTable(q.box))) {
      const b = p.box;
      const over = ROOF_PATHS.some((w) => b.x1 > w.x0 && b.x0 < w.x1 && b.z1 > w.z0 && b.z0 < w.z1);
      if (over) expect(b.y0, `${p.kind} ${b.x0},${b.z0}`).toBeGreaterThanOrEqual(R + 1.95);
    }
  });

  it("opens both cores' doors and both lifts' gates onto the paved ways", () => {
    for (const l of [ALCHEMIA_LIFT, ALCHEMIA_LIFT_NE]) {
      const d = l.doors[l.levels.indexOf(R)]!;
      expect(onPath(d.x, d.z), `${l.key} ${d.x},${d.z}`).toBe(true);
    }
    for (const c of STAIR_CORES) {
      const n = ALCHEMIA_NAV.nodes.find((q) => q.id === `alchemia-core-${c.key}-door-${c.floors.length - 1}`)!;
      expect(n.at.y).toBeCloseTo(R, 5);
      expect(onPath(n.at.x, n.at.z), c.key).toBe(true);
    }
  });

  it("leads from T1, T0 and P-1 to every bench on the roof and to both cores' doors", () => {
    const sim = loaded();
    const starts: [string, Vec3][] = [
      ["T1", { x: 416, y: groundY(416, 62), z: 62 }],
      ["T0", { x: 420, y: groundY(420, 30.6), z: 30.6 }],
      ["P-1", { x: 409, y: MALL_LEVELS.p0, z: 27 }],
    ];
    const goals: [string, Vec3][] = [
      ...ROOF_BENCHES.map((b, i): [string, Vec3] => {
        const s = seats(b)[0]!;
        return [`bench ${i}`, { x: s.x, y: R, z: s.z }];
      }),
      ["north-east core", { x: 426.4, y: R, z: 56.25 }],
      ["north-east lift", { x: 430.2, y: R, z: 50.8 }],
    ];
    for (const [a, from] of starts) for (const [b, to] of goals) expect(routeAcrossLevels(sim.world, WORLD_NAV, from, to), `${a} to ${b}`).not.toBeNull();
  });

  it("walks the player from the south-west core's door to a bench of the west pergola and on to the north-east core", () => {
    const sim = Simulation.create({ seed: 3 });
    const at = () => sim.player()!.position;
    const walk = (x: number, z: number, steps = 400) => {
      for (let i = 0; i < steps; i++) {
        const p = sim.player()!;
        if (Math.hypot(x - p.position.x, z - p.position.z) < 0.3) return;
        const want = Math.atan2(x - p.position.x, z - p.position.z);
        sim.step({ ...EMPTY_INPUT, moveZ: 1, lookYaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) });
      }
    };
    const c = STAIR_CORES[0]!;
    teleportPlayer(sim, { x: (c.door.a0 + c.door.a1) / 2, y: R, z: c.z1 + 1.2 }, 0);
    sim.step();
    const seat = seats(ROOF_BENCHES[0]!)[0]!;
    for (const [x, z] of [
      [409.6, 39.3],
      [409.6, 51.4],
      [404.3, 52.05],
      [seat.x, seat.z],
    ] as const) walk(x, z);
    expect(Math.hypot(at().x - seat.x, at().z - seat.z)).toBeLessThan(0.4);
    expect(at().y).toBeCloseTo(R, 1);
    for (const [x, z] of [
      [404.3, 52.05],
      [409.6, 51.4],
      [426.4, 51.4],
      [426.4, 56.25],
    ] as const) walk(x, z);
    expect(Math.hypot(at().x - 426.4, at().z - 56.25)).toBeLessThan(0.4);
    expect(at().y).toBeCloseTo(R, 1);
  });

  it("is solid where one stops (beds, posts, tables, crates, the chair, the services, the game's benches) and drawn only over the heads", () => {
    for (const b of ROOF_BEDS) expect(solidAt((b.x0 + b.x1) / 2, R + b.high - 0.05, (b.z0 + b.z1) / 2), b.key).toBe(true);
    for (const p of PERGOLAS) for (const x of p.xs) for (const z of p.zs) expect(solidAt(x, R + 1.5, z), `${p.key} ${x},${z}`).toBe(true);
    for (const b of ROOF_BENCHES) expect(solidAt(b.x, R + 0.4, b.z), `bench ${b.x},${b.z}`).toBe(true);
    for (const p of ALCHEMIA_ROOF_PIECES.filter((q) => ["crate", "chair", "machine", "panel", "table"].includes(q.kind) && q.solid)) {
      const b = p.box;
      expect(solidAt((b.x0 + b.x1) / 2, Math.min(b.y1 - 0.05, R + 0.3), (b.z0 + b.z1) / 2), `${p.kind} ${b.x0},${b.z0}`).toBe(true);
    }
    for (const p of ALCHEMIA_ROOF_PIECES.filter((q) => ["lantern", "laundry", "flower", "steam", "can", "cable", "green"].includes(q.kind))) expect(p.solid, `${p.kind} ${p.box.x0},${p.box.z0}`).toBe(false);
    // The washing hangs over the crates' gap, a hand wide (no way between them).
    expect(CRATES.cols[1][0] - CRATES.cols[0][1]).toBeLessThan(0.76);
  });

  it("stands the game's trees and shrubs on their beds' substrate and the benches on the roof, all within the roof", () => {
    for (const t of ROOF_TREES) {
      const tree = ALCHEMIA_ROOF_PROPS.find((p) => p.prop === "tree" && p.x === t.x && p.z === t.z)!;
      const bed = ROOF_BEDS.find((b) => inBed(b, t.x, t.z, 0.4))!;
      expect(bed.high).toBe(BED_RAISED);
      expect(tree.y).toBeCloseTo(R + bed.high, 5);
    }
    for (const s of ALCHEMIA_ROOF_PROPS.filter((p) => p.prop === "shrubs")) {
      const bed = ROOF_BEDS.find((b) => inBed(b, s.x, s.z, 0.3));
      expect(bed?.high, `${s.x},${s.z}`).toBe(BED_RAISED);
      expect(s.y).toBeCloseTo(R + BED_RAISED, 5);
    }
    for (const p of ALCHEMIA_ROOF_PROPS) {
      expect(p.x > MALL.x0 + 0.2 && p.x < MALL.x1 - 0.2 && p.z > MALL.z0 + 0.4 && p.z < MALL.z1 - 0.2, `${p.prop} ${p.x},${p.z}`).toBe(true);
      if (p.prop === "bench") expect(ROOF_BEDS.some((b) => inBed(b, p.x, p.z, -0.3))).toBe(false);
    }
    expect(ALCHEMIA_ROOF_PROPS.filter((p) => p.prop === "tree").length).toBeGreaterThanOrEqual(4);
    expect(ALCHEMIA_ROOF_PROPS.filter((p) => p.prop === "shrubs").length).toBeGreaterThanOrEqual(12);
    expect(ALCHEMIA_ROOF_PROPS.filter((p) => p.prop === "lamp-park").length).toBeGreaterThanOrEqual(5);
  });

  it("is dense in three layers: the garden, the services beside the residents' crates, and traces of somebody just gone", () => {
    const count = (kind: string) => ALCHEMIA_ROOF_PIECES.filter((p) => p.kind === kind).length;
    expect(count("lantern")).toBeGreaterThanOrEqual(20);
    expect(count("planter") + count("lawn")).toBe(ROOF_BEDS.length);
    expect(count("panel")).toBeGreaterThanOrEqual(3);
    expect(count("mast")).toBeGreaterThanOrEqual(1);
    expect(count("crate")).toBe(2 * CRATES.count);
    expect(count("laundry")).toBeGreaterThanOrEqual(6);
    // A cigarette smoking by the chair and a cup steaming on the picnic table.
    expect(count("steam")).toBeGreaterThanOrEqual(2);
    // Under the gallery's height (13.5, the glitch scan's `alchemia-mall-height`) and on its plot.
    for (const p of ALCHEMIA_ROOF_PIECES) {
      expect(p.box.y1, p.kind).toBeLessThanOrEqual(13.5 + 1e-6);
      expect(p.box.x0 >= MALL.x0 && p.box.x1 <= MALL.x1 && p.box.z0 >= MALL.z0 && p.box.z1 <= MALL.z1, `${p.kind} ${p.box.x0},${p.box.z0}`).toBe(true);
    }
  });

  it("seats a few of the crowd on the benches and leans a few on the atrium's balustrade, clear of the solids", () => {
    const sitting = ROOF_CROWD.filter((c) => c.does.includes("sit"));
    const leaning = ROOF_CROWD.filter((c) => c.does.includes("lean"));
    expect(sitting.length).toBeGreaterThanOrEqual(4);
    expect(leaning.length).toBeGreaterThanOrEqual(2);
    for (const c of ROOF_CROWD) {
      expect(c.at.y).toBe(R);
      expect(c.indoor).toBeUndefined();
      for (let a = 0; a < 6.28; a += 0.8) expect(solidAt(c.at.x + 0.25 * Math.cos(a), R + 0.8, c.at.z + 0.25 * Math.sin(a)), `${c.at.x},${c.at.z}`).toBe(false);
    }
    for (const c of leaning) expect(Math.min(Math.abs(c.at.z - ATRIUM.z1), Math.abs(c.at.x - ATRIUM.x1))).toBeLessThan(0.75);
  });
});
