import { describe, expect, it } from "vitest";
import { MeshSink } from "../src/renderer/mesh-sink";
import { SURFACE_LIFT } from "../src/renderer/mapcity/ground-plan";
import { ZEBRA_STRIPE, planCrossing } from "../src/renderer/mapcity/crossing-plan";

/** A zebra across a 7 m road running east: 3 m along x, 7 m across z. */
const band = [
  { x: -1.5, z: -3.5 },
  { x: 1.5, z: -3.5 },
  { x: 1.5, z: 3.5 },
  { x: -1.5, z: 3.5 },
];

describe("zebra crossings (ADR-0042)", () => {
  it("stripe the road from kerb to kerb, along the road, half a metre wide with as wide a gap", () => {
    const sink = new MeshSink();
    planCrossing(sink, band, () => 2);
    const xs: number[] = [];
    const zs: number[] = [];
    for (let i = 0; i < sink.vertexCount; i++) {
      xs.push(sink.positions[i * 3]!);
      zs.push(sink.positions[i * 3 + 2]!);
      expect(sink.positions[i * 3 + 1]).toBeCloseTo(2 + SURFACE_LIFT.crossing, 5);
    }
    // Along the road the stripes span the band; across it they stop short of the kerbs.
    expect(Math.min(...xs)).toBeCloseTo(-1.5, 5);
    expect(Math.max(...xs)).toBeCloseTo(1.5, 5);
    expect(Math.max(...zs)).toBeLessThanOrEqual(3.5 - 0.25 + 1e-6);
    // Seven stripes across 6.5 m: their edges every half metre.
    const edges = new Set(zs.map((z) => Math.round(z / ZEBRA_STRIPE)));
    expect(edges.size).toBe(14);
  });

  it("draws nothing on a band too small to stripe", () => {
    const sink = new MeshSink();
    planCrossing(sink, [{ x: 0, z: 0 }, { x: 0.3, z: 0 }, { x: 0.3, z: 0.3 }], () => 0);
    expect(sink.vertexCount).toBe(0);
  });
});
