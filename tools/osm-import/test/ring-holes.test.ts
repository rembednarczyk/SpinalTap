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
    // A street's band and the lawns themselves are left as they were.
    expect(openPavings(bands, () => true).slice(1)).toEqual(bands.slice(1));
    expect(openPavings([band("road", rect(0, 0, 100, 60), "w7"), bands[1]!], () => true)[0]!.holed).toBeUndefined();
  });

  it("cuts the larger of two lawns that touch, and leaves the other under the paving", () => {
    const [out] = openPavings([band("square", rect(0, 0, 100, 60), "r1"), band("grass", rect(10, 10, 30, 30), "w2"), band("grass", rect(30, 10, 40, 30), "w3")], () => true);
    expect(signedArea(out!.ring)).toBeCloseTo(6000 - 400, 6);
  });

  it("keeps a chunk's piece of the paving open over a lawn on the chunk's edge", () => {
    const [out] = openPavings([band("square", rect(0, 0, 100, 60), "r1"), band("grass", rect(40, 10, 60, 30), "w2")], () => true);
    const pieces = [rect(0, -10, 50, 70), rect(50, -10, 110, 70)].flatMap((r) => chunkGround([out!], { minX: r[0]!.x, minZ: r[0]!.z, maxX: r[2]!.x, maxZ: r[2]!.z }));
    expect(pieces.map((g) => Math.abs(signedArea(ringOf(g.outline)))).reduce((s, a) => s + a, 0)).toBeCloseTo(6000 - 400, 6);
    expect(pieces.some((g) => pointInRing({ x: 45, z: 20 }, ringOf(g.outline)) || pointInRing({ x: 55, z: 20 }, ringOf(g.outline)))).toBe(false);
  });
});
