import { describe, expect, it } from "vitest";
import { WORLD_STREET_PROPS } from "../../../packages/sim/src/content/street-props";
import { lineDistance } from "../src/construction-ground.ts";
import { loadStreetWays } from "../src/props-osm.ts";

/*
 * A building site's fence on paving inside its outline (the user's decision of 24.11, the curator's review): Wzgórza's
 * (w1362895448) south side stands on Plac Litewski's paving before the palace's front, as the orthophoto of 2025-04
 * shows, and keeps 1.5 m off the axis of every way through (the deptak w1054556920 at its south-west corner).
 */
const fence = Object.values(WORLD_STREET_PROPS)
  .flat()
  .filter((p) => p.prop === "site-fence" && p.x > -1 && p.x < 102 && p.z > 60 && p.z < 75);
const ways = loadStreetWays()
  .filter((w) => w.tags.area !== "yes")
  .map((w) => w.pts);

describe("Wzgórza's fence on Plac Litewski's paving (decision of 24.11)", () => {
  it("runs along the palace's front, most of its 99 m", () => {
    expect(fence.length * 2.5).toBeGreaterThan(70);
  });

  it("keeps every panel 1.5 m off a way's axis: the deptak stays open", () => {
    const near = fence.filter((p) => ways.some((w) => lineDistance(p, w) < 1.45));
    expect(near.map((p) => `${p.x},${p.z}`)).toEqual([]);
  });
});
