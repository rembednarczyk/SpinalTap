import { describe, expect, it } from "vitest";
import { roadDipsOverTunnels } from "./road-tunnel";

/** The glitch scan's check `road-dip-over-tunnel` (G-088) on a street along x over a tunnel along z at x = 0. */

const way = (id: string, tags: Record<string, string>, nodes: number[], ...pts: [number, number][]) => ({ id, tags, nodes, line: pts.map(([x, z]) => ({ x, z })) });
const street = way("w1", { highway: "pedestrian", name: "Zamkowa" }, [1, 2, 3], [-20, 0], [5, 0], [20, 0]);
const tunnel = way("w2", { highway: "path", tunnel: "yes", layer: "-1" }, [4, 5], [0, -10], [0, 10]);
/** A cut 3 m deep, 6 m wide, on a slope falling 0.1 m a metre along x. */
const cut = (p: { x: number }) => -p.x / 10 - Math.max(0, 3 - Math.abs(p.x));
const everywhere = () => true;

describe("streets sinking over a tunnel (G-088)", () => {
  it("finds a street dipping more than 1 m under the chord over a tunnel it does not join", () => {
    expect(roadDipsOverTunnels([street, tunnel], cut, everywhere)).toEqual([{ at: "0,0", what: "w1 Zamkowa over w2: ground 3.00 m under the chord ±8 m" }]);
  });

  it("finds a tunnel sharing a node with the street elsewhere, as the import does", () => {
    expect(roadDipsOverTunnels([street, { ...tunnel, nodes: [4, 3] }], cut, everywhere)).toHaveLength(1);
  });

  it("finds nothing on a level street, a shallow dip, a tunnel joined at a node, a bridge, or off the map", () => {
    const slope = (p: { x: number }) => -p.x / 10;
    expect(roadDipsOverTunnels([street, tunnel], slope, everywhere)).toEqual([]);
    expect(roadDipsOverTunnels([street, tunnel], (p) => slope(p) - Math.max(0, 1 - Math.abs(p.x)), everywhere)).toEqual([]);
    const joined = way("w2", { highway: "path", tunnel: "yes" }, [4, 2], [0, -10], [5, 0]);
    expect(roadDipsOverTunnels([street, joined], (p) => -Math.max(0, 3 - Math.abs(p.x - 5)), everywhere)).toEqual([]);
    expect(roadDipsOverTunnels([{ ...street, tags: { highway: "pedestrian", bridge: "yes" } }, tunnel], cut, everywhere)).toEqual([]);
    expect(roadDipsOverTunnels([street, { ...tunnel, tags: { highway: "path" } }], cut, everywhere)).toEqual([]);
    expect(roadDipsOverTunnels([street, tunnel], cut, (p) => p.x > 1)).toEqual([]);
  });
});
