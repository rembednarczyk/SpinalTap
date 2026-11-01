import { describe, expect, it } from "vitest";
import { VEHICLE_SIZE } from "@seki/core";
import { MAP_CHUNKS } from "../src/content/lublin/sites";
import { ROAD_CHAINS } from "../src/content/lublin/roads";
import { PARKED_CARS, type ParkedCar } from "../src/content/parked-cars";
import { projectOn } from "../src/content/traffic";
import { pointAt } from "../src/content/traffic-lane";

type P = { readonly x: number; readonly z: number };

const ringOf = (id: string): P[] => {
  const park = MAP_CHUNKS.flatMap((c) => c.carParks ?? []).find((p) => p.id === id)!;
  return Array.from({ length: park.outline.length / 2 }, (_, i) => ({ x: park.outline[2 * i]!, z: park.outline[2 * i + 1]! }));
};

const inRing = (q: P, r: readonly P[]) => {
  let on = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) if (r[i]!.z > q.z !== r[j]!.z > q.z && q.x < ((r[j]!.x - r[i]!.x) * (q.z - r[i]!.z)) / (r[j]!.z - r[i]!.z) + r[i]!.x) on = !on;
  return on;
};

const carsIn = (ring: readonly P[]) => PARKED_CARS.filter((c) => inRing(c, ring));

/** A car's corners pulled `inset` metres in along both its sides. */
const corners = (c: ParkedCar, inset: number): P[] => {
  const { width, length } = VEHICLE_SIZE[c.model];
  const [fx, fz] = [Math.sin(c.yaw), Math.cos(c.yaw)];
  const [hw, hl] = [width / 2 - inset, length / 2 - inset];
  return [-1, 1].flatMap((a) => [-1, 1].map((b) => ({ x: c.x + fz * hw * a + fx * hl * b, z: c.z - fx * hw * a + fz * hl * b })));
};

/**
 * The car street a bay car is by, and its way there as the traffic beside the car drives it
 * (right-hand: a two-way street's axis way on its right, the other way on its left).
 */
const streetBy = (c: ParkedCar) => {
  const street = ROAD_CHAINS.filter((r) => r.use === "cars").reduce((m, r) => (projectOn(r.points, c.x, c.z).d < projectOn(m.points, c.x, c.z).d ? r : m));
  const on = projectOn(street.points, c.x, c.z);
  const p = pointAt(street.points, on.s);
  const way = !street.oneway && on.side < 0 ? -1 : 1;
  return { street, d: on.d, tx: p.tx * way, tz: p.tz * way };
};

const deg = (r: number) => (r * 180) / Math.PI;

describe("cars of Lublin's kerb car parks mapped without `orientation` (G-187)", () => {
  // Krakowskie Przedmieście w55897048 (~60°, 15 bays) and Radziwiłłowska w883991779 (65–70°, 6), orthophoto PZGiK.
  it.each([
    ["w55897048", 10],
    ["w883991779", 1],
  ])("stand aslant in the deep strip %s, 60° off the street, nose first to the kerb in the traffic's way, wholly in it", (id, least) => {
    const ring = ringOf(id);
    const cars = carsIn(ring);
    expect(cars.length).toBeGreaterThanOrEqual(least);
    for (const c of cars) {
      const at = `${c.model} ${c.x},${c.z}`;
      const s = streetBy(c);
      const [fx, fz] = [Math.sin(c.yaw), Math.cos(c.yaw)];
      expect(Math.abs(deg(Math.acos(Math.abs(fx * s.tx + fz * s.tz))) - 60), at).toBeLessThanOrEqual(10);
      expect(fx * s.tx + fz * s.tz, `${at} in the traffic's way`).toBeGreaterThan(0);
      const nose = projectOn(s.street.points, c.x + fx * 2, c.z + fz * 2).d;
      expect(nose, `${at} nose to the kerb`).toBeGreaterThan(s.d);
      for (const q of corners(c, 0.1)) expect(inRing(q, ring), `${at} corner ${q.x.toFixed(2)},${q.z.toFixed(2)}`).toBe(true);
    }
  });

  it("stand along the kerb in a strip shallower than 4.5 m (Lubartowska w471191535, 4.2 m)", () => {
    const ring = ringOf("w471191535");
    const cars = carsIn(ring);
    expect(cars.length).toBeGreaterThan(0);
    for (const c of cars) {
      const s = streetBy(c);
      expect(Math.abs(Math.sin(c.yaw) * s.tx + Math.cos(c.yaw) * s.tz), `${c.model} ${c.x},${c.z}`).toBeGreaterThan(Math.cos((20 * Math.PI) / 180));
    }
  });
});
