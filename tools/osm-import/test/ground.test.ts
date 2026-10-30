import { describe, expect, it } from "vitest";
import { type Line } from "../src/features.ts";
import { CROSSING_ALONG, coveredByWater, crossingBand, cutSidewalk, lineBands, markedCrossing } from "../src/ground.ts";

const river: Line = { id: "w1", osmId: 1, tags: { waterway: "river" }, line: [{ x: 0, z: 0 }, { x: 50, z: 0 }, { x: 100, z: 0 }] };
const bed = [{ x: -10, z: -20 }, { x: 110, z: -20 }, { x: 110, z: 20 }, { x: -10, z: 20 }];

describe("river bands", () => {
  it("buffer a river with no mapped bed", () => {
    expect(lineBands(river, false).map((b) => b.surface)).toEqual(["water"]);
  });

  it("leave a river whose bed is mapped as water to that area", () => {
    expect(coveredByWater(river.line, [bed])).toBe(true);
    expect(lineBands(river, false, [bed])).toEqual([]);
  });

  it("keep the band where the bed covers only a small part of the line", () => {
    const pond = [{ x: -10, z: -5 }, { x: 10, z: -5 }, { x: 10, z: 5 }, { x: -10, z: 5 }];
    expect(coveredByWater(river.line, [pond])).toBe(false);
    expect(lineBands(river, false, [pond])).toHaveLength(1);
  });
});

describe("zebra crossings (ADR-0042)", () => {
  const street: Line = { id: "w2", osmId: 2, tags: { highway: "residential" }, line: [{ x: -50, z: 0 }, { x: 50, z: 0 }] };

  it("stripe a marked footway crossing instead of paving it across the road, and leave an unmarked one to the asphalt", () => {
    const across = (crossing: string): Line => ({ id: "w3", osmId: 3, tags: { highway: "footway", footway: "crossing", crossing }, line: [{ x: 0, z: -4 }, { x: 0, z: 4 }] });
    expect(lineBands(across("zebra"), false).map((b) => b.surface)).toEqual(["crossing"]);
    expect(lineBands(across("unmarked"), false)).toEqual([]);
  });

  it("put a band across the carriageway at a crossing node, as wide as the road and 3 m along it", () => {
    expect(markedCrossing({ highway: "crossing" })).toBe(true);
    expect(markedCrossing({ highway: "crossing", crossing: "unmarked" })).toBe(false);
    const band = crossingBand("n1", { x: 10, z: 0.2 }, [street])!;
    expect(band.surface).toBe("crossing");
    const xs = band.ring.map((p) => p.x);
    const zs = band.ring.map((p) => p.z);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(CROSSING_ALONG, 5);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(6.5, 5);
    // Off the carriageway (a crossing of a park path): no zebra.
    expect(crossingBand("n2", { x: 10, z: 8 }, [street])).toBeNull();
  });
});

describe("sidewalks at the streets they meet (ADR-0042)", () => {
  it("stop at the kerb of a crossing street instead of running across its asphalt", () => {
    const main: Line = { id: "w10", osmId: 10, tags: { highway: "residential", sidewalk: "both" }, line: [{ x: -40, z: 0 }, { x: 40, z: 0 }] };
    const side = lineBands(main, false).filter((b) => b.surface === "sidewalk");
    expect(side.length).toBe(2);
    // A street 8 m wide crosses at x = 0.
    const onRoad = (p: { x: number; z: number }) => Math.abs(p.x) < 4;
    for (const b of side) {
      const pieces = cutSidewalk(b, onRoad);
      expect(pieces.length).toBe(2);
      for (const piece of pieces) for (const p of piece.ring) expect(Math.abs(p.x)).toBeGreaterThan(3.4);
    }
    // Nothing in the way: the sidewalk stays whole.
    expect(cutSidewalk(side[0]!, () => false)).toEqual([side[0]]);
  });
});
