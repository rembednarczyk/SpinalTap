import { describe, expect, it } from "vitest";
import { type Pt, type Rect, pointInRing, ringBounds, signedArea } from "../src/geometry.ts";
import { type Band, chunkGround, openPavings } from "../src/ground.ts";
import { cutHoles } from "../src/ring-holes.ts";

/** Lawns mapped inside a square cut out of its paving (G-421). */

const rect = (x0: number, z0: number, x1: number, z1: number): Pt[] => [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
const band = (surface: Band["surface"], ring: Pt[], source: string): Band & { box: Rect } => ({ surface, ring, bridge: false, source, box: ringBounds(ring) });
const ringOf = (outline: readonly number[]): Pt[] => Array.from({ length: outline.length / 2 }, (_, i) => ({ x: outline[2 * i]!, z: outline[2 * i + 1]! }));

describe("holes in a ground ring (G-421)", () => {
  it("joins each hole to the ring by a seam: read even-odd, the ring less its holes", () => {
    const ring = cutHoles(rect(0, 0, 100, 60), [rect(10, 10, 30, 30), rect(60, 20, 80, 50), rect(35, 35, 50, 55)]);
    expect(signedArea(ring)).toBeCloseTo(6000 - 400 - 600 - 300, 6);
    for (const p of [{ x: 20, z: 20 }, { x: 70, z: 30 }, { x: 40, z: 40 }]) expect(pointInRing(p, ring)).toBe(false);
    for (const p of [{ x: 5, z: 5 }, { x: 45, z: 20 }, { x: 90, z: 55 }]) expect(pointInRing(p, ring)).toBe(true);
  });

  it("cuts the lawns and the water mapped inside a square's paving, and nothing else", () => {
    const square = band("square", rect(0, 0, 100, 60), "r1");
    const bands = [
      square,
      band("grass", rect(10, 10, 30, 30), "w2"),
      band("water", rect(60, 20, 70, 30), "w3"),
      // Over the square's edge, a lawn with a hole of its own, a fountain over the paving: the paving stays.
      band("grass", rect(90, 40, 110, 50), "w4"),
      band("grass", rect(40, 40, 50, 50), "w5"),
      band("basin", rect(75, 5, 85, 15), "w6"),
    ];
    const [out] = openPavings(bands, (b) => b.source !== "w5");
    expect(out!.holed).toBe(true);
    expect(signedArea(out!.ring)).toBeCloseTo(6000 - 400 - 100, 6);
    for (const p of [{ x: 95, z: 45 }, { x: 45, z: 45 }, { x: 80, z: 10 }]) expect(pointInRing(p, out!.ring)).toBe(true);
    // The lawn and the water cut out are laid as their holes, not simplified again in a chunk (T-202); the rest as they were.
    const all = openPavings(bands, (b) => b.source !== "w5");
    expect(all.slice(1).map((b) => b.holed ?? false)).toEqual([true, true, false, false, false]);
    expect(all.slice(3)).toEqual(bands.slice(3));
    expect(openPavings([band("road", rect(0, 0, 100, 60), "w7"), bands[1]!], () => true)[0]!.holed).toBeUndefined();
  });

  it("cuts the larger of two lawns that touch, and leaves the other under the paving", () => {
    const [out] = openPavings([band("square", rect(0, 0, 100, 60), "r1"), band("grass", rect(10, 10, 30, 30), "w2"), band("grass", rect(30, 10, 40, 30), "w3")], () => true);
    expect(signedArea(out!.ring)).toBeCloseTo(6000 - 400, 6);
  });

  it("keeps a chunk's piece of the paving open over a lawn on the chunk's edge, and the lawn filling it", () => {
    // A lawn with a corner the chunk's simplification would drop (0.2 m off its edge, T-202).
    const lawn = [{ x: 40, z: 10 }, { x: 60, z: 10 }, { x: 60, z: 30 }, { x: 50.3, z: 30.2 }, { x: 40, z: 30 }];
    const [out, grass] = openPavings([band("square", rect(0, 0, 100, 60), "r1"), band("grass", lawn, "w2")], () => true);
    const chunks = [rect(0, -10, 50, 70), rect(50, -10, 110, 70)].map((r) => ({ minX: r[0]!.x, minZ: r[0]!.z, maxX: r[2]!.x, maxZ: r[2]!.z }));
    const paving = chunks.flatMap((r) => chunkGround([out!], r)).map((g) => ringOf(g.outline));
    const lawns = chunks.flatMap((r) => chunkGround([grass!], r)).map((g) => ringOf(g.outline));
    expect(paving.map((r) => Math.abs(signedArea(r))).reduce((s, a) => s + a, 0)).toBeCloseTo(6000 - 400, 0);
    expect(paving.some((r) => pointInRing({ x: 45, z: 20 }, r) || pointInRing({ x: 55, z: 20 }, r))).toBe(false);
    // Every point by the chunk's edge off the paving lies on the lawn drawn in its hole.
    const bare: string[] = [];
    for (let x = 48.05; x < 52; x += 0.1) for (let z = 29.825; z < 30.3; z += 0.05) if (!paving.some((r) => pointInRing({ x, z }, r)) && !lawns.some((r) => pointInRing({ x, z }, r))) bare.push(`${x.toFixed(2)},${z.toFixed(3)}`);
    expect(bare).toEqual([]);
  });
});

/** A lawn inside a square whose outline runs along the square's, as on Plac Czechowicza (G-427, T-197). */
describe("a lawn on a square's edge (G-427)", () => {
  // The lawn's corners on the square's top edge are not corners of the square's ring.
  const square = band("square", rect(0, 0, 100, 60), "w1");
  const lawn = band("grass", rect(10, 40, 30, 60), "w2");

  it("cuts the lawn out of the paving as a notch in its edge, and lays the lawn as the notch", () => {
    const [out, grass] = openPavings([square, lawn], () => true);
    expect(out!.holed).toBe(true);
    expect(signedArea(out!.ring)).toBeCloseTo(6000 - 400, 6);
    for (const p of [{ x: 20, z: 50 }, { x: 11, z: 59 }]) expect(pointInRing(p, out!.ring)).toBe(false);
    for (const p of [{ x: 5, z: 55 }, { x: 20, z: 30 }, { x: 50, z: 59 }]) expect(pointInRing(p, out!.ring)).toBe(true);
    expect(grass!.holed).toBe(true);
    // Read in chunks whose edges cross the lawn, the paving and the lawn leave nothing bare between them.
    const chunks = [rect(0, -10, 20, 70), rect(20, -10, 110, 70)].map((r) => ({ minX: r[0]!.x, minZ: r[0]!.z, maxX: r[2]!.x, maxZ: r[2]!.z }));
    const paving = chunks.flatMap((r) => chunkGround([out!], r)).map((g) => ringOf(g.outline));
    const lawns = chunks.flatMap((r) => chunkGround([grass!], r)).map((g) => ringOf(g.outline));
    const bare: string[] = [];
    for (let x = 8.05; x < 32; x += 0.1) for (let z = 38.05; z < 60; z += 0.1) if (!paving.some((r) => pointInRing({ x, z }, r)) && !lawns.some((r) => pointInRing({ x, z }, r))) bare.push(`${x.toFixed(2)},${z.toFixed(2)}`);
    expect(bare).toEqual([]);
    expect(paving.some((r) => lawns.some((l) => pointInRing({ x: 20.05, z: 50 }, r) && pointInRing({ x: 20.05, z: 50 }, l)))).toBe(false);
  });

  it("cuts a notch where the lawn shares corners with the square, along two of its edges", () => {
    const corner = band("square", [{ x: 0, z: 0 }, { x: 100, z: 0 }, { x: 100, z: 60 }, { x: 30, z: 60 }, { x: 10, z: 60 }, { x: 0, z: 60 }], "w1");
    const [out] = openPavings([corner, band("grass", [{ x: 80, z: 30 }, { x: 100, z: 30 }, { x: 100, z: 60 }, { x: 70, z: 60 }], "w2")], () => true);
    expect(signedArea(out!.ring)).toBeCloseTo(6000 - 750, 6);
  });

  it("leaves a paved patch of a park, a lawn over the square's edge and one touching it in two places as they were", () => {
    const patch = band("square", rect(20, 20, 30, 30), "w1");
    expect(openPavings([patch, band("grass", rect(0, 0, 100, 60), "w2")], () => true)).toEqual([patch, band("grass", rect(0, 0, 100, 60), "w2")]);
    const over = band("grass", rect(10, 40, 30, 70), "w2");
    expect(openPavings([square, over], () => true)).toEqual([square, over]);
    // A lawn across the square from edge to edge would part the paving in two.
    const across = band("grass", rect(40, 0, 50, 60), "w2");
    expect(openPavings([square, across], () => true)).toEqual([square, across]);
  });
});
