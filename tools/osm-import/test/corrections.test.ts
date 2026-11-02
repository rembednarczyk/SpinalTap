import { describe, expect, it } from "vitest";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { STOREY } from "../src/building-tags.ts";
import { partTier } from "../src/building-parts.ts";
import { TAG_CORRECTIONS, corrected } from "../src/corrections.ts";
import { type Area } from "../src/features.ts";

/** The explicit corrections of estimated OSM tags: documented, and applied to the right element only. */

const annex: Area = { id: "w617597406", osmId: 617597406, tags: { "building:levels": "2", "building:part": "yes", "roof:colour": "brown" }, ring: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }], holes: 0 };

describe("tag corrections (ADR-0042)", () => {
  it("names each correction's reason and its entry in the topography register", () => {
    expect(TAG_CORRECTIONS.length).toBeGreaterThan(0);
    for (const c of TAG_CORRECTIONS) {
      expect(c.id).toMatch(/^[wr]\d+$/);
      expect(c.reason.length).toBeGreaterThan(10);
      expect(c.ref).toMatch(/^T-\d{3}$/);
      expect(Object.keys(c.tags).length > 0 || c.scale !== undefined).toBe(true);
    }
    expect(new Set(TAG_CORRECTIONS.map((c) => c.id)).size).toBe(TAG_CORRECTIONS.length);
  });

  it("raises Brama Krakowska's annex from two estimated storeys to the measured 9.3 m over its base (T-033)", () => {
    expect(partTier(annex, "historic")!.eaves).toBeCloseTo(2 * STOREY, 6);
    const tier = partTier(corrected(annex), "historic")!;
    expect(tier.eaves).toBeCloseTo(9.3, 6);
    expect(tier.source).toBe("height");
    // Other elements and the other tags stay as mapped.
    expect(corrected({ ...annex, id: "w617597407" }).tags).toEqual(annex.tags);
    expect(corrected(annex).tags["roof:colour"]).toBe("brown");
  });

  // NMPT GUGiK 0.5 m (T-114), world y: the chapel's eaves about 7 and its nave's ridge 15.3, the keep's crown 16.4..16.9.
  it("puts the Trinity Chapel's eaves and ridge and the keep's crown in the game's data within 1 m of the surface model (G-204)", () => {
    const building = (id: string) => PODZAMCZE_CHUNKS.flatMap((c) => c.buildings).find((b) => b.id === id)!;
    const chapel = building("w66258167");
    expect(chapel.source).toBe("height");
    expect(Math.abs(chapel.y + chapel.height - 7)).toBeLessThanOrEqual(1);
    expect(Math.abs(chapel.y + chapel.height + (chapel.roof ?? 0) - 15.3)).toBeLessThanOrEqual(1);
    const keep = building("w450180469");
    expect(Math.abs(keep.y + keep.height + (keep.roof ?? 0) - 16.65)).toBeLessThanOrEqual(1);
  });
});
