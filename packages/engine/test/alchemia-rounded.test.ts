import { describe, expect, it } from "vitest";
import { ALCHEMIA_TIER_PIECES } from "@seki/sim";
import { GeometrySink } from "../src/renderer/city-kit-data";
import { ledOfSlab } from "../src/renderer/alchemia/rounded-slab";
import { glassFacade, insetConvex } from "../src/renderer/alchemia/storey-facade";
import { parseCityKit } from "../src/renderer/city-kit-data";
// @ts-expect-error The engine is typed for the browser; the test reads the kit off disk.
import { readFileSync } from "node:fs";

/** The storeys' rounded slabs and their glass as the board shows them (ADR-0074 B4, 1:1 on 19.11). */
describe("Alchemia's rounded storeys in the drawing", () => {
  const bytes = (readFileSync as (url: URL) => Uint8Array)(new URL("../../app/public/city/city-kit.glb", import.meta.url));
  const data = parseCityKit(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const slabs = ALCHEMIA_TIER_PIECES.filter((p) => p.kind === "roof" && p.box.y1 - p.box.y0 <= 0.31 && (p.box.x1 - p.box.x0) * (p.box.z1 - p.box.z0) >= 30);

  it("drops only the straight strips of light along the slabs, the green steps' ones stay", () => {
    const leds = ALCHEMIA_TIER_PIECES.filter((p) => p.kind === "led");
    const dropped = leds.filter((p) => ledOfSlab(p.box, slabs.map((s) => s.box)));
    expect(dropped.length).toBe(slabs.length * 4);
    expect(leds.length - dropped.length).toBeGreaterThan(0);
  });

  it("insets a rounded outline evenly: every point of the inset a room's depth inside", () => {
    const glass = ALCHEMIA_TIER_PIECES.find((p) => p.kind === "glass" && p.outline && p.outline.length > 8)!;
    const pts = glass.outline!;
    const back = insetConvex(pts, 1.6);
    expect(back.length).toBe(pts.length);
    for (const b of back) {
      // Its distance to the outline's nearest edge.
      const d = Math.min(
        ...pts.map((p, i) => {
          const q = pts[(i + 1) % pts.length]!;
          const [dx, dz] = [q.x - p.x, q.z - p.z];
          const t = Math.max(0, Math.min(1, ((b.x - p.x) * dx + (b.z - p.z) * dz) / (dx * dx + dz * dz)));
          return Math.hypot(b.x - p.x - dx * t, b.z - p.z - dz * t);
        }),
      );
      expect(d).toBeCloseTo(1.6, 1);
    }
  });

  it("draws a storey's glass with its room behind it, nothing on the edges hidden in a neighbour", () => {
    const glass = ALCHEMIA_TIER_PIECES.find((p) => p.kind === "glass" && p.outline && p.outline.length > 8)!;
    const all = new GeometrySink();
    glassFacade(all, data, glass.outline!, glass.box.y0, glass.box.y1, () => false);
    const none = new GeometrySink();
    glassFacade(none, data, glass.outline!, glass.box.y0, glass.box.y1, () => true);
    expect(all.indices.length).toBeGreaterThan(none.indices.length * 4);
    // Only the room's floor is left when every edge is hidden.
    expect(none.indices.length).toBe(Math.ceil(glass.outline!.length / 2) * 6);
  });
});
