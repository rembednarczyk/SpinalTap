import { describe, expect, it } from "vitest";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import { SURFACE_TOPS, withSurfaceTop } from "../src/corrections-surface.ts";
import { HAND_HEIGHTS } from "../src/lod1-heights.ts";
import { type BuildingOut } from "../src/model.ts";

/** Tops from the surface model where LoD1 or the map's storeys stand far over it (G-708, T-269). */

const house: BuildingOut = { id: "w232362965", x: 0, z: 0, y: -15.6, outline: [], parts: [], height: 16.7, plinth: 7.1, levels: 3, use: "residential", look: 1, source: "default" };

/** The storeys under the tops: one over a buried plinth, two from the foot by Podwale. */
const STOREYS: Readonly<Record<string, number>> = { w66293276: 1, w232362965: 1, w364575978: 2 };

describe("tops from the surface model (G-708)", () => {
  it("names each top's reason and its entry in the topography register, and keeps LoD1 off it", () => {
    for (const s of SURFACE_TOPS) {
      expect(s.id).toMatch(/^[wr]\d+$/);
      expect(s.reason.length).toBeGreaterThan(10);
      expect(s.ref).toMatch(/^T-\d{3}$/);
      expect(HAND_HEIGHTS.has(s.id)).toBe(true);
    }
  });

  it("puts the walls up to the top, the plinth cut to leave a storey over it", () => {
    // The terrace on the scarp: its top level with Grodzka's yards, a storey over the buried plinth.
    expect(withSurfaceTop(house)).toEqual({ ...house, height: 6.9, plinth: 3.7, levels: 1, source: "height" });
    // A top under a storey over the foot: a storey all the same.
    expect(withSurfaceTop({ ...house, y: -5 })).toMatchObject({ height: 3.2, plinth: 0, levels: 1 });
    // The map's storeys that fit from the foot stay, the plinth cut under them; those that do not, go.
    const tagged = { ...house, id: "w364575978", y: -13.2, plinth: 5, levels: 2, source: "levels" as const };
    expect(withSurfaceTop(tagged)).toEqual({ ...tagged, height: 6, plinth: 0, source: "height" });
    expect(withSurfaceTop({ ...tagged, levels: 3 })).toMatchObject({ height: 6, plinth: 2.8, levels: 1 });
    expect(withSurfaceTop({ ...house, id: "w1" })).toEqual({ ...house, id: "w1" });
  });

  it("stands the measured buildings of the tables at their tops", () => {
    const buildings = STARE_MIASTO_CHUNKS.flatMap((c) => c.buildings);
    for (const s of SURFACE_TOPS) {
      const b = buildings.find((o) => o.id === s.id);
      expect(b, s.id).toBeDefined();
      expect(b!.y + b!.height + (b!.roof ?? 0) / 2, s.id).toBeCloseTo(s.top, 0);
      expect(b!.levels, s.id).toBe(STOREYS[s.id]);
    }
  });
});
