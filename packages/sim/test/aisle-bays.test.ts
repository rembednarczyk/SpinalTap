import { describe, expect, it } from "vitest";
import { AISLE_ROOM, BAY_OFF, BAY_PITCH, aisleBays } from "../src/content/aisle-bays";

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
    for (const b of aisleBays([two])) for (const z of [10, 19]) expect(Math.abs(b.z - z)).toBeGreaterThanOrEqual(2.4 + AISLE_ROOM - 1e-6);
  });
});
