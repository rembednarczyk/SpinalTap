import { describe, expect, it } from "vitest";
import { MeshSink } from "../../../packages/engine/src/renderer/mesh-sink";
import { type CrownEntry, crownsOffSurface, topsOver } from "./landmark-crowns";

/**
 * The glitch scan's check `landmark-crown-nmpt` (G-841): a landmark whose drawn crown stands over
 * 0.8 m off NMPT's at a point of the table is found, once, with its points counted; within the
 * spread, or off the table, it is not.
 */

const ring = [
  { x: 5000, z: 5000 },
  { x: 5020, z: 5000 },
  { x: 5020, z: 5010 },
  { x: 5000, z: 5010 },
];
/** Two blocks over the outline: the west half to y `west`, the east half to y `east`. */
const entry = (west: number, east: number): CrownEntry => {
  const sink = new MeshSink();
  sink.box({ x: 5005, y: west / 2, z: 5005 }, 10, west, 10, [1, 1, 1, 1]);
  sink.box({ x: 5015, y: east / 2, z: 5005 }, 10, east, 10, [1, 1, 1, 1]);
  return { id: "w1", x: 5010, z: 5005, ring, sink };
};
const table = {
  w1: [
    [5003, 5001, 7.5],
    [5017, 5001, 5.6],
  ] as const,
};

describe("landmark-crown-nmpt (G-841)", () => {
  it("reads the highest face over a point, none outside", () => {
    expect(topsOver(entry(7.5, 5.6).sink, [{ x: 5003, z: 5001 }, { x: 5017, z: 5009 }, { x: 4990, z: 5001 }])).toEqual([7.5, 5.6, -Infinity]);
  });

  it("finds a crown over 0.8 m off NMPT's, one finding a building with its points counted", () => {
    expect(crownsOffSurface(table, [entry(7.5, 7.5)])).toEqual([{ at: "5010,5005", what: "w1: crown off NMPT at 1 of 2 points (5017,5001 7.5/5.6)" }]);
    expect(crownsOffSurface(table, [entry(5.6, 7.5)])[0]!.what).toMatch(/at 2 of 2 points/);
  });

  it("passes a crown within the spread and a building off the table", () => {
    expect(crownsOffSurface(table, [entry(7.5, 5.6)])).toEqual([]);
    expect(crownsOffSurface(table, [entry(8.2, 6.3)])).toEqual([]);
    expect(crownsOffSurface(table, [{ ...entry(7.5, 7.5), id: "w2" }])).toEqual([]);
  });
});
