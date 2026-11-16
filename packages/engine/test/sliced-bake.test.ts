import { describe, expect, it } from "vitest";
import { MeshSink, hexColor } from "../src/renderer/mesh-sink";
import { type BakePart, SlicedBake } from "../src/renderer/mapcity/sliced-bake";

/** Parts of some 1 000 to 40 000 vertices: a chunk (8 192) takes several small ones or one large. */
const parts: BakePart[] = Array.from({ length: 12 }, (_, k) => (sink: MeshSink) => {
  for (let i = 0; i < 50 + ((k * 337) % 1700); i++) sink.box({ x: k + i * 0.01, y: i * 0.1, z: -k }, 0.2, 0.3 + k * 0.01, 0.1, hexColor(k % 2 ? "#ff0000" : "#00ff00"));
});

describe("a mesh baked over frames (ADR-0050)", () => {
  it("packs the same vertices and triangles as the parts baked into one sink, in float32", () => {
    const whole = new MeshSink();
    for (const p of parts) p(whole);
    expect(whole.vertexCount).toBeGreaterThan(65535);
    const packed = new SlicedBake(parts).finish();
    // Byte for byte: a deep `toEqual` of some 200 000 floats each took most of the test's 20 s on CI.
    const same = (a: ArrayBufferView, b: ArrayBufferView): boolean => {
      const x = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
      const y = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
      if (x.length !== y.length) return false;
      for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
      return true;
    };
    expect(same(packed.positions, Float32Array.from(whole.positions))).toBe(true);
    expect(same(packed.normals, Float32Array.from(whole.normals))).toBe(true);
    expect(same(packed.colors, Float32Array.from(whole.colors))).toBe(true);
    expect(same(packed.uvs, Float32Array.from(whole.uvs))).toBe(true);
    expect(packed.indices).toBeInstanceOf(Uint32Array);
    expect(same(packed.indices, Uint32Array.from(whole.indices))).toBe(true);
  });

  it("stops when asked, after a part, and is ready once the last is packed", () => {
    const job = new SlicedBake(parts);
    let calls = 0;
    while (!job.ready) {
      job.run(() => true);
      calls++;
    }
    // A part a call, and packing the chunks the last.
    expect(calls).toBe(parts.length + 1);
    // A small mesh takes 16-bit indices, as Babylon would make of it.
    expect(new SlicedBake(parts.slice(0, 1)).finish().indices).toBeInstanceOf(Uint16Array);
    expect(new SlicedBake([]).finish().indices).toHaveLength(0);
  });
});
