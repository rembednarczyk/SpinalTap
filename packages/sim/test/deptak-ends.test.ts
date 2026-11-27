import { describe, expect, it } from "vitest";
import { MAP_CHUNKS } from "../src/content/lublin/sites";

/*
 * The deptak's setts end square across it at the kerbs of the streets it meets (user's notes of
 * 21.11: the deptak "evenly finished", `tools/osm-import/src/deptak-ends.ts`): Olejna's south kerb at
 * the north end, Bajkowskiego's north kerb at the south. Past each line its junction's asphalt. The
 * parking lane along its west side (the stalls' lane) is setts up to that line, no strip of asphalt.
 */

type P = { readonly x: number; readonly z: number };
/** The ends' lines, west to east, and a point on the deptak's side of each. */
const ENDS: readonly { readonly name: string; readonly a: P; readonly b: P; readonly inside: P }[] = [
  { name: "north (Olejna)", a: { x: 450.51, z: 42.39 }, b: { x: 459.027, z: 39.583 }, inside: { x: 453, z: 35 } },
  { name: "south (Bajkowskiego)", a: { x: 437.81, z: -11.664 }, b: { x: 447.51, z: -12.536 }, inside: { x: 443, z: -5 } },
];
/** How far along each line a setts' vertex counts as the deptak's (m): its band and kerb fill, not the next street's. */
const REACH = 1;

const side = (a: P, b: P, p: P): number => ((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)) / Math.hypot(b.x - a.x, b.z - a.z);

const SETTS: readonly (readonly number[])[] = MAP_CHUNKS.flatMap((c) => c.ground)
  .filter((g) => g.surface === "cobble")
  .map((g) => g.outline);
const inRing = (o: readonly number[], p: P): boolean => {
  let inside = false;
  for (let i = 0, j = o.length - 2; i < o.length; j = i, i += 2) {
    const [xi, zi, xj, zj] = [o[i]!, o[i + 1]!, o[j]!, o[j + 1]!];
    if (zi > p.z !== zj > p.z && p.x < ((xj - xi) * (p.z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};
const onSetts = (p: P): boolean => SETTS.some((o) => inRing(o, p));
/** How far either side of the line the setts are sampled (m). */
const OFF = 0.3;

/** How far the setts' end may stray from one straight line across the deptak (m): the ground's 0.1 m and the sampling step. */
const STRAIGHT = 0.15;
/** A gap between two pieces of setts narrower than this is the ground's rounding, not the setts' end (m). */
const SEAM = 0.1;
/** How far out of the deptak each end is searched for (m): the cut moves up to 3 m in to the crossing kerb (`deptak-ends.ts`). */
const SEARCH = 6;

describe("the deptak's setts end square across it", () => {
  for (const end of ENDS) {
    it(`ends at the ${end.name} kerb along one straight line`, () => {
      // Across the deptak along the line the ends were drawn on, its middle part; out of the deptak square to it.
      const len = Math.hypot(end.b.x - end.a.x, end.b.z - end.a.z);
      const [ux, uz] = [(end.b.x - end.a.x) / len, (end.b.z - end.a.z) / len];
      const sign = Math.sign(side(end.a, end.b, end.inside));
      const [nx, nz] = [uz * sign, -ux * sign];
      const ts = Array.from({ length: 21 }, (_, i) => REACH + ((len - 2 * REACH) * i) / 20);
      // From 4 m inside, out to where the setts stop: one distance for the whole width, asphalt right past it.
      const ends = ts.map((t) => {
        const from = { x: end.a.x + ux * t - nx * 4, z: end.a.z + uz * t - nz * 4 };
        // Over a seam of the partition's 0.1 m rounding between two pieces of setts (the deptak's and its mouth's), not a hole.
        const setts = (e: number) => [0, SEAM / 2, SEAM].some((k) => onSetts({ x: from.x + nx * (e + k), z: from.z + nz * (e + k) }));
        let d = 0;
        while (d < 4 + SEARCH && setts(d + 0.05)) d += 0.05;
        return d;
      });
      expect(Math.max(...ends) - Math.min(...ends), ends.map((e) => e.toFixed(2)).join(" ")).toBeLessThanOrEqual(STRAIGHT);
      expect(Math.min(...ends)).toBeGreaterThan(0.5);
      for (const [i, t] of ts.entries()) expect(onSetts({ x: end.a.x + ux * t - nx * 4 + nx * (ends[i]! + OFF), z: end.a.z + uz * t - nz * 4 + nz * (ends[i]! + OFF) }), `${t.toFixed(2)}`).toBe(false);
    });
  }

  it("lays its parking lane w522482244 as setts up to Olejna's kerb, the lane north of it as asphalt", () => {
    // The lane's middle line, from its south tip by metro B's way up Lubartowska past Olejna.
    const [a, b] = [{ x: 443.9, z: 27.75 }, { x: 455.8, z: 60.9 }];
    const at = (z: number): P => ({ x: a.x + ((b.x - a.x) * (z - a.z)) / (b.z - a.z), z });
    const zs = (from: number, to: number): number[] => Array.from({ length: 13 }, (_, i) => from + ((to - from) * i) / 12);
    expect(zs(28.5, 41.5).filter((z) => !onSetts(at(z))).map((z) => z.toFixed(1))).toEqual([]);
    expect(zs(45, 58).filter((z) => onSetts(at(z))).map((z) => z.toFixed(1))).toEqual([]);
  });
});

