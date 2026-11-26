import { describe, expect, it } from "vitest";
import { PARKED_CARS } from "../src/content/parked-cars";
import { parkedTakenFlag, takenParked } from "../src/content/parked-taken";

describe("the flag of a parked car she took (ADR-0097, G-978)", () => {
  it("names the car by its place on the map, so a save keeps it when the city's cars change", () => {
    const i = Math.floor(PARKED_CARS.length / 2);
    const c = PARKED_CARS[i]!;
    expect(parkedTakenFlag(i)).toBe(`parked-taken:${c.x.toFixed(1)},${c.z.toFixed(1)}`);
    expect([...takenParked([parkedTakenFlag(i), "story:other"])]).toEqual([i]);
  });

  it("tells every parked car apart by its place", () => {
    expect(new Set(PARKED_CARS.map((_, i) => parkedTakenFlag(i))).size).toBe(PARKED_CARS.length);
  });

  it("reads an older save's flag by its index, and none for a place no car stands at any more", () => {
    expect([...takenParked(["parked-taken:5"])]).toEqual([5]);
    expect(takenParked(["parked-taken:-99999.0,-99999.0"]).size).toBe(0);
  });
});
