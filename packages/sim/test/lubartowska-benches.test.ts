import { describe, expect, it } from "vitest";
import { WORLD_STREET_PROPS } from "../src/content/street-props";

/**
 * The three benches OSM maps by Lubartowska at (424; −30.3), (424.1; −31.5) and (424.9; −30.9)
 * (n6681995509–11) stand in the game (G-983): the car wash's night drinker walked from the yard's
 * gap to Lubartowska 0.1–0.9 m past them, and the furniture kept off its way (`KEEP_CLEAR`) went. The
 * import sets the third 1.4 m off its node, at (426; −29.8), clear of the kerb's row: within 1.5 m.
 */
const NODES = [
  { x: 424, z: -30.3 },
  { x: 424.1, z: -31.5 },
  { x: 424.9, z: -30.9 },
];

describe("the benches by Lubartowska (G-983)", () => {
  it("stand by their OSM nodes, within 1.5 m", () => {
    const benches = Object.values(WORLD_STREET_PROPS).flatMap((items) => items.filter((i) => i.prop === "bench"));
    const missing = NODES.filter((n) => !benches.some((b) => Math.hypot(b.x - n.x, b.z - n.z) <= 1.5));
    expect(missing).toEqual([]);
  });
});
