import { describe, expect, it } from "vitest";
import { drive } from "./traffic-drive";

/*
 * The traffic through Ruska and Lwowska and through Mełgiewska and Aleja Andersa (ADR-0055, G-006), out of
 * `traffic-junction-drive.test.ts` (26.11, split by place), against the city before the turns (7e034bb).
 */

/** The city before the turns (7e034bb), the same minute: collisions and vehicle-seconds stood. */
const BEFORE: readonly (readonly [string, number, number, number, number, number])[] = [
  ["Ruska and Lwowska", 3, 1081, 448, 22, 113],
  ["Ruska and Lwowska", 7, 1081, 448, 24, 106],
  ["Mełgiewska and Aleja Andersa", 3, 2401, 282, 12, 348],
  ["Mełgiewska and Aleja Andersa", 7, 2401, 282, 12, 338],
];

describe("the traffic through the junctions (ADR-0055, G-006)", () => {
  it.each(BEFORE)("by %s (seed %i): none in one of its own route, no more collisions or hold-ups than before", (_, seed, x, z, collisions, stood) => {
    const after = drive(seed, x, z);
    expect(after.stacked).toBe(0);
    expect(after.collisions).toBeLessThanOrEqual(collisions);
    expect(after.stood).toBeLessThanOrEqual(stood);
  }, 120_000);
});
