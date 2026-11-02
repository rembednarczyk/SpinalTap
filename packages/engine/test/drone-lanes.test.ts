import { WORLD_SCENERY, groundY } from "@seki/sim";
import { LUBLIN_CHUNKS } from "@seki/sim/lublin";
import { describe, expect, it } from "vitest";
import { CORRIDOR, type DroneBuilding, type DroneWorld, LEG, MIN_LANE, ROOF_CLEAR, STEP, joinAxes, planDroneLanes, resample } from "../src/renderer/drones/drone-lanes";
import { droneWorldOf, streetAxes } from "../src/renderer/drones/drone-world";
import type { P2 } from "../src/renderer/mapcity/polygon";

/** A box outline from (x0, z0) to (x1, z1). */
const rect = (x0: number, z0: number, x1: number, z1: number): P2[] => [
  { x: x0, z: z0 },
  { x: x1, z: z0 },
  { x: x1, z: z1 },
  { x: x0, z: z1 },
];

/**
 * A street along x from 0 to 300 m, 12 m wide (z from -6 to 6), its axis on z = 0, a row of
 * houses 12 m high on each side; `tall` puts one 40 m high at x 140..160 on the north side.
 */
const street = (opts: { south?: boolean; north?: boolean; tall?: boolean; landmark?: boolean; road?: P2[] } = {}): DroneWorld => {
  const buildings: DroneBuilding[] = [];
  for (let x = 0; x < 300; x += 20) {
    if (opts.north !== false) buildings.push({ ring: rect(x, 8, x + 18, 20), top: opts.tall && x === 140 ? 40 : 12, landmark: false });
    if (opts.south !== false) buildings.push({ ring: rect(x, -20, x + 18, -8), top: 12, landmark: false });
  }
  if (opts.landmark) buildings.push({ ring: rect(140, 30, 160, 50), top: 30, landmark: true });
  return { axes: [[{ x: 0, z: 0 }, { x: 150, z: 0 }], [{ x: 300, z: 0 }, { x: 150, z: 0 }]], roads: [opts.road ?? rect(-10, -6, 310, 6)], buildings, groundAt: () => 0 };
};

describe("drone lanes (ADR-0058 stage 7)", () => {
  it("joins the pieces of a street's axis, turned round as needed, and samples it every step", () => {
    const joined = joinAxes([
      [{ x: 0, z: 0 }, { x: 10, z: 0 }],
      [{ x: 20, z: 0 }, { x: 10, z: 0 }],
      [{ x: 10, z: 0 }, { x: 10, z: 30 }],
    ]);
    // The straight pieces join; the one turning off at a right angle stays apart.
    expect(joined.map((l) => l.length)).toEqual([3, 2]);
    const pts = resample(joined[0]!);
    expect(pts).toHaveLength(6);
    for (let i = 1; i < pts.length; i++) expect(Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z)).toBeCloseTo(STEP, 6);
  });

  it("flies a street lined with houses over their roofs, the turns kept over the street", () => {
    const lanes = planDroneLanes(street());
    expect(lanes).toHaveLength(1);
    const lane = lanes[0]!;
    expect(lane.length).toBeGreaterThan(260);
    for (const p of lane.points) {
      expect(Math.abs(p.z)).toBeLessThan(1e-6);
      expect(p.x).toBeGreaterThan(LEG);
      expect(p.x).toBeLessThan(300 - LEG);
    }
    for (const l of lane.levels) expect(l).toBeGreaterThanOrEqual(12 + ROOF_CLEAR);
    // The same world, the same lanes.
    expect(planDroneLanes(street())).toEqual(lanes);
  });

  it("climbs over a tall roof before it and stays up past it", () => {
    const lane = planDroneLanes(street({ tall: true }))[0]!;
    const at = (x: number) => lane.levels[Math.round((x - lane.points[0]!.x) / STEP)]!;
    for (const x of [130, 140, 150, 160, 170]) expect(at(x), `x ${x}`).toBeGreaterThanOrEqual(40 + ROOF_CLEAR);
    expect(at(20)).toBeLessThan(40);
    // Smooth: never more than a few metres up or down a step.
    for (let i = 1; i < lane.levels.length; i++) expect(Math.abs(lane.levels[i]! - lane.levels[i - 1]!)).toBeLessThan(STEP * 1.5);
  });

  it("keeps away from landmarks, open ground and streets narrower than its legs", () => {
    const byLandmark = planDroneLanes(street({ landmark: true }));
    for (const lane of byLandmark) for (const p of lane.points) expect(Math.abs(p.x - 150)).toBeGreaterThan(40);
    // A street with houses on one side still counts; with none it is open ground.
    expect(planDroneLanes(street({ north: false }))).toHaveLength(1);
    expect(planDroneLanes(street({ north: false, south: false }))).toEqual([]);
    // Pavements of 2 m: the legs would hang over the houses.
    expect(planDroneLanes(street({ road: rect(-10, -1.5, 310, 1.5) }))).toEqual([]);
    // Too short a street.
    const short = street();
    expect(planDroneLanes({ ...short, axes: [[{ x: 100, z: 0 }, { x: 100 + MIN_LANE - 10, z: 0 }]] })).toEqual([]);
  });

  it("plans lanes over Lublin's streets from the scenery, none over a landmark", () => {
    const world = droneWorldOf(WORLD_SCENERY, streetAxes(LUBLIN_CHUNKS), groundY);
    const lanes = planDroneLanes(world);
    const total = lanes.reduce((n, l) => n + l.length, 0);
    expect(lanes.length).toBeGreaterThanOrEqual(20);
    expect(total).toBeGreaterThan(2000);
    for (const lane of lanes) {
      expect(lane.length).toBeGreaterThanOrEqual(MIN_LANE);
      lane.levels.forEach((level, i) => {
        const p = lane.points[i]!;
        expect(level).toBeLessThan(groundY(p.x, p.z) + 90);
        for (const b of world.buildings) {
          if (b.landmark) continue;
          const inside = b.ring.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < CORRIDOR / 2);
          if (inside) expect(level).toBeGreaterThanOrEqual(b.top + ROOF_CLEAR - 1e-9);
        }
      });
    }
  });
});
