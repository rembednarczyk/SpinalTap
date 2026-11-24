import { describe, expect, it } from "vitest";
import { KATEDRALNY_BEACON, KATEDRALNY_LAMPS, SCENE_LAMP_GROUPS, WORLD_STREET_PROPS, groundY, inBuilding } from "../src";

/*
 * Plac Katedralny by night (24.11): the washes of the square's four floodlights on the Trinitarian Tower and the
 * cathedral's front, each with its floodlight in the frame, and the red obstruction light on the tower's helm.
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
      // Up the face, under the cathedral's 29 m and the tower's 42 m.
      expect(l.at.y - groundY(l.at.x, l.at.z)).toBeGreaterThan(5);
      expect(l.at.y - groundY(l.at.x, l.at.z)).toBeLessThan(20);
    }
    expect(SCENE_LAMP_GROUPS).toContain(KATEDRALNY_LAMPS);
  });

  it("blinks a red obstruction light over the tower's helm (42 m)", () => {
    expect(inBuilding(KATEDRALNY_BEACON.x, KATEDRALNY_BEACON.z)).toBe(true);
    expect(KATEDRALNY_BEACON.y - groundY(KATEDRALNY_BEACON.x, KATEDRALNY_BEACON.z)).toBeGreaterThan(42);
    expect(KATEDRALNY_BEACON.color.startsWith("#ff")).toBe(true);
  });
});
