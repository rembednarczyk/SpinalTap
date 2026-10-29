import { describe, expect, it } from "vitest";
import {
  boundsOfPrisms,
  circleTouchesPrism,
  closestOnPrism,
  collidersOf,
  edgeDistance,
  isConvex,
  makePrism,
  overPrism,
  prismsAt,
  rayPrism,
  rayPrismRange,
  resolveCirclePrism,
} from "../src";

/** A 10 × 6 rectangle centred on (cx, cz), turned by `deg` degrees counter-clockwise. */
const turned = (cx: number, cz: number, w: number, d: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ].map(([x = 0, z = 0]) => ({ x: cx + x * c - z * s, z: cz + x * s + z * c }));
};

const square = makePrism(
  [
    { x: 0, z: 0 },
    { x: 2, z: 0 },
    { x: 2, z: 2 },
    { x: 0, z: 2 },
  ],
  0,
  3,
);

describe("convex prisms (ADR-0043)", () => {
  it("accepts either winding, drops repeats and collinear corners, rejects concave outlines", () => {
    const cw = makePrism(
      [
        { x: 0, z: 2 },
        { x: 1, z: 2 },
        { x: 2, z: 2 },
        { x: 2, z: 2 },
        { x: 2, z: 0 },
        { x: 0, z: 0 },
      ],
      0,
      1,
    );
    expect(cw.points).toHaveLength(4);
    // Normals point out: the centre is inside every edge.
    expect(edgeDistance(cw, 1, 1)).toBeCloseTo(-1);
    expect(isConvex([{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 4 }, { x: 2, z: 1 }, { x: 0, z: 4 }])).toBe(false);
    expect(() => makePrism([{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 4 }, { x: 2, z: 1 }, { x: 0, z: 4 }], 0, 1)).toThrow();
    expect(() => makePrism([{ x: 0, z: 0 }, { x: 1, z: 1 }, { x: 2, z: 2 }], 0, 1)).toThrow();
    expect(() => makePrism(square.points, 2, 2)).toThrow();
  });

  it("places content parts at the prop and bounds them", () => {
    const parts = prismsAt(
      [
        { points: [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 1 }, { x: 0, z: 1 }], bottom: 0, top: 5 },
        { points: [{ x: 0, z: 1 }, { x: 1, z: 1 }, { x: 1, z: 4 }, { x: 0, z: 4 }], bottom: 0, top: 8 },
      ],
      { x: 10, y: 2, z: -3 },
    );
    expect(parts[1]?.top).toBe(10);
    expect(boundsOfPrisms(parts)).toEqual({ min: { x: 10, y: 2, z: -3 }, max: { x: 14, y: 10, z: 1 } });
  });

  it("finds the closest point of a footprint and the point itself inside", () => {
    expect(closestOnPrism(square, 1, 1, { x: 0, z: 0 })).toEqual({ x: 1, z: 1 });
    expect(closestOnPrism(square, 3, 3, { x: 0, z: 0 })).toEqual({ x: 2, z: 2 });
    expect(closestOnPrism(square, 1, -5, { x: 0, z: 0 })).toEqual({ x: 1, z: 0 });
    expect(overPrism(square, 2.05, 1, 0.1)).toBe(true);
    expect(overPrism(square, 2.2, 1, 0.1)).toBe(false);
  });

  it("pushes a circle out of a slanted wall along the wall's normal", () => {
    const p = makePrism(turned(0, 0, 10, 6, 17), 0, 4);
    const n = p.normals[0];
    if (!n) throw new Error("no normal");
    // A point 0.2 m outside the middle of the first edge, a circle of 0.38 m.
    const mid = { x: ((p.points[0]?.x ?? 0) + (p.points[1]?.x ?? 0)) / 2, z: ((p.points[0]?.z ?? 0) + (p.points[1]?.z ?? 0)) / 2 };
    const at = { x: mid.x + n.x * 0.2, z: mid.z + n.z * 0.2 };
    expect(circleTouchesPrism(p, at.x, at.z, 0.38)).toBe(true);
    const out = resolveCirclePrism(at.x, at.z, 0.38, p);
    expect(out.x - mid.x).toBeCloseTo(n.x * 0.38);
    expect(out.z - mid.z).toBeCloseTo(n.z * 0.38);
    expect(circleTouchesPrism(p, out.x, out.z, 0.379)).toBe(false);
    // The wall is turned by 17°: the push has a sideways part.
    expect(Math.abs(n.x)).toBeCloseTo(Math.sin((17 * Math.PI) / 180));
  });

  it("ejects a centre inside through the nearest wall, rounds corners, leaves the clear alone", () => {
    expect(resolveCirclePrism(1.9, 1, 0.5, square)).toEqual({ x: 2.5, z: 1 });
    const corner = resolveCirclePrism(2.2, 2.2, 0.5, square);
    expect(Math.hypot(corner.x - 2, corner.z - 2)).toBeCloseTo(0.5);
    expect(resolveCirclePrism(5, 5, 0.5, square)).toEqual({ x: 5, z: 5 });
    expect(resolveCirclePrism(2.45, 2.45, 0.5, square)).toEqual({ x: 2.45, z: 2.45 });
    expect(circleTouchesPrism(square, 2.45, 2.45, 0.5)).toBe(false);
  });

  it("intersects rays with walls, the roof and the floor", () => {
    expect(rayPrism({ x: -5, y: 1, z: 1 }, { x: 1, y: 0, z: 0 }, square, 100)).toBeCloseTo(5);
    expect(rayPrismRange({ x: -5, y: 1, z: 1 }, { x: 1, y: 0, z: 0 }, square, 100)?.[1]).toBeCloseTo(7);
    expect(rayPrism({ x: -5, y: 4, z: 1 }, { x: 1, y: 0, z: 0 }, square, 100)).toBeNull();
    expect(rayPrism({ x: -5, y: 1, z: 1 }, { x: 1, y: 0, z: 0 }, square, 4)).toBeNull();
    expect(rayPrism({ x: -5, y: 1, z: 5 }, { x: 1, y: 0, z: 0 }, square, 100)).toBeNull();
    expect(rayPrism({ x: 1, y: 10, z: 1 }, { x: 0, y: -1, z: 0 }, square, 100)).toBeCloseTo(7);
    expect(rayPrism({ x: 1, y: -1, z: 1 }, { x: 0, y: 1, z: 0 }, square, 100)).toBeCloseTo(1);
    expect(rayPrism({ x: 5, y: 1, z: 1 }, { x: 0, y: 1, z: 0 }, square, 100)).toBeNull();
    // Inside: distance 0.
    expect(rayPrism({ x: 1, y: 1, z: 1 }, { x: 1, y: 0, z: 0 }, square, 100)).toBe(0);
    // A slanted wall, diagonally.
    const p = makePrism(turned(0, 0, 10, 6, 17), 0, 4);
    const d = { x: Math.SQRT1_2, y: 0, z: Math.SQRT1_2 };
    const t = rayPrism({ x: -10, y: 1, z: -10 }, d, p, 100);
    expect(t).not.toBeNull();
    const hit = { x: -10 + d.x * (t ?? 0), z: -10 + d.z * (t ?? 0) };
    expect(edgeDistance(p, hit.x, hit.z)).toBeCloseTo(0);
  });

  it("gives a prism solid's parts as colliders and a box solid as one", () => {
    const e = { id: 1, position: { x: 0, y: 0, z: 0 }, prevPosition: { x: 0, y: 0, z: 0 }, yaw: 0, prevYaw: 0, pitch: 0, solid: square.box, prisms: [square, square] };
    const { prisms: _parts, ...b } = e;
    expect(collidersOf([e, b]).map((c) => c.prism !== null)).toEqual([true, true, false]);
  });
});
