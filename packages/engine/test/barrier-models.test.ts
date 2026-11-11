import { type BarrierKind, type BarrierMaterial, barrierVariant } from "@seki/core";
import { describe, expect, it } from "vitest";
import { MeshSink } from "../src/renderer/mesh-sink";
import { bakeBarrier, barrierModel } from "../src/renderer/mapcity/barrier-models";
import { nearSink } from "../src/renderer/mapcity/prop-block";
import type { WorldProp } from "../src/renderer/mapcity/prop-batch";
import type { PropPoles } from "../src/renderer/mapcity/prop-poles";

/** The map's walls, fences, hedges and gates (ADR-0077 point 4) as the renderer bakes them with the furniture. */

const variant = (kind: BarrierKind, length = 3, height = 1.6, rise = 0, material: BarrierMaterial = "plain") => barrierVariant({ kind, length, height, rise, material });

const bounds = (s: MeshSink) => {
  const at = (k: number) => s.positions.filter((_, i) => i % 3 === k);
  return { x0: Math.min(...at(0)), x1: Math.max(...at(0)), y0: Math.min(...at(1)), y1: Math.max(...at(1)), z0: Math.min(...at(2)), z1: Math.max(...at(2)) };
};

/** The colours of a sink's vertices as `r,g,b`, rounded. */
const colours = (s: MeshSink) => new Set(Array.from({ length: s.vertexCount }, (_, i) => [0, 1, 2].map((k) => s.colors[i * 4 + k]!.toFixed(2)).join(",")));

describe("barriers of the map in the renderer (ADR-0077)", () => {
  it("draw a wall along its +z at its length and height, from under the ground, with its coping", () => {
    const b = bounds(barrierModel(variant("wall", 3, 1), "high")!);
    expect(b.z1 - b.z0).toBeCloseTo(3);
    expect(b.y1).toBeCloseTo(1);
    expect(b.y0).toBeCloseTo(-0.3);
    // The coping a little wider than the 0.3 m wall.
    expect(b.x1 - b.x0).toBeCloseTo(0.36);
  });

  it("follow the ground's rise: the top and the foot climb with it", () => {
    const s = barrierModel(variant("hedge", 4, 1.2, 0.4), "high")!;
    const top = (z: number) => Math.max(...Array.from({ length: s.vertexCount }, (_, i) => i).filter((i) => Math.abs(s.positions[i * 3 + 2]! - z) < 1e-6).map((i) => s.positions[i * 3 + 1]!));
    expect(top(2) - top(-2)).toBeCloseTo(0.4);
    expect(top(2)).toBeCloseTo(1.4);
  });

  it("draw a fence open: posts and rails, bars between them except on the phones, iron or wood", () => {
    const high = barrierModel(variant("fence", 3), "high")!;
    const low = barrierModel(variant("fence", 3), "low")!;
    expect(high.indices.length).toBeGreaterThan(low.indices.length * 2);
    // Not a solid sheet: the fence's footprint is its posts' width, no wall.
    const b = bounds(high);
    expect(b.x1 - b.x0).toBeLessThanOrEqual(0.081);
    expect(b.y1).toBeCloseTo(1.6);
    expect(colours(high)).not.toEqual(colours(barrierModel(variant("fence", 3, 1.6, 0, "wood"), "high")!));
  });

  it("draw brick for the city walls and the map's brick, stone and concrete apart", () => {
    const of = (kind: BarrierKind, m: BarrierMaterial) => [...colours(barrierModel(variant(kind, 3, 2, 0, m), "high")!)].sort().join(" ");
    expect(of("city-wall", "plain")).toBe(of("wall", "brick"));
    expect(of("wall", "plain")).not.toBe(of("wall", "brick"));
    expect(of("wall", "stone")).not.toBe(of("wall", "plain"));
  });

  it("draw the walls and hedges far, the fences and gates only near", () => {
    expect(barrierModel(variant("wall"), "high", true)).not.toBeNull();
    expect(barrierModel(variant("hedge"), "high", true)).not.toBeNull();
    expect(barrierModel(variant("fence"), "high", true)).toBeNull();
    expect(barrierModel(variant("gate"), "high", true)).toBeNull();
    // A gate: two posts at the ends of its opening; a lift gate's arm stands up over its post.
    const gate = bounds(barrierModel(variant("gate", 3, 1.6), "high")!);
    expect(gate.z1 - gate.z0).toBeCloseTo(3.2);
    expect(bounds(barrierModel(variant("lift-gate", 4, 1.1), "high")!).y1).toBeGreaterThan(3);
  });

  it("bake into the block's mesh with the furniture, turned along their line, no mesh of their own", () => {
    const p: WorldProp = { prop: "barrier", x: 10, y: 5, z: 20, yaw: Math.PI / 2, shape: 0, scale: 1, variant: variant("wall", 4, 1) };
    const sink = new MeshSink();
    bakeBarrier(sink, p, "high");
    const b = bounds(sink);
    expect(b.x1 - b.x0).toBeCloseTo(4);
    expect(b.z1 - b.z0).toBeCloseTo(0.36);
    expect(b.y1).toBeCloseTo(6);
    const poles = { isPole: () => false, pole: null, props: null, models: null, dog: null, far: null } as unknown as PropPoles;
    // A block far from the set pieces it bakes too (the metro's pavilions, Alchemia).
    const block = { pieces: new Map([[1, [p]]]), bounds: { minX: 5120, minZ: 5120, maxX: 5376, maxZ: 5376 } };
    expect(nearSink({ quality: "high", poles }, block).vertexCount).toBe(sink.vertexCount);
  });
});
