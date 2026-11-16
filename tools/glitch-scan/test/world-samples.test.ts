import { describe, expect, it } from "vitest";
import { lanePieces, pathPieces, segmentPieces } from "./world-samples";

describe("line samples anchored in the world (G-756)", () => {
  const near = (p: { x: number; z: number }) => `${p.x.toFixed(3)},${p.z.toFixed(3)}`;

  it("cuts a segment at the grid lines along both axes and samples each piece at its middle", () => {
    expect(segmentPieces({ x: 0.2, z: 0.5 }, { x: 2.6, z: 0.5 }, 1).map((p) => `${near(p)} ${p.len.toFixed(3)}`)).toEqual(["0.600,0.500 0.800", "1.500,0.500 1.000", "2.300,0.500 0.600"]);
    const diagonal = segmentPieces({ x: 0.5, z: 0 }, { x: 2.5, z: 2 }, 1);
    expect(diagonal.map(near)).toEqual(["0.750,0.250", "1.250,0.750", "1.750,1.250", "2.250,1.750"]);
    expect(diagonal.reduce((n, p) => n + p.len, 0)).toBeCloseTo(Math.hypot(2, 2), 9);
    expect(segmentPieces({ x: 3, z: 3 }, { x: 3, z: 3 }, 1)).toEqual([]);
  });

  it("keeps a lane's samples off a moved start where they were: a change upstream does not move them downstream", () => {
    const lane = [[0.3, 0.1], [40.2, 0.1], [40.2, 30.7], [80.9, 55.3]] as const;
    const moved = [[-3.17, 2.4], ...lane.slice(1)] as const;
    // The first segment's cells: z under 3 m, x under 41 m.
    const downstream = (ps: ReturnType<typeof lanePieces>) => ps.filter((p) => p.z > 3).map(near);
    expect(downstream(lanePieces(moved, 1))).toEqual(downstream(lanePieces(lane, 1)));
    expect(downstream(lanePieces(moved, 3))).toEqual(downstream(lanePieces(lane, 3)));
    expect(downstream(lanePieces(lane, 1)).length).toBeGreaterThan(70);
  });

  it("walks a ring round to its first corner, and reads the arc length along it", () => {
    const ring = [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 1 }];
    const pieces = pathPieces(ring, 1, true);
    expect(pieces.reduce((n, p) => n + p.len, 0)).toBeCloseTo(3 + Math.hypot(2, 1), 9);
    expect(pieces.map((p) => p.s)).toEqual([...pieces.map((p) => p.s)].sort((a, b) => a - b));
    expect(pieces[2]!.s).toBeCloseTo(2.5, 9);
  });
});
