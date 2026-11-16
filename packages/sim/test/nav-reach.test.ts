import { describe, expect, it } from "vitest";
import { WORLD_NAV } from "../src/content/world-map";
import { REACH } from "../src/world/nav";

/**
 * G-873: a node farther than REACH is no way straight there (`nav.ts`, PR #592), so an edge of the
 * level graph longer than that could never be walked. Every edge of the city's graph stays inside.
 */
describe("the city's level graph", () => {
  it("has no edge longer than the reach of a way straight there", () => {
    const at = new Map(WORLD_NAV.nodes.map((n) => [n.id, n.at]));
    const long = WORLD_NAV.edges.flatMap((e) => {
      const a = at.get(e.a);
      const b = at.get(e.b);
      if (!a || !b) return [`${e.a}-${e.b}: missing node`];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      return d > REACH ? [`${e.a}-${e.b}: ${d.toFixed(1)} m`] : [];
    });
    expect(WORLD_NAV.edges.length).toBeGreaterThan(0);
    expect(long).toEqual([]);
  });
});
