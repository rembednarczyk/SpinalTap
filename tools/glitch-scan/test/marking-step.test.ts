import { describe, expect, it } from "vitest";
import { markingSteps } from "./marking-step";

/** The glitch scan's check `marking-step` (G-675) on lines along x, all on one street unless `street` says otherwise. */
const along = (kind: string, from: number, to: number, z: number, z2 = z) => ({ kind, line: [from, z, to, z2] });
const ONE = () => "Radziwiłłowska";

describe("a lane line stepping sideways along one street (marking-step)", () => {
  it("finds a centre or lane line going on 0.3 m and more to the side, either way round", () => {
    expect(markingSteps([along("centre-dash", 0, 20, 0), along("centre-dash", 20, 40, 0.8)], ONE).map((f) => f.what)).toEqual(["Radziwiłłowska: centre-dash steps 0.80 m across"]);
    // Drawn the other way, with half a metre between them, or overlapping.
    expect(markingSteps([along("lane-dash", 20, 0, 0), along("lane-dash", 40, 20.5, 0.4)], ONE)).toHaveLength(1);
    expect(markingSteps([along("lane-dash", 0, 20, 0), along("lane-dash", 19.7, 40, -0.4)], ONE)).toHaveLength(1);
  });

  it("finds none where the line goes on in line, over a taper, past a gap or as another lane's line", () => {
    expect(markingSteps([along("centre-dash", 0, 20, 0), along("centre-dash", 20, 40, 0.2)], ONE)).toEqual([]);
    expect(markingSteps([along("centre-dash", 0, 20, 0, 0.4), along("centre-dash", 20, 40, 0.4, 0.8)], ONE)).toEqual([]);
    // A junction's gap; the next lane's line 2.25 m off; another kind; two lines ending side by side.
    expect(markingSteps([along("centre-dash", 0, 20, 0), along("centre-dash", 25, 40, 0.8)], ONE)).toEqual([]);
    expect(markingSteps([along("lane-dash", 0, 20, 0), along("lane-dash", 20, 40, 2.25)], ONE)).toEqual([]);
    expect(markingSteps([along("centre-dash", 0, 20, 0), along("lane-dash", 20, 40, 0.8)], ONE)).toEqual([]);
    expect(markingSteps([along("lane-dash", 0, 20, 0), along("lane-dash", 0, 20, 0.8)], ONE)).toEqual([]);
    // The edge line is not a lane line.
    expect(markingSteps([along("edge", 0, 20, 0), along("edge", 20, 40, 0.8)], ONE)).toEqual([]);
  });

  it("counts only a step on one street", () => {
    const lines = [along("centre-dash", 0, 20, 0), along("centre-dash", 20, 40, 0.8)];
    expect(markingSteps(lines, (p) => (p.z < 0.4 ? "Radziwiłłowska" : "Lubartowska"))).toEqual([]);
    expect(markingSteps(lines, () => null)).toEqual([]);
  });
});
