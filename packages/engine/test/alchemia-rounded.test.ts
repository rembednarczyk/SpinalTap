import { describe, expect, it } from "vitest";
import { ALCHEMIA_TIER_PIECES } from "@seki/sim";
import { ledOfSlab, overhangOf, roundedOutline } from "../src/renderer/alchemia/rounded-slab";

/** The storeys' slabs drawn with rounded corners (ADR-0074 B4): the simulation's boxes stay. */
describe("Alchemia's rounded slabs (B4)", () => {
  const slabs = ALCHEMIA_TIER_PIECES.filter((p) => p.kind === "roof" && p.box.y1 - p.box.y0 <= 0.31 && (p.box.x1 - p.box.x0) * (p.box.z1 - p.box.z0) >= 30).map((p) => p.box);

  it("rounds every storey's slab within its box, clear of the glass 0.3 m in under it", () => {
    expect(slabs.length).toBeGreaterThanOrEqual(6);
    for (const b of slabs) {
      const pts = roundedOutline(b);
      for (const p of pts) {
        expect(p.x).toBeGreaterThanOrEqual(b.x0 - 1e-9);
        expect(p.x).toBeLessThanOrEqual(b.x1 + 1e-9);
        expect(p.z).toBeGreaterThanOrEqual(b.z0 - 1e-9);
        expect(p.z).toBeLessThanOrEqual(b.z1 + 1e-9);
      }
      // The glass's corner (0.3 m in from both edges) stays under the rounded slab: no point of
      // the outline cuts nearer the corner than it.
      const glass = { x: b.x1 - 0.3, z: b.z1 - 0.3 };
      const nearest = Math.min(...pts.map((p) => Math.hypot(p.x - b.x1, p.z - b.z1)));
      expect(nearest).toBeLessThanOrEqual(Math.hypot(glass.x - b.x1, glass.z - b.z1) + 1e-9);
    }
  });

  it("drops only the straight strips of light along the slabs, the green steps' ones stay", () => {
    const leds = ALCHEMIA_TIER_PIECES.filter((p) => p.kind === "led");
    const dropped = leds.filter((p) => ledOfSlab(p.box, slabs));
    expect(dropped.length).toBe(slabs.length * 4);
    expect(leds.length - dropped.length).toBeGreaterThan(0);
  });

  it("rounds the storeys' glass under their slabs, within the glass's box, its corners drawn in by the slab's overhang", () => {
    const glass = ALCHEMIA_TIER_PIECES.filter((p) => p.kind === "glass" && overhangOf(p.box, slabs));
    // The front's L1 to L3 and the tiers' A and B storeys under a slab.
    expect(glass.length).toBeGreaterThanOrEqual(4);
    for (const g of glass) {
      const { slab, reach } = overhangOf(g.box, slabs)!;
      const pts = roundedOutline(slab, -reach);
      for (const p of pts) {
        expect(p.x).toBeGreaterThanOrEqual(g.box.x0 - 1e-6);
        expect(p.x).toBeLessThanOrEqual(g.box.x1 + 1e-6);
        expect(p.z).toBeGreaterThanOrEqual(g.box.z0 - 1e-6);
        expect(p.z).toBeLessThanOrEqual(g.box.z1 + 1e-6);
      }
      // Its corner is cut: no point of the outline at the box's own corner.
      expect(Math.min(...pts.map((p) => Math.hypot(p.x - g.box.x1, p.z - g.box.z1)))).toBeGreaterThan(0.05);
    }
  });
});
