import { describe, expect, it } from "vitest";
import { VEHICLE_SIZE, pointInPairRingEvenOdd } from "@seki/core";
import { AISLE_ROOM, BAY_OFF, BAY_PITCH, aisleBays, moduleAisles } from "../src/content/aisle-bays";
import { MAP_CHUNKS } from "../src/content/lublin/sites";
import { PARKED_CARS, SURFACE_PARKS } from "../src/content/parked-cars";

/** The bays of a surface car park along its aisles (T-352): perpendicular rows either side, nose to the aisle. */

// A 40 × 20 m park with one aisle along its middle (x 0..40, z 10).
const park = { id: "p", outline: [0, 0, 40, 0, 40, 20, 0, 20], aisles: [[0, 10, 40, 10]] };

describe("bays along a car park's aisles (T-352)", () => {
  it("sets out rows either side of the aisle, a bay's pitch apart, clear of its ends", () => {
    const bays = aisleBays([park]);
    const north = bays.filter((b) => b.z > 10).map((b) => b.x);
    const south = bays.filter((b) => b.z < 10).map((b) => b.x);
    expect(north.length).toBe(south.length);
    // 40 m less 3 m at each end: 13 or 14 bays a row.
    expect(north.length).toBeGreaterThanOrEqual(13);
    for (let i = 1; i < north.length; i++) expect(north[i]! - north[i - 1]!).toBeCloseTo(BAY_PITCH, 6);
    expect(Math.min(...north)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...north)).toBeLessThanOrEqual(37);
    for (const b of bays) expect(Math.abs(b.z - 10)).toBeCloseTo(BAY_OFF, 6);
  });

  it("turns each car's nose to the aisle", () => {
    for (const b of aisleBays([park])) {
      // yaw as the parked cars': facing (sin yaw, cos yaw).
      expect(Math.sign(Math.cos(b.yaw))).toBe(b.z > 10 ? -1 : 1);
    }
  });

  it("leaves out a bay whose middle falls outside the park", () => {
    const narrow = { ...park, outline: [0, 0, 40, 0, 40, 14, 0, 14] };
    const bays = aisleBays([narrow]);
    expect(bays.every((b) => b.z < 10)).toBe(true);
  });
});

describe("bays between two aisles (the curator's review of #1037)", () => {
  // Two parallel aisles 9 m apart: one row on the line between them, none on either aisle.
  const two = { id: "q", outline: [0, 0, 40, 0, 40, 30, 0, 30], aisles: [[0, 10, 40, 10], [0, 19, 40, 19]] };

  it("sets one row on the middle line between aisles nearer than two rows' reach", () => {
    const middle = aisleBays([two]).filter((b) => b.z > 10 && b.z < 19);
    expect(middle.length).toBeGreaterThan(0);
    for (const b of middle) expect(b.z).toBeCloseTo(14.5, 6);
  });

  it("keeps every body 1.5 m off every aisle's axis", () => {
    for (const b of aisleBays([two])) for (const z of [10, 19]) expect(Math.abs(b.z - z)).toBeGreaterThanOrEqual(VEHICLE_SIZE.van.length / 2 + AISLE_ROOM - 1e-6);
  });

  it("keeps a van's 5 m body clear too: no middle row between aisles 7.9 m apart", () => {
    // The middle line 3.95 m off each axis: room for a 4.8 m body, not for a van's.
    const tight = { id: "t", outline: [0, 0, 40, 0, 40, 30, 0, 30], aisles: [[0, 10, 40, 10], [0, 17.9, 40, 17.9]] };
    const reach = VEHICLE_SIZE.van.length / 2 + AISLE_ROOM;
    for (const b of aisleBays([tight])) for (const z of [10, 17.9]) expect(Math.abs(b.z - z)).toBeGreaterThanOrEqual(reach - 1e-6);
  });
});

describe("the cars of the car parks with aisles (backlog 25.11, cars on the city's car parks)", () => {
  const parks = [...new Map(MAP_CHUNKS.flatMap((c) => c.carParks ?? []).filter((p) => p.kind === "surface" && (p.aisles?.length ?? 0) > 0).map((p) => [p.id, p])).values()];
  const bays = aisleBays(parks.map((p) => ({ id: p.id, outline: p.outline, aisles: p.aisles ?? [] })));
  const onBay = (c: { x: number; z: number }) => bays.some((b) => Math.abs(b.x - c.x) < 0.01 && Math.abs(b.z - c.z) < 0.01);

  it("puts no delivery truck in a bay, and leaves no bay empty for having drawn one", () => {
    const cars = PARKED_CARS.filter(onBay);
    expect(cars.filter((c) => c.model === "delivery")).toEqual([]);
    // 85 while a bay that drew the street's truck (5.8 m against a 5 m bay) stood empty: 97 of 645 bays.
    expect(cars.length).toBeGreaterThanOrEqual(95);
  });
});

describe("aisles laid in a car park the map draws none in (the backlog's item of 25.11, part 2)", () => {
  const rect = (w: number, h: number, a = 0): number[] => {
    const [c, s] = [Math.cos(a), Math.sin(a)];
    return [[0, 0], [w, 0], [w, h], [0, h]].flatMap(([u, v]) => [u! * c - v! * s, u! * s + v! * c]);
  };

  it("lays one double-loaded module along the long side of a park 17-33 m across, centred", () => {
    const [aisle] = moduleAisles(rect(40, 20));
    expect(moduleAisles(rect(40, 20))).toHaveLength(1);
    // Along x at z 10, from end to end of the outline.
    expect(aisle![1]).toBeCloseTo(10);
    expect(aisle![3]).toBeCloseTo(10);
    expect(Math.abs(aisle![2]! - aisle![0]!)).toBeGreaterThan(39);
  });

  it("lays as many modules as fit across, along the long side whatever the outline's turn", () => {
    const two = moduleAisles(rect(60, 36));
    expect(two).toHaveLength(2);
    // The outer modules flush to the long sides (8 m from the axis to a row's back, half a metre's room): rows at the kerbs.
    expect(two.map((a) => a[1]!).sort((a, b) => a - b)).toEqual([8.5, 27.5]);
    const turned = moduleAisles(rect(20, 45, 0.6));
    expect(turned).toHaveLength(1);
    const [x0, z0, x1, z1] = turned[0]!;
    // The long side runs along the turned v axis: (-sin, cos) of 0.6.
    expect(Math.abs((x1! - x0!) * Math.cos(0.6) + (z1! - z0!) * Math.sin(0.6))).toBeLessThan(0.1);
  });

  it("lays none in a park under 17 m across, and keeps an aisle to its outline's inside", () => {
    expect(moduleAisles(rect(50, 16))).toHaveLength(0);
    // An L: 40 m along x and 20 m deep for its first 20 m, 10 m deep beyond.
    const l = [0, 0, 40, 0, 40, 10, 20, 10, 20, 20, 0, 20];
    const aisles = moduleAisles(l);
    for (const a of aisles) for (let i = 0; i < a.length; i += 2) expect(a[i]! <= 40.01 && a[i + 1]! <= 20.01).toBe(true);
  });

  it("parks the city's aisle-less car parks wide enough for a module", () => {
    const laid = SURFACE_PARKS.filter((p) => !MAP_CHUNKS.some((c) => (c.carParks ?? []).some((q) => q.id === p.id && (q.aisles?.length ?? 0) > 0)));
    expect(laid.length).toBeGreaterThanOrEqual(5);
    const inLaid = PARKED_CARS.filter((c) => laid.some((p) => pointInPairRingEvenOdd(c.x, c.z, Array.from({ length: p.outline.length / 2 }, (_, i): [number, number] => [p.outline[2 * i]!, p.outline[2 * i + 1]!]))));
    expect(inLaid.length).toBeGreaterThanOrEqual(80);
  });
});
