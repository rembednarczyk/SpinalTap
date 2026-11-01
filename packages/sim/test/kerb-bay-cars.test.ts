import { describe, expect, it } from "vitest";
import { VEHICLE_SIZE } from "@seki/core";
import { MAP_CHUNKS } from "../src/content/lublin/sites";
import { ROAD_CHAINS } from "../src/content/lublin/roads";
import { PARKED_CARS, type ParkedCar } from "../src/content/parked-cars";
import { furnitureNear } from "../src/content/furniture-index";
import { distanceToPiece } from "../src/content/lublin/furniture";
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

/** Points of a car's body: a 9 by 9 grid over its footprint. */
const bodyGrid = (c: ParkedCar): P[] => {
  const { width, length } = VEHICLE_SIZE[c.model];
  const [fx, fz] = [Math.sin(c.yaw), Math.cos(c.yaw)];
  const k = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => i / 8 - 0.5);
  return k.flatMap((a) => k.map((b) => ({ x: c.x + fz * width * a + fx * length * b, z: c.z - fx * width * a + fz * length * b })));
};

const segmentGap = (p: P, a: P, b: P) => {
  const [dx, dz] = [b.x - a.x, b.z - a.z];
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
};

describe("cars of a kerb car park by the furniture and the footway past its kerb (G-189)", () => {
  // Radziwiłłowska w883991779: six bays, all taken in Lublin; parking meter n9596788047 and the pavement's footway just past the kerb (T-104).
  it("fill Radziwiłłowska's bays the occupancy leaves, wholly in the strip, off the meter and the footway", () => {
    const ring = ringOf("w883991779");
    const cars = carsIn(ring);
    expect(cars.length).toBeGreaterThanOrEqual(3);
    const footways = MAP_CHUNKS.flatMap((c) => c.footWays ?? []).map((w) => Array.from({ length: w.line.length / 2 }, (_, i) => ({ x: w.line[2 * i]!, z: w.line[2 * i + 1]! })));
    expect(furnitureNear(153.5, 82.7).some((f) => Math.hypot(f.x - 153.5, f.z - 82.7) < 0.2), "the meter").toBe(true);
    for (const c of cars) {
      const at = `${c.model} ${c.x},${c.z}`;
      for (const q of corners(c, 0)) expect(inRing(q, ring), `${at} corner ${q.x.toFixed(2)},${q.z.toFixed(2)}`).toBe(true);
      const body = bodyGrid(c);
      for (const f of furnitureNear(c.x, c.z)) expect(Math.min(...body.map((p) => distanceToPiece(f.item, p.x, p.z))), `${at} by ${f.item.prop} ${f.x},${f.z}`).toBeGreaterThan(0);
      for (const w of footways) for (let i = 1; i < w.length; i++) expect(Math.min(...body.map((p) => segmentGap(p, w[i - 1]!, w[i]!))), `${at} by a footway`).toBeGreaterThanOrEqual(1);
    }
  });

  // Ciasna w227679486: 8 m deep on a slope by a bend, mapped without `orientation`: no car aslant the kerb is level there; the layout across it (`bayLayouts`) keeps one.
  it("keep a car in Ciasna's deep strip, where only the layout across the kerb fits", () => {
    const ring = ringOf("w227679486");
    const cars = carsIn(ring);
    expect(cars.length).toBeGreaterThanOrEqual(1);
    for (const c of cars) for (const q of corners(c, 0.1)) expect(inRing(q, ring), `${c.model} ${c.x},${c.z} corner`).toBe(true);
  });
});
