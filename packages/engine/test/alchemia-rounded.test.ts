import { describe, expect, it } from "vitest";
import { ALCHEMIA_TIER_PIECES, MALL } from "@seki/sim";
import { ledOfSlab } from "../src/renderer/alchemia/rounded-slab";
import { insetConvex } from "../src/renderer/alchemia/storey-facade";

/** The storeys' rounded slabs and their glass as the board shows them (ADR-0074 B4, 1:1 on 19.11). */
describe("Alchemia's rounded storeys in the drawing", () => {
  // The front's storeys' slabs; the gallery's (ADR-0093 O1) have no straight strips of their own to drop.
  const slabs = ALCHEMIA_TIER_PIECES.filter((p) => p.kind === "roof" && p.box.y1 - p.box.y0 <= 0.31 && (p.box.x1 - p.box.x0) * (p.box.z1 - p.box.z0) >= 30 && p.box.z0 < MALL.z0 - 0.01);

  it("drops only the straight strips of light along the slabs, the green steps' ones stay", () => {
    const leds = ALCHEMIA_TIER_PIECES.filter((p) => p.kind === "led");
    const dropped = leds.filter((p) => ledOfSlab(p.box, slabs.map((s) => s.box)));
    expect(dropped.length).toBe(slabs.length * 4);
    expect(leds.length - dropped.length).toBeGreaterThan(0);
  });

  it("insets a rounded outline evenly: every point of the inset a room's depth inside", () => {
    // A storey's rounded slab (its glass a solid box with the same outline until ADR-0093 O5, a wall round its rooms since).
    const slab = slabs.find((p) => p.outline && p.outline.length > 8)!;
    const pts = slab.outline!;
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
});
