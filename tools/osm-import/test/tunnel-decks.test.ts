import { describe, expect, it } from "vitest";
import { type Line } from "../src/features.ts";
import { overTunnels, tunnelLines } from "../src/tunnel-decks.ts";

const line = (id: number, tags: Record<string, string>, ...pts: [number, number][]): Line => ({ id: `w${id}`, osmId: id, tags, line: pts.map(([x, z]) => ({ x, z })) });
const street = line(1, { highway: "pedestrian", name: "Zamkowa" }, [-20, 0], [5, 0], [20, 0]);
const tunnel = line(2, { highway: "path", tunnel: "yes", layer: "-1" }, [0, -10], [0, 10]);
/** A cut 3 m deep, 6 m wide across x = 0, on a slope falling 0.1 m a metre along x, as Zamkowa's. */
const cut = (p: { x: number }) => -p.x / 10 - Math.max(0, 3 - Math.abs(p.x));
const slope = (p: { x: number }) => -p.x / 10;
const spans = (ls: readonly Line[]) => ls.map((l) => `${l.tags.bridge ?? "-"} ${l.line.map((p) => `${+p.x.toFixed(2)},${+p.z.toFixed(2)}`).join(" ")}`);

describe("a street over a tunnel it dips over (G-088)", () => {
  it("is a deck as on a bridge 8 m either side of the crossing, its stretches on the terrain beside it", () => {
    expect(spans(overTunnels(street, tunnelLines([street, tunnel]), cut))).toEqual(["- -20,0 -8,0", "yes -8,0 5,0 8,0", "- 8,0 20,0"]);
  });

  it("joins the decks of two tunnels close together, and cuts none past the street's end", () => {
    const other = line(3, { highway: "footway", tunnel: "yes" }, [4, -10], [4, 10]);
    const two = (p: { x: number }) => cut(p) - Math.max(0, 3 - Math.abs(p.x - 4));
    expect(spans(overTunnels(street, tunnelLines([tunnel, other]), two))).toEqual(["- -20,0 -8,0", "yes -8,0 5,0 12,0", "- 12,0 20,0"]);
    const short = line(1, { highway: "pedestrian" }, [-3, 0], [20, 0]);
    expect(spans(overTunnels(short, [tunnel], cut))).toEqual(["yes -3,0 8,0", "- 8,0 20,0"]);
  });

  it("leaves whole a street over no dip, joined to the tunnel at a node, on a bridge, in a tunnel, or over a way not in one", () => {
    expect(overTunnels(street, [tunnel], slope)).toEqual([street]);
    expect(overTunnels(street, [tunnel], (p) => slope(p) - Math.max(0, 1 - Math.abs(p.x)))).toEqual([street]);
    const joined = line(2, { highway: "path", tunnel: "yes" }, [5, -10], [5, 0]);
    expect(overTunnels(street, [joined], (p) => -Math.max(0, 3 - Math.abs(p.x - 5)))).toEqual([street]);
    const bridge = line(1, { highway: "pedestrian", bridge: "yes" }, [-20, 0], [20, 0]);
    expect(overTunnels(bridge, [tunnel], cut)).toEqual([bridge]);
    const under = line(1, { highway: "footway", layer: "-1" }, [-20, 0], [20, 0]);
    expect(overTunnels(under, [tunnel], cut)).toEqual([under]);
    expect(tunnelLines([street, line(4, { highway: "path" }, [0, -10], [0, 10]), line(5, { waterway: "stream", tunnel: "culvert" }, [0, -10], [0, 10])])).toEqual([]);
  });
});
