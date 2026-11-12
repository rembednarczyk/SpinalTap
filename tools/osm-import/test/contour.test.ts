import { describe, expect, it } from "vitest";
import { contours } from "../src/contour.ts";
import { pointInRing, signedArea } from "../src/geometry.ts";

/** A lattice of 1 m samples from rows of text, north first: `#` in the class. */
const lattice = (rows: readonly string[], cross: () => number = () => 0.5) => {
  const nz = rows.length;
  const nx = rows[0]!.length;
  const inside = new Uint8Array(nx * nz);
  rows.forEach((r, k) => [...r].forEach((c, i) => (inside[(nz - 1 - k) * nx + i] = c === "#" ? 1 : 0)));
  return { nx, nz, inside, at: (i: number, j: number) => ({ x: i, z: j }), cross: () => cross() };
};

describe("marching squares (contour.ts, ADR-0077 step 1.1)", () => {
  it("rings a block counter-clockwise half way to the samples round it", () => {
    const rings = contours(lattice(["....", ".##.", ".##.", "...."]));
    expect(rings).toHaveLength(1);
    expect(signedArea(rings[0]!)).toBeCloseTo(3.5, 6);
    for (const p of [
      { x: 1, z: 1 },
      { x: 2, z: 2 },
    ])
      expect(pointInRing(p, rings[0]!)).toBe(true);
    expect(pointInRing({ x: 0, z: 0 }, rings[0]!)).toBe(false);
  });

  it("gives a hole clockwise inside its ring", () => {
    const rings = contours(lattice(["#####", "#...#", "#...#", "#...#", "#####"]));
    expect(rings).toHaveLength(2);
    const [outer, hole] = [...rings].sort((a, b) => signedArea(b) - signedArea(a));
    expect(signedArea(outer!)).toBeGreaterThan(0);
    expect(signedArea(hole!)).toBeLessThan(0);
    expect(pointInRing({ x: 2, z: 2 }, hole!)).toBe(true);
  });

  it("keeps two samples touching at a corner apart (4-connected)", () => {
    const rings = contours(lattice(["#.", ".#"]));
    expect(rings).toHaveLength(2);
    for (const r of rings) expect(signedArea(r)).toBeGreaterThan(0);
  });

  it("crosses where `cross` says, so a sample near the outline stays inside", () => {
    const rings = contours(lattice(["...", ".#.", "..."], () => 0.1));
    expect(rings).toHaveLength(1);
    const xs = rings[0]!.map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(0.9, 6);
    expect(Math.max(...xs)).toBeCloseTo(1.1, 6);
  });

  it("drops the corners on a straight run", () => {
    const rings = contours(lattice([".......", ".#####.", "......."]));
    expect(rings[0]!.length).toBeLessThanOrEqual(8);
  });
});
