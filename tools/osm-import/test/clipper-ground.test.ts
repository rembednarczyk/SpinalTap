import { FillRule, areaPaths, intersect } from "clipper2-ts";
import { describe, expect, it } from "vitest";
import { type Pt, bufferLine, pointInRing, selfIntersects, signedArea } from "../src/geometry.ts";
import { type Band } from "../src/ground.ts";
import { SCALE, clipperChunk, stripAxis, toPts } from "../bench/clipper-ground.ts";
import { measure } from "../bench/ground-metrics.ts";

/** The ADR-0078 prototype on small cases: what the measurement on Krakowskie rests on. */

const rect = { minX: -20, minZ: -20, maxX: 40, maxZ: 40 };
const road = (source: string, line: Pt[], w = 6): Band => ({ surface: "road", ring: bufferLine(line, w), bridge: false, source, carriageway: true, kerb: { line, half: w / 2 } });
const inAny = (p: Pt, rings: readonly Pt[][]) => rings.filter((r) => pointInRing(p, r)).length % 2 === 1;

describe("ground on Clipper2 (ADR-0078 prototype)", () => {
  it("reads a strip's axis and width back off its ring", () => {
    const line = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 15, z: 8 }];
    const axis = stripAxis(bufferLine(line, 4))!;
    expect(axis.width).toBeCloseTo(4, 6);
    for (const p of axis.line) expect(line.some((q) => Math.hypot(p.x - q.x, p.z - q.z) < 1e-6)).toBe(true);
    expect(stripAxis([{ x: 0, z: 0 }, { x: 5, z: 0 }, { x: 5, z: 5 }, { x: 1, z: 7 }])).toBeNull();
  });

  it("fills the outer corner where two ways meet end to end at a right angle (G-658)", () => {
    const bands = [road("w1", [{ x: 0, z: 0 }, { x: 20, z: 0 }]), road("w2", [{ x: 20, z: 0 }, { x: 20, z: 20 }])];
    // The outer corner of the bend, 1 m in from its edges: bare between the two square ends now.
    const corner = { x: 22, z: -2 };
    expect(bands.some((b) => pointInRing(corner, b.ring))).toBe(false);
    const rings = clipperChunk(bands, rect).flatMap((l) => l.paths.map(toPts));
    expect(inAny(corner, rings)).toBe(true);
  });

  it("lays a way looping back over itself as one ring that does not cross itself (G-654)", () => {
    const line = [{ x: 0, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 10 }, { x: 10, z: 10 }, { x: 10, z: -10 }];
    expect(selfIntersects(bufferLine(line, 4))).toBe(true);
    const rings = clipperChunk([road("w1", line, 4)], rect).flatMap((l) => l.paths.map(toPts));
    expect(rings.some((r) => selfIntersects(r))).toBe(false);
  });

  it("cuts a surface under another out of it: the pieces are disjoint and cover the same ground", () => {
    const sidewalk: Band = { surface: "sidewalk", ring: bufferLine([{ x: -10, z: 4 }, { x: 30, z: 4 }], 2), bridge: false, source: "w2" };
    const bands = [road("w1", [{ x: -10, z: 0 }, { x: 30, z: 0 }], 10), sidewalk];
    const layers = clipperChunk(bands, rect);
    expect(layers.map((l) => l.surface)).toEqual(["sidewalk", "road"]);
    expect(areaPaths(intersect(layers[0]!.paths, layers[1]!.paths, FillRule.NonZero))).toBe(0);
    const area = layers.reduce((n, l) => n + Math.abs(areaPaths(l.paths)) / (SCALE * SCALE), 0);
    expect(area).toBeCloseTo(40 * 10, 0);
    expect(Math.abs(signedArea(toPts(layers[0]!.paths[0]!)))).toBeCloseTo(2 * 40, 0);
  });

  it("counts a gap between two pieces, and none along the chunk's bare ground", () => {
    const sq = (x0: number, x1: number) => [{ x: x0, z: 0 }, { x: x1, z: 0 }, { x: x1, z: 10 }, { x: x0, z: 10 }];
    const m = measure([[sq(0, 10)], [sq(10.5, 20)]], { minX: -5, minZ: -5, maxX: 30, maxZ: 15 }, 0);
    expect(m.gaps).toBeCloseTo(0.5 * 10, 0);
    expect(m.overlap).toBe(0);
    expect(m.selfCrossing).toBe(0);
    expect(m.triangles).toBe(4);
  });
});
