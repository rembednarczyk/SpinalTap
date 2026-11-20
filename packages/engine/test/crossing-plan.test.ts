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
    const glow: number[] = [];
    for (let i = 0; i < sink.vertexCount; i++) {
      expect(sink.positions[i * 3 + 1]).toBeCloseTo(2 + SURFACE_LIFT.crossing, 5);
      // Self-lit (alpha 0): the cyan edges; the rest is the white paint.
      if (sink.colors[i * 4 + 3]! < 0.25) {
        glow.push(sink.positions[i * 3]!);
        continue;
      }
      xs.push(sink.positions[i * 3]!);
      zs.push(sink.positions[i * 3 + 2]!);
    }
    // Lublin 2077: a glowing line just outside each edge of the zebra.
    expect(Math.min(...glow)).toBeLessThan(-1.5);
    expect(Math.max(...glow)).toBeGreaterThan(1.5);
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

describe("a zebra cut by a chunk's edge (G-958)", () => {
  /** Is (x, z) under a painted triangle of the sink (white paint, or with `glow` the cyan edges)? */
  const painted = (sink: MeshSink, x: number, z: number, glow = false): boolean => {
    const p = sink.positions;
    for (let t = 0; t + 2 < sink.indices.length; t += 3) {
      const [a, b, c] = [sink.indices[t]!, sink.indices[t + 1]!, sink.indices[t + 2]!];
      if (sink.colors[a * 4 + 3]! < 0.25 !== glow) continue;
      const [ax, az, bx, bz, cx, cz] = [p[a * 3]!, p[a * 3 + 2]!, p[b * 3]!, p[b * 3 + 2]!, p[c * 3]!, p[c * 3 + 2]!];
      const d1 = (x - bx) * (az - bz) - (ax - bx) * (z - bz);
      const d2 = (x - cx) * (bz - cz) - (bx - cx) * (z - cz);
      const d3 = (x - ax) * (cz - az) - (cx - ax) * (z - az);
      if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) return true;
    }
    return false;
  };
  /** Paint along the band's middle line across the road, every 5 cm (off the stripes' own edges). */
  const across = (sink: MeshSink): boolean[] => Array.from({ length: 139 }, (_, i) => painted(sink, 0.3, -3.45 + i * 0.05 + 0.012));
  /** The cyan edge lines along both long sides of the band, every 5 cm. */
  const edges = (sink: MeshSink): boolean[] => [-1.62, 1.62].flatMap((x) => Array.from({ length: 139 }, (_, i) => painted(sink, x, -3.45 + i * 0.05 + 0.012, true)));
  // The chunk's edge at z 1.2 cuts the band into a long piece and a short one.
  const south = [{ x: -1.5, z: -3.5 }, { x: 1.5, z: -3.5 }, { x: 1.5, z: 1.2 }, { x: -1.5, z: 1.2 }];
  const north = [{ x: -1.5, z: 1.2 }, { x: 1.5, z: 1.2 }, { x: 1.5, z: 3.5 }, { x: -1.5, z: 3.5 }];

  it("stripes both pieces in the whole band's frame: together the same stripes as the whole zebra", () => {
    const whole = new MeshSink();
    planCrossing(whole, band, () => 0);
    const pieces = new MeshSink();
    planCrossing(pieces, south, () => 0, band);
    planCrossing(pieces, north, () => 0, band);
    expect(across(pieces)).toEqual(across(whole));
  });

  it("draws the cyan edge lines outside the band on: the pieces' together as the whole zebra's", () => {
    const whole = new MeshSink();
    planCrossing(whole, band, () => 0);
    expect(edges(whole).filter(Boolean).length).toBeGreaterThan(200);
    // A straight cut and a slanting one: either way the pieces' lines meet end to end.
    const slant = [
      [{ x: -1.5, z: -3.5 }, { x: 1.5, z: -3.5 }, { x: 1.5, z: 0.4 }, { x: -1.5, z: 1.9 }],
      [{ x: -1.5, z: 1.9 }, { x: 1.5, z: 0.4 }, { x: 1.5, z: 3.5 }, { x: -1.5, z: 3.5 }],
    ];
    for (const [a, b] of [[south, north], slant] as const) {
      const pieces = new MeshSink();
      planCrossing(pieces, a!, () => 0, band);
      planCrossing(pieces, b!, () => 0, band);
      expect(edges(pieces)).toEqual(edges(whole));
    }
  });

  it("without the band, the short piece stripes in its own frame, off the whole zebra's stripes", () => {
    const whole = new MeshSink();
    planCrossing(whole, band, () => 0);
    const pieces = new MeshSink();
    planCrossing(pieces, south, () => 0);
    planCrossing(pieces, north, () => 0);
    expect(across(pieces)).not.toEqual(across(whole));
  });
});
