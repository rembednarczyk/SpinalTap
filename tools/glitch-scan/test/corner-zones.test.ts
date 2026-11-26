import { describe, expect, it } from "vitest";
import { cornerReach } from "../../osm-import/src/streets/street-ground.ts";
import { cornerZones } from "./corner-zones";
import { junctionTest } from "./sidewalk-kinds";

/** ADR-0104: the sidewalks' uniformity counts a junction's corner as the street graph rounds it. */

const through = { id: "A#0", kind: "residential", points: [{ x: -50, z: 0 }, { x: 50, z: 0 }], reach: 4 };
const at = (deg: number, id = "B#1") => ({ id, kind: "residential", points: [{ x: 0, z: 0 }, { x: 50 * Math.cos((deg * Math.PI) / 180), z: 50 * Math.sin((deg * Math.PI) / 180) }], reach: 4 });

describe("the junctions' corners for the scan (ADR-0104)", () => {
  it("finds a T junction on a through street's line and none at a street's lone end", () => {
    const zones = cornerZones([through, at(90)]);
    expect(zones).toHaveLength(1);
    expect(zones[0]!.r).toBeCloseTo(cornerReach([0, Math.PI, Math.PI / 2], 4, 3), 6);
    expect(cornerZones([through])).toEqual([]);
  });

  it("reaches farther at an acute corner, and a station there counts as at the junction", () => {
    const [right, acute] = [cornerZones([through, at(90)])[0]!, cornerZones([through, at(60)])[0]!];
    expect(acute.r).toBeGreaterThan(right.r + 3);
    const p = { x: 12, z: 4.5 };
    expect(junctionTest([through, at(60)])("A#0", p.x, p.z)).toBe(false);
    expect(junctionTest([through, at(60)], [acute])("A#0", p.x, p.z)).toBe(true);
  });
});
