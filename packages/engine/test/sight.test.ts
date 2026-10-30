import { describe, expect, it } from "vitest";
import { sightBlocked } from "../src/renderer/mapcity/sight";

// A building from x = 10 to 20, 12 m tall.
const solid = (x: number, y: number) => x >= 10 && x <= 20 && y < 12;
const eye = { x: 0, y: 1.6, z: 0 };

describe("line of sight through the map city (ADR-0044)", () => {
  it("is blocked by a building between the eye and a light", () => {
    expect(sightBlocked(solid, eye, { x: 30, y: 3, z: 0 })).toBe(true);
  });

  it("is clear in front of the building and over its roof", () => {
    expect(sightBlocked(solid, eye, { x: 8, y: 3, z: 0 })).toBe(false);
    expect(sightBlocked(solid, { x: 0, y: 30, z: 0 }, { x: 30, y: 30, z: 0 })).toBe(false);
  });

  it("sees a sign hung on the facade facing the eye", () => {
    expect(sightBlocked(solid, eye, { x: 9.85, y: 3, z: 0 })).toBe(false);
    expect(sightBlocked(solid, eye, { x: 10.3, y: 3, z: 0 })).toBe(false);
  });
});
