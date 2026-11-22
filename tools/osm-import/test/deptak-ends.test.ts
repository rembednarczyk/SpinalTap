import { describe, expect, it } from "vitest";
import { deptakCuts, deptakLanes, squareDeptakEnds } from "../src/deptak-ends.ts";
import { type GroundOut } from "../src/model.ts";

/** A ring's area (m²) from its flat outline. */
const area = (o: readonly number[]): number => {
  let s = 0;
  for (let i = 0; i < o.length; i += 2) {
    const j = (i + 2) % o.length;
    s += o[i]! * o[j + 1]! - o[j]! * o[i + 1]!;
  }
  return Math.abs(s) / 2;
};
const xs = (o: readonly number[]): number[] => o.filter((_, i) => i % 2 === 0);

describe("the deptak's setts end square across it (user's notes of 21.11)", () => {
  // A band of setts 6 m wide along +x to a junction at x = 10, its end lapping slantwise past x = 8.
  const band: GroundOut = { surface: "cobble", outline: [0, -3, 9, -3, 11, 3, 0, 3] };
  const cut = { at: { x: 8, z: 0 }, out: { x: 1, z: 0 } };

  it("lays the setts past the cut as the junction's asphalt, along a straight line", () => {
    const out = squareDeptakEnds([band], [cut]);
    const setts = out.filter((g) => g.surface === "cobble");
    const asphalt = out.filter((g) => g.surface === "road");
    expect(setts).toHaveLength(1);
    expect(Math.max(...xs(setts[0]!.outline))).toBeCloseTo(8, 6);
    expect(asphalt.length).toBeGreaterThan(0);
    for (const g of asphalt) expect(Math.min(...xs(g.outline))).toBeCloseTo(8, 6);
  });

  it("keeps the ground's area: a piece is split, no crumb is lost", () => {
    const sliver: GroundOut = { surface: "cobble", outline: [0, -3, 8.001, -3, 9, 3, 0, 3] };
    for (const g of [band, sliver]) {
      const out = squareDeptakEnds([g], [cut]);
      expect(out.reduce((s, p) => s + area(p.outline), 0)).toBeCloseTo(area(g.outline), 4);
    }
  });

  it("leaves other surfaces and setts short of the cut as they are", () => {
    const road: GroundOut = { surface: "road", outline: [7, -3, 12, -3, 12, 3, 7, 3] };
    const short: GroundOut = { surface: "cobble", outline: [0, -3, 7.9, -3, 7.9, 3, 0, 3] };
    expect(squareDeptakEnds([road, short], [cut])).toEqual([road, short]);
  });

  it("finds both trimmed ends of the deptak's ways, the cut pointing out of it", () => {
    const lines = [
      { id: "w216497220", line: [{ x: 0, z: 0 }, { x: 0, z: 20 }] },
      { id: "w173533826", line: [{ x: 0, z: -6 }, { x: 0, z: 0 }] },
    ];
    const cuts = deptakCuts(lines);
    expect(cuts).toHaveLength(2);
    expect(cuts[0]!.at.z).toBeCloseTo(18.2, 6);
    expect(cuts[0]!.out.z).toBeCloseTo(1, 6);
    expect(cuts[1]!.at.z).toBeCloseTo(-2.3, 6);
    expect(cuts[1]!.out.z).toBeCloseTo(-1, 6);
  });

  it("lays the deptak's lane as setts up to the cut, the lane past it as the map draws it", () => {
    // A lane 3 m wide along +x past the cut at x = 8, its asphalt one piece.
    const lane = { id: "w522482244", ring: [{ x: 0, z: 3 }, { x: 20, z: 3 }, { x: 20, z: 6 }, { x: 0, z: 6 }] };
    const lanes = deptakLanes([lane, { ...lane, id: "w1" }], [cut]);
    expect(lanes).toHaveLength(1);
    const asphalt: GroundOut = { surface: "road", outline: [0, 3, 20, 3, 20, 6, 0, 6] };
    const out = squareDeptakEnds([asphalt], [cut], lanes);
    const setts = out.filter((g) => g.surface === "cobble");
    expect(setts).toHaveLength(1);
    expect(Math.max(...xs(setts[0]!.outline))).toBeCloseTo(8, 6);
    expect(out.reduce((s, p) => s + area(p.outline), 0)).toBeCloseTo(60, 4);
  });
});

