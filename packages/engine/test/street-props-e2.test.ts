import type { StreetPropKind } from "@seki/core";
import { furniturePrisms } from "@seki/sim";
import { describe, expect, it } from "vitest";
import type { MeshSink } from "../src/renderer/mesh-sink";
import { RACK_SHAPES } from "../src/renderer/mapcity/prop-e2";
import { buildPropModel } from "../src/renderer/mapcity/prop-models";
import { PROP_SHAPES, bandOf } from "../src/renderer/mapcity/prop-shapes";

/** The procedural street furniture of ADR-0058 stage 2 (phones, and before the props files load). */

/** Half sides and top of a kind's solid in the simulation, unturned. */
export const solidBox = (prop: StreetPropKind) => {
  const prisms = furniturePrisms({ prop, x: 0, y: 0, z: 0, yaw: 0, variant: 0 });
  const pts = prisms.flatMap((p) => p.points);
  return { hx: Math.max(...pts.map((q) => Math.abs(q.x))), hz: Math.max(...pts.map((q) => Math.abs(q.z))), top: Math.max(...prisms.map((p) => p.top)) };
};

const bounds = (s: MeshSink) => {
  const at = (k: number) => s.positions.filter((_, i) => i % 3 === k);
  return { x: Math.max(...at(0).map(Math.abs)), y: Math.max(...at(1)), z: Math.max(...at(2).map(Math.abs)) };
};

describe("procedural street furniture of ADR-0058 stage 2", () => {
  it("draws each new kind inside its solid and about as big", () => {
    for (const kind of ["atm", "hydrant", "food-cart", "container", "bike-rack"] as const) {
      const box = solidBox(kind);
      for (let s = 0; s < (PROP_SHAPES[kind] ?? 1); s++) {
        const b = bounds(buildPropModel(kind, s).sink);
        expect(b.x, `${kind}:${s}`).toBeLessThanOrEqual(box.hx + 0.03);
        expect(b.z, `${kind}:${s}`).toBeLessThanOrEqual(box.hz + 0.03);
        expect(b.y, `${kind}:${s}`).toBeLessThanOrEqual(box.top + 0.03);
        expect(b.y, `${kind}:${s}`).toBeGreaterThan(box.top * 0.75);
      }
    }
  });

  it("parks bikes at the racks by their shape, and draws hydrants only close by", () => {
    expect(RACK_SHAPES).toHaveLength(PROP_SHAPES["bike-rack"]!);
    const verts = RACK_SHAPES.map((_, s) => buildPropModel("bike-rack", s).sink.vertexCount);
    // Two bikes, one, the other, a bike and a scooter (a bike on phones).
    expect(verts[1]).toBe(verts[2]);
    expect(verts[0]).toBeGreaterThan(verts[1]!);
    expect(bandOf("hydrant")).toBe("small");
    expect(bandOf("container")).toBe("medium");
  });
});
