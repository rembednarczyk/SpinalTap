import { describe, expect, it } from "vitest";
import { KATEDRALNY_BEACON, KATEDRALNY_LAMPS, SCENE_LAMP_GROUPS, WORLD_STREET_PROPS, groundY, inBuilding } from "../src";
import { LUBLIN_CHUNKS } from "../src/content/lublin";

/*
 * Plac Katedralny by night (24.11): the washes of the square's four floodlights on the Trinitarian Tower and the
 * cathedral's front, each with its floodlight in the frame, and the red obstruction light at the tip of the tower's spire.
 */
const floodlights = Object.values(WORLD_STREET_PROPS)
  .flat()
  .filter((i) => i.prop === "floodlight" && i.x > 570 && i.x < 630 && i.z > -205 && i.z < -130);

describe("Plac Katedralny's lights (24.11)", () => {
  it("washes the tower and the cathedral's front from its four floodlights, each near its floodlight", () => {
    expect(floodlights).toHaveLength(4);
    expect(KATEDRALNY_LAMPS.lamps).toHaveLength(4);
    for (const l of KATEDRALNY_LAMPS.lamps) {
      expect(Math.min(...floodlights.map((f) => Math.hypot(f.x - l.at.x, f.z - l.at.z))), l.key).toBeLessThan(7);
      expect(inBuilding(l.at.x, l.at.z), l.key).toBe(false);
      // Up the face, under the cathedral's portico (13 m) and the tower's cornice (25.5 m).
      expect(l.at.y - groundY(l.at.x, l.at.z)).toBeGreaterThan(5);
      expect(l.at.y - groundY(l.at.x, l.at.z)).toBeLessThan(20);
    }
    expect(SCENE_LAMP_GROUPS).toContain(KATEDRALNY_LAMPS);
  });

  it("blinks a red obstruction light at the tip of the tower's spire, wherever the data put the tower (T-353)", () => {
    // The tip from the tower's own data (w66286371), so the light follows it when the tower moves (as T-264 and T-353 moved it).
    const tower = LUBLIN_CHUNKS.flatMap((c) => c.buildings).find((b) => b.id === "w66286371");
    expect(tower).toBeDefined();
    const t = tower!;
    const tip = t.y + t.height + (t.roof ?? 0);
    // The building's (x, z) is its outline's centroid, the spire's axis.
    expect(Math.hypot(KATEDRALNY_BEACON.x - t.x, KATEDRALNY_BEACON.z - t.z)).toBeLessThan(0.3);
    expect(KATEDRALNY_BEACON.y).toBeGreaterThan(tip);
    expect(KATEDRALNY_BEACON.y).toBeLessThan(tip + 0.5);
    expect(KATEDRALNY_BEACON.color.startsWith("#ff")).toBe(true);
  });
});
