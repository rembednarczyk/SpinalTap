import type { GroundSurface, Vec3, ViewDescriptor } from "@seki/core";
import { describe, expect, it } from "vitest";
import { drawnPavingOf } from "../src/renderer/drones/patrol-paving";
import { POOL_LIFT, pavingAt } from "../src/renderer/drones/patrol-pool";
import { MeshSink } from "../src/renderer/mesh-sink";
import { SURFACE_LIFT, drapeHeightAt, planSurface } from "../src/renderer/mapcity/ground-plan";
import { type P2, triangulate } from "../src/renderer/mapcity/polygon";

/** A hollow: the ground bends down to 0.3 m under a point, so 5 m straight drapes run over it. */
const hollow = (x: number, z: number) => -0.3 * Math.exp(-((x - 12) ** 2 + (z - 9) ** 2) / 40);

/** The height of the triangles drawn in `sink` over (x, z), the highest, null off them. */
const drawnIn = (sink: MeshSink, x: number, z: number): number | null => {
  const p = sink.positions;
  let top: number | null = null;
  for (let t = 0; t < sink.indices.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => (sink.indices[t + k] as number) * 3) as [number, number, number];
    const d = (p[b + 2]! - p[c + 2]!) * (p[a]! - p[c]!) + (p[c]! - p[b]!) * (p[a + 2]! - p[c + 2]!);
    if (Math.abs(d) < 1e-12) continue;
    const wa = ((p[b + 2]! - p[c + 2]!) * (x - p[c]!) + (p[c]! - p[b]!) * (z - p[c + 2]!)) / d;
    const wb = ((p[c + 2]! - p[a + 2]!) * (x - p[c]!) + (p[a]! - p[c]!) * (z - p[c + 2]!)) / d;
    if (wa < -1e-9 || wb < -1e-9 || wa + wb > 1 + 1e-9) continue;
    const y = wa * p[a + 1]! + wb * p[b + 1]! + (1 - wa - wb) * p[c + 1]!;
    top = top === null ? y : Math.max(top, y);
  }
  return top;
};

const RING: P2[] = [
  { x: 0, z: 0 },
  { x: 26, z: 0 },
  { x: 26, z: 7 },
  { x: 17, z: 18 },
  { x: 0, z: 16 },
];

const ground = (surface: GroundSurface, ring: readonly P2[]): { view: ViewDescriptor; at: Vec3 } => ({
  view: { kind: "ground", surface, outline: ring.map((q) => ({ x: q.x, z: q.z })) } as unknown as ViewDescriptor,
  at: { x: 0, y: 0, z: 0 },
});

describe("the paving as the map city drapes it (G-293)", () => {
  it("reads the height `planSurface` draws, not the ground and the lift, in a hollow", () => {
    const sink = new MeshSink();
    planSurface(sink, "square", RING, hollow, null);
    const tris = triangulate(RING);
    let over = 0;
    for (let x = 0.3; x < 26; x += 0.7) {
      for (let z = 0.3; z < 18; z += 0.7) {
        const drawn = drawnIn(sink, x, z);
        const read = drapeHeightAt(RING, tris, hollow, SURFACE_LIFT.square, x, z);
        expect(read === null).toBe(drawn === null);
        if (drawn === null || read === null) continue;
        expect(read).toBeCloseTo(drawn, 6);
        over = Math.max(over, drawn - hollow(x, z) - SURFACE_LIFT.square);
      }
    }
    // What G-293 was: the straight drape runs centimetres over the ground in the hollow.
    expect(over).toBeGreaterThan(POOL_LIFT);
  });

  it("takes the highest of overlapping pieces and the given height off them", () => {
    const off = () => -5;
    const walk: P2[] = [{ x: 10, z: 2 }, { x: 14, z: 2 }, { x: 14, z: 6 }, { x: 10, z: 6 }];
    const paving = drawnPavingOf([ground("square", RING), ground("footway", walk)], hollow, off);
    const square = (x: number, z: number) => drapeHeightAt(RING, triangulate(RING), hollow, SURFACE_LIFT.square, x, z)!;
    const footway = (x: number, z: number) => drapeHeightAt(walk, triangulate(walk), hollow, SURFACE_LIFT.footway, x, z)!;
    expect(paving(5, 5)).toBeCloseTo(square(5, 5), 9);
    expect(square(12.5, 3)).not.toBeCloseTo(footway(12.5, 3), 3);
    expect(paving(12.5, 3)).toBeCloseTo(Math.max(square(12.5, 3), footway(12.5, 3)), 9);
    expect(paving(40, 40)).toBe(-5);
  });

  it("lays a pool's point on the highest paving round it: a seam does not pull it down, a step lifts it", () => {
    const flat = (x: number) => (Math.abs(x - 0.05) < 0.02 ? -0.04 : x > 0.1 ? 0.03 : 0);
    expect(pavingAt(flat, 0, 5)).toBe(0.03);
    expect(pavingAt(() => 0.2, 3, 3)).toBe(0.2);
    const seam = (x: number) => (Math.abs(x) < 0.05 ? -0.04 : 0);
    expect(pavingAt(seam, 0, 0)).toBe(0);
  });
});
