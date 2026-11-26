import { describe, expect, it } from "vitest";
import { drive } from "./traffic-drive";

/*
 * The bends of Cicha and of Kołłątaja at Zesłańców Sybiru (G-744), out of `traffic-junction-drive.test.ts`
 * (26.11, split by place).
 */

describe("the traffic through the junctions (ADR-0055, G-006)", () => {
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
