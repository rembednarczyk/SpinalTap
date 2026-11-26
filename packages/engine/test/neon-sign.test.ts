import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { type Mesh, Scene, Vector3, VertexBuffer } from "../src/babylon";
import { NEON_BACK_UVS, buildNeon } from "../src/renderer/props";

// The sign draws its label on a 2D canvas (`neonTexture`); the test reads the mesh, not the drawing: a context that draws nothing.
const noop = new Proxy({}, { get: (_, key) => (key === "measureText" ? () => ({ width: 0 }) : () => undefined) });
(globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas ??= class {
  constructor(readonly width: number, readonly height: number) {}
  getContext() {
    return noop;
  }
};
const scene = new Scene(new NullEngine());

describe("a neon sign with a label (G-979)", () => {
  it("shows its letters from the front only, its back the plate's dark corner", () => {
    const view = buildNeon(scene, "targ", { kind: "neon", size: { x: 2.8, y: 0.6, z: 0.15 }, color: "#ff3fa4", label: "TARG ZAMKOWY", facing: "z-" }, new Vector3(0, 3, 0));
    const plane = view.glowing[0] as Mesh;
    // Both sides in the one mesh, the back not drawn through the front.
    expect(plane.material!.backFaceCulling).toBe(true);
    const uvs = plane.getVerticesData(VertexBuffer.UVKind)!;
    const n = uvs.length / 2;
    expect(n).toBe(8);
    const back = Array.from({ length: n / 2 }, (_, i) => [uvs[2 * (i + n / 2)]!, uvs[2 * (i + n / 2) + 1]!]);
    for (const [u, w] of back) {
      expect(u).toBeLessThanOrEqual(NEON_BACK_UVS.z + 1e-6);
      expect(w).toBeLessThanOrEqual(NEON_BACK_UVS.w + 1e-6);
    }
  });

  it("keeps a plain glow the same from either side", () => {
    const view = buildNeon(scene, "glow", { kind: "neon", size: { x: 0.05, y: 1.1, z: 1.6 }, color: "#b46cff", facing: "x+" }, new Vector3(0, 1, 0));
    const plane = view.glowing[0] as Mesh;
    expect(plane.material!.backFaceCulling).toBe(false);
    expect(plane.getTotalVertices()).toBe(4);
  });
});
