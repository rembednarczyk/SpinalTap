import { describe, expect, it } from "vitest";
import { convexParts, isConvex, triangulate } from "../src/convex.ts";
import { type Pt, signedArea } from "../src/geometry.ts";

const pts = (...xs: number[]): Pt[] => {
  const out = [];
  for (let i = 0; i < xs.length; i += 2) out.push({ x: xs[i]!, z: xs[i + 1]! });
  return out;
};

const check = (ring: Pt[]) => {
  const parts = convexParts(ring)!;
  expect(parts).not.toBeNull();
  for (const p of parts) {
    expect(isConvex(p)).toBe(true);
    expect(signedArea(p)).toBeGreaterThan(0);
  }
  expect(parts.reduce((s, p) => s + signedArea(p), 0)).toBeCloseTo(Math.abs(signedArea(ring)), 9);
  return parts;
};

/** A deterministic star-shaped polygon: n vertices at random radii (LCG), counter-clockwise. */
const star = (seed: number, n: number): Pt[] => {
  let s = seed;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const r = 5 + rnd() * 10;
    return { x: Math.round(r * Math.cos(a) * 10) / 10, z: Math.round(r * Math.sin(a) * 10) / 10 };
  });
};

describe("convex decomposition", () => {
  it("keeps a convex outline whole", () => {
    expect(check(pts(0, 0, 10, 0, 10, 5, 0, 5))).toHaveLength(1);
  });

  it("splits an L into two parts", () => {
    expect(check(pts(0, 0, 10, 0, 10, 4, 4, 4, 4, 10, 0, 10))).toHaveLength(2);
  });

  it("splits a U and a comb", () => {
    expect(check(pts(0, 0, 12, 0, 12, 10, 8, 10, 8, 4, 4, 4, 4, 10, 0, 10)).length).toBeLessThanOrEqual(4);
    check(pts(0, 0, 20, 0, 20, 10, 17, 10, 17, 3, 14, 3, 14, 10, 11, 10, 11, 3, 8, 3, 8, 10, 5, 10, 5, 3, 2, 3, 2, 10, 0, 10));
  });

  it("accepts clockwise input and collinear vertices", () => {
    check(pts(0, 0, 0, 10, 5, 10, 10, 10, 10, 0, 5, 0));
  });

  it("decomposes random star polygons", () => {
    for (let seed = 1; seed <= 40; seed++) check(star(seed, 8 + (seed % 17)));
  });

  it("triangulates a simple ring into n - 2 triangles", () => {
    expect(triangulate(pts(0, 0, 10, 0, 10, 4, 4, 4, 4, 10, 0, 10))).toHaveLength(4);
  });
});
