import { describe, expect, it } from "vitest";
import { toAbutments } from "../src/bridge-ends.ts";
import { type Area, type Line } from "../src/features.ts";

const line = (id: number, tags: Record<string, string>, ...pts: [number, number][]): Line => ({ id: `w${id}`, osmId: id, tags, line: pts.map(([x, z]) => ({ x, z })) });
const outline = (tags: Record<string, string>, ...pts: [number, number][]): Area => ({ id: "w9", osmId: 9, tags, ring: pts.map(([x, z]) => ({ x, z })), holes: 0 });
/** A bridge 40 m long along x, its abutments at x 0 and 40. */
const bridge = outline({ man_made: "bridge" }, [0, -15], [40, -15], [40, 10], [0, 10]);
const onBridge = { highway: "secondary", bridge: "yes" };
const ends = (l: Line) => [l.line[0]!, l.line[l.line.length - 1]!].map((p) => `${+p.x.toFixed(3)},${+p.z.toFixed(3)}`);

describe("a bridge's way to its abutment (G-344)", () => {
  it("carries an end mapped short of the abutment, out over the bank, on straight to the outline's edge", () => {
    const [l] = toAbutments([line(1, onBridge, [0, 0], [20, 0], [33, 2])], [bridge]);
    expect(ends(l!)).toEqual(["0,0", "40,3.077"]);
    expect(l!.line).toHaveLength(3);
    const [back] = toAbutments([line(1, onBridge, [34, -3], [6, -3])], [bridge]);
    expect(ends(back!)).toEqual(["40,-3", "0,-3"]);
  });

  it("leaves an end at the abutment, one another bridge way goes on from, off the outline, too far from its edge, and ways off bridges", () => {
    const at = line(1, onBridge, [0.3, 0], [39.7, 0]);
    expect(toAbutments([at], [bridge])[0]).toBe(at);
    const [a, b] = toAbutments([line(1, onBridge, [0, 0], [20, 0]), line(2, onBridge, [20, 0], [40, 0])], [bridge]);
    expect([...ends(a!), ...ends(b!)]).toEqual(["0,0", "20,0", "20,0", "40,0"]);
    // The node they share 10 m from the edge, within reach: still one deck on through it (G-349).
    const [c, d] = toAbutments([line(1, onBridge, [0, 0], [30, 0]), line(2, onBridge, [30, 0], [40, 0])], [bridge]);
    expect([...ends(c!), ...ends(d!)]).toEqual(["0,0", "30,0", "30,0", "40,0"]);
    const off = line(1, onBridge, [50, 0], [60, 0]);
    expect(toAbutments([off], [bridge])[0]).toBe(off);
    const long = outline({ man_made: "bridge" }, [0, -15], [80, -15], [80, 10], [0, 10]);
    expect(ends(toAbutments([line(1, onBridge, [0, 0], [60, 0])], [long])[0]!)).toEqual(["0,0", "60,0"]);
    const street = line(1, { highway: "secondary" }, [0, 0], [33, 0]);
    expect(toAbutments([street], [bridge])[0]).toBe(street);
    const building = line(1, onBridge, [0, 0], [33, 0]);
    expect(toAbutments([building], [outline({ building: "yes" }, [0, -15], [40, -15], [40, 10], [0, 10])])[0]).toBe(building);
  });
});
