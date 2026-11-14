import { describe, expect, it } from "vitest";
import type { GroundChunk } from "./ground-strips";
import { groundOverSteps } from "./ground-over-steps";

const chunk = (ground: GroundChunk["ground"]): GroundChunk => ({ id: "c", bounds: { minX: 0, maxX: 20, minZ: 0, maxZ: 20 }, ground });
const square = (x: number, z: number, w: number, h: number) => [x, z, x + w, z, x + w, z + h, x, z + h];

describe("ground over steps (G-777)", () => {
  const flight = { surface: "steps" as const, outline: square(5, 5, 2, 3) };

  it("finds a footway's piece over a flight by more than 0.01 m², at the middle of the overlap", () => {
    const found = groundOverSteps([chunk([flight, { surface: "footway", outline: square(6.6, 5, 1, 1) }])]);
    expect(found).toEqual([{ at: "6.8,5.5", what: "c: footway over steps, 0.40 m²" }]);
  });

  it("finds none edge to edge, under 0.01 m², lifted lower than the steps, or on a bridge", () => {
    expect(groundOverSteps([chunk([flight, { surface: "footway", outline: square(7, 5, 1, 1) }])])).toEqual([]);
    expect(groundOverSteps([chunk([flight, { surface: "footway", outline: [6.9, 5, 7.1, 5, 7.1, 5.05, 6.9, 5.05] }])])).toEqual([]);
    expect(groundOverSteps([chunk([flight, { surface: "grass", outline: square(6, 5, 1, 1) }])])).toEqual([]);
    expect(groundOverSteps([chunk([flight, { surface: "road", outline: square(6, 5, 1, 1), bridge: true }])])).toEqual([]);
  });
});
