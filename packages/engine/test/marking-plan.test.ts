import { describe, expect, it } from "vitest";
import { MeshSink } from "../src/renderer/mesh-sink";
import { MARKING_LIFT, dashes, planMarking } from "../src/renderer/mapcity/marking-plan";

const line = [
  { x: 0, z: 0 },
  { x: 40, z: 0 },
];

/** The area the triangles of `sink` cover, seen from above. */
const paintedArea = (sink: MeshSink): number => {
  let s = 0;
  const p = sink.positions;
  for (let t = 0; t < sink.indices.length; t += 3) {
    const [a, b, c] = [sink.indices[t]!, sink.indices[t + 1]!, sink.indices[t + 2]!].map((i) => ({ x: p[i * 3]!, z: p[i * 3 + 2]! }));
    s += Math.abs((b!.x - a!.x) * (c!.z - a!.z) - (c!.x - a!.x) * (b!.z - a!.z)) / 2;
  }
  return s;
};

describe("road markings in the picture (ADR-0052)", () => {
  it("break a centre line into dashes centred on the line, the same from either end", () => {
    const d = dashes(40, 3, 5);
    expect(d.length).toBe(5);
    expect(d[0]![0]).toBeCloseTo(40 - d[4]![1], 9);
    for (const [a, b] of d) expect(b - a).toBeCloseTo(3, 9);
    expect(dashes(40, 1, 0)).toEqual([[0, 40]]);
  });

  it("paint the lines self-lit on the road, the double one as two lines", () => {
    const one = new MeshSink();
    planMarking(one, "edge", line, () => 1);
    const two = new MeshSink();
    planMarking(two, "centre-double", line, () => 1);
    // Two lines of the centre's width, 0.12 m apart between them; the drape cuts them on its own grid (G-301).
    expect(paintedArea(two)).toBeCloseTo(2 * 40 * 0.12, 6);
    expect(paintedArea(one)).toBeCloseTo(40 * 0.15, 6);
    expect(Array.from({ length: two.vertexCount }, (_, i) => Math.abs(two.positions[i * 3 + 2]!)).every((z) => z > 0.06 - 1e-9)).toBe(true);
    for (let i = 0; i < one.vertexCount; i++) {
      expect(one.positions[i * 3 + 1]).toBeCloseTo(1 + MARKING_LIFT, 5);
      expect(one.colors[i * 4 + 3]).toBe(0);
    }
    const zs = Array.from({ length: two.vertexCount }, (_, i) => two.positions[i * 3 + 2]!);
    expect(Math.max(...zs)).toBeCloseTo(0.18, 5);
    expect(Math.min(...zs)).toBeCloseTo(-0.18, 5);
  });

  it("lay a cycle lane's dim band under its glowing borders", () => {
    const sink = new MeshSink();
    planMarking(sink, "cycle-lane", line, () => 0);
    const lit = Array.from({ length: sink.vertexCount }, (_, i) => sink.colors[i * 4 + 3]!).filter((a) => a === 0).length;
    expect(lit).toBeGreaterThan(0);
    expect(lit).toBeLessThan(sink.vertexCount);
  });
});
