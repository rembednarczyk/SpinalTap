import { describe, expect, it } from "vitest";
import { type Line } from "../src/features.ts";
import { cutLine, lanesOf, roadMarkings, stopLines } from "../src/markings.ts";

/** A street running east along z = 0. */
const road = (tags: Record<string, string>): Line => ({ id: "w1", osmId: 1, tags: { highway: "residential", ...tags }, line: [{ x: -50, z: 0 }, { x: 50, z: 0 }] });
const offsets = (l: Line) => roadMarkings(l).map((m) => ({ kind: m.kind, z: Math.round(m.line[0]!.z * 100) / 100 }));

describe("road markings (ADR-0052)", () => {
  it("split a two-way street down the middle with a broken centre line", () => {
    expect(offsets(road({}))).toEqual([{ kind: "centre-dash", z: 0 }]);
  });

  it("give four lanes a double solid line between the directions and broken lines between lanes", () => {
    // 13 m, two lanes each way: lane lines at +3.25 (left, backward) and -3.25, the centre at 0.
    expect(offsets(road({ highway: "secondary", lanes: "4", width: "13" })).filter((m) => m.kind !== "edge")).toEqual([
      { kind: "lane-dash", z: 3.25 },
      { kind: "centre-double", z: 0 },
      { kind: "lane-dash", z: -3.25 },
    ]);
  });

  it("leave a one-way street without a centre line, with lines between its lanes", () => {
    expect(lanesOf({ oneway: "yes", lanes: "2" }, 6.5)).toEqual([0, 2]);
    expect(offsets(road({ oneway: "yes", lanes: "2" }))).toEqual([{ kind: "lane-dash", z: 0 }]);
  });

  it("mark cycle lanes along the kerb and an edge line on main roads", () => {
    const kinds = roadMarkings(road({ highway: "primary", width: "12", lanes: "2", "cycleway:right": "lane" })).map((m) => m.kind);
    expect(kinds).toContain("cycle-lane");
    expect(kinds.filter((k) => k === "edge")).toHaveLength(2);
  });

  it("paint nothing on the Old Town's setts, a living street or a service lane", () => {
    expect(roadMarkings(road({ surface: "sett" }))).toEqual([]);
    expect(roadMarkings(road({ highway: "living_street" }))).toEqual([]);
    expect(roadMarkings(road({ highway: "service" }))).toEqual([]);
  });

  it("stop the lines where they run into another carriageway or a zebra", () => {
    const pieces = cutLine([{ x: -50, z: 0 }, { x: 50, z: 0 }], (p) => Math.abs(p.x) < 5);
    expect(pieces).toHaveLength(2);
    expect(Math.max(...pieces[0]!.map((p) => p.x))).toBeLessThanOrEqual(-5);
    expect(Math.min(...pieces[1]!.map((p) => p.x))).toBeGreaterThanOrEqual(5);
  });

  it("put a stop line across the lanes driving towards the lights, back from the junction they stand in", () => {
    const lines = stopLines("n1", { x: 0, z: 0 }, [road({})], (p) => Math.abs(p.x) < 6);
    expect(lines).toHaveLength(2);
    // Coming east (forward) the line stands west of the junction, across the right half (z < 0).
    const east = lines.find((m) => m.line[0]!.x < 0)!;
    expect(east.line[0]!.x).toBeLessThan(-6);
    expect(Math.min(...east.line.map((p) => p.z))).toBeLessThan(-2);
    expect(Math.max(...east.line.map((p) => p.z))).toBeCloseTo(0, 5);
  });
});
