import { describe, expect, it } from "vitest";
import { drive } from "./traffic-drive";

/**
 * The traffic driving through the junctions the lanes now turn at (ADR-0055), against the city
 * before them (7e034bb, the verifier's probe of G-006): no vehicle stacked in one of its own route,
 * no more vehicles driving into each other, no more held up on the way.
 */

/** The city before the turns (7e034bb), the same minute: collisions and vehicle-seconds stood. */
const BEFORE: readonly (readonly [string, number, number, number, number, number])[] = [
  ["Ruska and Lwowska", 3, 1081, 448, 22, 113],
  ["Ruska and Lwowska", 7, 1081, 448, 24, 106],
  ["Mełgiewska and Aleja Andersa", 3, 2401, 282, 12, 348],
  ["Mełgiewska and Aleja Andersa", 7, 2401, 282, 12, 338],
  ["Peowiaków and Kołłątaja", 3, -98.7, -168.6, 0, 0],
  ["Peowiaków and Kołłątaja", 7, -98.7, -168.6, 0, 0],
  ["3 Maja", 3, -105, 90, 6, 59],
  ["3 Maja", 7, -105, 90, 2, 40],
];

describe("the traffic through the junctions (ADR-0055, G-006)", () => {
  it.each(BEFORE)("by %s (seed %i): none in one of its own route, no more collisions or hold-ups than before", (_, seed, x, z, collisions, stood) => {
    const after = drive(seed, x, z);
    expect(after.stacked).toBe(0);
    expect(after.collisions).toBeLessThanOrEqual(collisions);
    expect(after.stood).toBeLessThanOrEqual(stood);
  }, 120_000);

  // 3 Maja's left lane shifts across into the lane its right one turns out of into Żołnierzy
  // Niepodległej: vehicles appeared beside one on its way there and drove into it (G-075; measured
  // before the fix: 3 collisions in these seeds, 8 with Krakowskie reaching z = -270).
  it("by 3 Maja at Żołnierzy Niepodległej, a dozen seeds: no two vehicles meet (G-075)", () => {
    const collisions = Array.from({ length: 12 }, (_, k) => drive(k + 1, -105, 90).collisions);
    expect(collisions).toEqual(Array.from({ length: 12 }, () => 0));
  }, 240_000);

  // Cicha's 90-degree bend and Kołłątaja's at Zesłańców Sybiru: a vehicle's body turns at once with
  // its lane there and swings across the lane coming the other way, by centimetres short of the
  // vehicle on it (G-744; measured before the fix: 1 at Cicha in seeds 2, 8 and 30, 3 in seed 26,
  // and 1 at Kołłątaja in seed 10).
  it.each([
    ["Cicha", -188, 152, [2, 8, 26, 30]],
    ["Kołłątaja at Zesłańców Sybiru", -108, -149, [10]],
  ] as const)("by the bend of %s, the seeds that met there: no two vehicles meet (G-744)", (_, x, z, seeds) => {
    expect(seeds.map((seed) => drive(seed, x, z).collisions)).toEqual(seeds.map(() => 0));
  }, 240_000);
});
