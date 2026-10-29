import { describe, expect, it } from "vitest";
import { bufferLine, ccw, clipLineToRect, clipRingToRect, openRing, pointInRing, selfIntersects, signedArea, simplifyRing, stripAlong } from "../src/geometry.ts";
import { prepareOutline } from "../src/buildings.ts";

const pts = (...xs: number[]) => {
  const out = [];
  for (let i = 0; i < xs.length; i += 2) out.push({ x: xs[i]!, z: xs[i + 1]! });
  return out;
};

describe("rings", () => {
  it("orients counter-clockwise and drops the closing point", () => {
    const cw = pts(0, 0, 0, 10, 10, 10, 10, 0, 0, 0);
    const ring = ccw(openRing(cw));
    expect(ring).toHaveLength(4);
    expect(signedArea(ring)).toBe(100);
  });

  it("finds self-intersections", () => {
    expect(selfIntersects(pts(0, 0, 10, 10, 10, 0, 0, 10))).toBe(true);
    expect(selfIntersects(pts(0, 0, 10, 0, 10, 10, 0, 10))).toBe(false);
  });

  it("tests points inside", () => {
    const sq = pts(0, 0, 10, 0, 10, 10, 0, 10);
    expect(pointInRing({ x: 5, z: 5 }, sq)).toBe(true);
    expect(pointInRing({ x: 15, z: 5 }, sq)).toBe(false);
  });
});

describe("simplification to 0.3 m", () => {
  it("removes bumps under the tolerance and keeps corners", () => {
    // A 20 × 10 block whose long wall has a 0.2 m kink and a 1 m bay.
    const ring = pts(0, 0, 5, 0.2, 10, 0, 12, 0, 12, -1, 15, -1, 15, 0, 20, 0, 20, 10, 0, 10);
    const s = simplifyRing(ring, 0.3);
    expect(s.some((p) => p.x === 5)).toBe(false);
    expect(s.some((p) => p.x === 12 && p.z === -1)).toBe(true);
    expect(s.some((p) => p.x === 20 && p.z === 10)).toBe(true);
    expect(Math.abs(signedArea(s) - signedArea(ring))).toBeLessThan(1.5);
  });

  it("drops collinear points of straight walls", () => {
    expect(simplifyRing(pts(0, 0, 5, 0, 10, 0, 10, 10, 5, 10, 0, 10), 0.3)).toHaveLength(4);
  });

  it("prepares an outline around its rounded centroid", () => {
    const p = prepareOutline(pts(100, 200, 112.04, 200.01, 112, 210, 100, 210))!;
    expect(p.center).toEqual({ x: 106, z: 205 });
    expect(signedArea(p.outline)).toBeGreaterThan(0);
    for (const q of p.outline) {
      expect(Math.round(q.x * 10) / 10).toBe(q.x);
      expect(Math.round(q.z * 10) / 10).toBe(q.z);
    }
    expect(prepareOutline(pts(0, 0, 1, 0, 1, 1))).toBeNull();
  });
});

describe("clipping and bands", () => {
  const rect = { minX: 0, minZ: 0, maxX: 10, maxZ: 10 };

  it("clips a ring to a rectangle", () => {
    const c = clipRingToRect(pts(-5, -5, 5, -5, 5, 5, -5, 5), rect);
    expect(Math.abs(signedArea(c))).toBeCloseTo(25, 9);
    expect(clipRingToRect(pts(20, 20, 30, 20, 30, 30), rect)).toEqual([]);
  });

  it("clips a line to a rectangle", () => {
    const pieces = clipLineToRect(pts(-5, 5, 15, 5), rect);
    expect(pieces).toEqual([pts(0, 5, 10, 5)]);
  });

  it("buffers a line to its width and offsets strips to one side", () => {
    expect(Math.abs(signedArea(bufferLine(pts(0, 0, 10, 0), 4)))).toBeCloseTo(40, 9);
    const left = stripAlong(pts(0, 0, 10, 0), 2, 3);
    expect(Math.min(...left.map((p) => p.z))).toBeCloseTo(2, 9);
    expect(Math.max(...left.map((p) => p.z))).toBeCloseTo(5, 9);
  });
});
