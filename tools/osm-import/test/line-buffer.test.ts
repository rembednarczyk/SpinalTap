import { describe, expect, it } from "vitest";
import { type Line } from "../src/features.ts";
import { type Pt, pointInRing, selfIntersects } from "../src/geometry.ts";
import { joinedPoints, lineBands } from "../src/ground.ts";
import { bufferBand, roundJoints, stripBand } from "../src/line-buffer.ts";

const pts = (xs: readonly (readonly [number, number])[]): Pt[] => xs.map(([x, z]) => ({ x, z }));
const line = (id: string, tags: Line["tags"], xs: readonly (readonly [number, number])[]): Line => ({ id, osmId: Number(id.slice(1)), tags, line: pts(xs) });
const covered = (rings: readonly (readonly Pt[])[], p: Pt) => rings.some((r) => pointInRing(p, r));

describe("bands along lines on Clipper2 (ADR-0078, step 2)", () => {
  // A service road looping round onto a node of its own, like w173489056 in Nabrzeże (G-658).
  const lollipop = line("w173489056", { highway: "service" }, [[0, 0], [20, 0], [30, -8], [40, 0], [30, 8], [20, 0]]);

  it("lays a lollipop's carriageway as one outline that does not cross itself, its loop's inside a hole", () => {
    const road = lineBands(lollipop, false).filter((b) => b.carriageway);
    expect(road).toHaveLength(1);
    expect(selfIntersects(road[0]!.ring)).toBe(false);
    // The loop's middle is no road, the loop's way and its tail are.
    expect(covered([road[0]!.ring], { x: 30, z: 0 })).toBe(false);
    for (const p of [{ x: 5, z: 0 }, { x: 35, z: 4 }, { x: 25, z: -4 }]) expect(covered([road[0]!.ring], p)).toBe(true);
  });

  it("lays a closed footway as a ring round its hole, with no seam where it closes", () => {
    const loop = line("w7", { highway: "footway" }, [[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]]);
    const [band, ...rest] = lineBands(loop, false);
    expect(rest).toHaveLength(0);
    expect(selfIntersects(band!.ring)).toBe(false);
    expect(covered([band!.ring], { x: 10, z: 10 })).toBe(false);
    // The corner it closes on is round outside, as the others are, and covered.
    for (const p of [{ x: -0.8, z: -0.8 }, { x: 20.8, z: 20.8 }, { x: 0, z: 0 }]) expect(covered([band!.ring], p)).toBe(true);
  });

  it("fills the outer corner where two ways meet end to end, and leaves a dead end square", () => {
    const a = line("w1", { highway: "residential", sidewalk: "no" }, [[-30, 0], [0, 0]]);
    const b = line("w2", { highway: "residential", sidewalk: "no" }, [[0, 0], [0, 30]]);
    const joined = joinedPoints([a, b]);
    const bands = [...lineBands(a, false, [], false, joined), ...lineBands(b, false, [], false, joined)];
    // 6.5 m wide: the corner's outer side 3.25 m off the node, along the diagonal.
    const corner = { x: 2.1, z: -2.1 };
    expect(covered(bands.map((x) => x.ring), corner)).toBe(false);
    const rings = roundJoints(bands).map((x) => x.ring);
    expect(covered(rings, corner)).toBe(true);
    for (const r of rings) expect(selfIntersects(r)).toBe(false);
    // The dead ends stay square: nothing past them.
    expect(covered(rings, { x: -30.5, z: 0 })).toBe(false);
    expect(covered(rings, { x: 0, z: 30.5 })).toBe(false);
  });

  it("lays a round end only on bare ground, not over the way it meets", () => {
    const a = line("w1", { highway: "residential", sidewalk: "no" }, [[-30, 0], [0, 0]]);
    const b = line("w2", { highway: "residential", sidewalk: "no" }, [[0, 0], [30, 0]]);
    const joined = joinedPoints([a, b]);
    const bands = [...lineBands(a, false, [], false, joined), ...lineBands(b, false, [], false, joined)];
    // Straight on: nothing bare to fill, the bands as they were.
    expect(roundJoints(bands).map((x) => x.ring)).toEqual(bands.map((x) => x.ring));
  });

  it("lays a sidewalk's inner edge on its carriageway's edge round a bend, with no gap", () => {
    const axis = pts([[0, 0], [30, 0], [50, 15]]);
    const road = bufferBand(axis, 6);
    const [left] = stripBand(axis, 3, 2.5);
    expect(left).toBeDefined();
    // Just off the road's outer edge at the bend, on the sidewalk's side (left: z up).
    for (const p of [{ x: 30, z: 3.05 }, { x: 29.2, z: 3.05 }, { x: 31.2, z: 2.9 }]) expect(covered([...road, left!], p)).toBe(true);
  });

  it("bends a band round a sharp turn without crossing itself", () => {
    const hairpin = pts([[0, 0], [30, 0], [0, 1.5]]);
    for (const r of bufferBand(hairpin, 6)) expect(selfIntersects(r)).toBe(false);
    for (const r of stripBand(hairpin, 3, 2.5)) expect(selfIntersects(r)).toBe(false);
  });

  it("gives the same rings twice", () => {
    expect(lineBands(lollipop, false)).toEqual(lineBands(lollipop, false));
  });
});
