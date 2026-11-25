import { describe, expect, it } from "vitest";
import { NAVE_ROOF } from "../src/renderer/mapcity/landmarks/archikatedra-roof";

/**
 * The Archikatedra's roofscape (T-349 stage K3): the dormers stand on the nave's slopes over its
 * eaves (y 25), the ridge turret on its ridge (31.5), the chapels' domes on the chapels' roofs (14)
 * outside the nave's walls, and nothing over NMPT's tops (turret 35, domes 22-23).
 */

const TH = (6.3 * Math.PI) / 180;
/** v across the church's axis of a world point (north positive). */
const across = (p: { x: number; z: number }) => -(p.x - 634.2) * Math.sin(TH) + (p.z + 183.8) * Math.cos(TH);

describe("the Archikatedra's roofscape (T-349, K3)", () => {
  it("puts the dormers on the slopes, facing out, five a side", () => {
    expect(NAVE_ROOF.dormers).toHaveLength(10);
    for (const d of NAVE_ROOF.dormers) {
      expect(d.y0).toBeGreaterThan(25);
      expect(d.y1).toBeLessThan(31.5);
      // Facing away from the ridge (v 1.65): north of it north, south of it south.
      const v = across(d);
      const facingNorth = -d.fx * Math.sin(TH) + d.fz * Math.cos(TH) > 0;
      expect(facingNorth).toBe(v > 1.65);
    }
  });

  it("stands the turret on the ridge and the domes on the chapels beside the nave", () => {
    expect(Math.abs(across(NAVE_ROOF.turret!) - 1.65)).toBeLessThan(0.05);
    expect(NAVE_ROOF.turret!.top).toBeLessThanOrEqual(35);
    for (const d of NAVE_ROOF.domes) {
      const v = across(d);
      // The nave's walls at v 10.0 and −6.7: the drum clear of them.
      expect(v - d.r > 10 || v + d.r < -6.7).toBe(true);
      expect(d.y).toBe(14);
      expect(d.top).toBeLessThanOrEqual(23);
    }
  });
});

describe("the Archikatedra's apse (T-349, after the photograph in the snow)", () => {
  it("has a round-headed window on each facet of the apse with room for it, at the clerestory's height", async () => {
    const { cityAround, colored, near3 } = await import("./landmark-fixture");
    const { SWATCH } = await import("../src/renderer/mapcity/landmarks/kit");
    const sink = near3(cityAround(615, -184).frameOf("w617763433"));
    // The apse's facets lie past x 650 (the nave's long walls end there); the openings are dark.
    const apse = colored(sink, SWATCH.opening).filter((p) => p.x > 650.3);
    expect(apse.length).toBeGreaterThan(0);
    for (const p of apse) expect(p.y).toBeGreaterThan(16.4);
    for (const p of apse) expect(p.y).toBeLessThan(23.3);
    // Five facets of 3.5-4.6 m take a window (the two of about 3.1 m and 3.6 m by the long walls too, where clear).
    const facets = new Set(apse.map((p) => Math.round(Math.atan2(p.z + 180.3, p.x - 650.5) * 4)));
    expect(facets.size).toBeGreaterThanOrEqual(4);
  });
});
