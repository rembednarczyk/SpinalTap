import { describe, expect, it } from "vitest";
import { METRO_ENTRANCES, PAVILION } from "../src";
import { SCENE_LAMP_GROUPS } from "../src/content/district-targ";
import { METRO_HALL_LAMPS } from "../src/content/metro-hall-lamps";

describe("the light inside the metro's glass pavilions (ADR-0071)", () => {
  it("one light a pavilion, inside its outline, under its roof and over its street", () => {
    expect(METRO_HALL_LAMPS).toHaveLength(METRO_ENTRANCES.length);
    for (const [i, e] of METRO_ENTRANCES.entries()) {
      const group = METRO_HALL_LAMPS[i]!;
      expect(group.lamps).toHaveLength(1);
      const at = group.lamps[0]!.at;
      expect(at.x).toBeGreaterThan(e.outline.minX);
      expect(at.x).toBeLessThan(e.outline.maxX);
      expect(at.z).toBeGreaterThan(e.outline.minZ);
      expect(at.z).toBeLessThan(e.outline.maxZ);
      expect(at.y).toBeGreaterThan(e.street);
      expect(at.y).toBeLessThan(e.street + PAVILION.height);
    }
  });

  it("are among the scenes' lights, each group under its own id", () => {
    for (const g of METRO_HALL_LAMPS) expect(SCENE_LAMP_GROUPS).toContain(g);
    const ids = SCENE_LAMP_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
