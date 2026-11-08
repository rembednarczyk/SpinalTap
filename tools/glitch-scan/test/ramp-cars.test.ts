import { describe, expect, it } from "vitest";
import { rampCarsOffLane } from "./ramp-cars";

describe("ramp-car-off-lane (G-510)", () => {
  const lane = [[0, 1.6], [100, 1.6]] as const;
  const road = (_x: number, z: number) => Math.abs(z) < 4;

  it("finds the points of a way on the carriageway off every lane, its turns and the points off the road left out", () => {
    const axis = { id: "axis", points: [[10, 0], [20, 0], [30, 0]] as const, arcs: [] };
    expect(rampCarsOffLane([axis], [lane], road).map((f) => f.what)).toEqual(["axis 1.60 m", "axis 1.60 m", "axis 1.60 m"]);
    expect(rampCarsOffLane([{ ...axis, arcs: [[5, 15]] }], [lane], road)).toHaveLength(2);
    expect(rampCarsOffLane([{ id: "off", points: [[10, 9], [20, 9]], arcs: [] }], [lane], road)).toEqual([]);
  });

  it("keeps a way along a lane, within half a metre of it", () => {
    expect(rampCarsOffLane([{ id: "on", points: [[10, 1.6], [20, 1.2], [30, 2]], arcs: [] }], [lane], road)).toEqual([]);
  });
});
