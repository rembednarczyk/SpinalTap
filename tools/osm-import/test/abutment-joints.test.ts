import { describe, expect, it } from "vitest";
import { type Pt } from "../src/geometry.ts";
import { holds } from "../src/streets/clip.ts";
import { abutmentJoints } from "../src/streets/abutment-joints.ts";
import { type StreetEdge } from "../src/streets/street-ground.ts";

describe("the street graph's joints with the bridges' decks (ADR-0104 E4)", () => {
  // A deck from the west ending square at (0; 0), 3 m a side; the graph's street on east from it, BDOT10k's carriageway 4 m left and 2 m right of its line.
  const deck = { ring: [{ x: -40, z: -3 }, { x: 0, z: -3 }, { x: 0, z: 3 }, { x: -40, z: 3 }] as Pt[], line: [{ x: -40, z: 0 }, { x: 0, z: 0 }] as Pt[], half: 3 };
  const street: StreetEdge = { way: "s", axis: [{ x: 0, z: 0 }, { x: 40, z: 0 }], left: 4, right: 2, walkLeft: 2.5, walkRight: 2.5, kerbRadius: 3 };

  it("lays asphalt from the deck's end corners to the graph's kerbs 10 m on, each kerb straight between them", () => {
    const joints = abutmentJoints([street], [deck]);
    expect(joints.map((j) => j.edge)).toEqual([0]);
    const a = joints[0]!.area;
    // 2 m on: the right kerb from the deck's 3 m to the street's 2 m, at 2.8 m; the left from 3 m to 4 m, at 3.2 m.
    expect(holds(a, { x: 2, z: -2.7 })).toBe(true);
    expect(holds(a, { x: 2, z: 3.1 })).toBe(true);
    expect(holds(a, { x: 2, z: -2.9 })).toBe(false);
    expect(holds(a, { x: 12, z: 0 })).toBe(false);
  });

  it("lays none where no street of the graph starts at the deck's end", () => {
    expect(abutmentJoints([{ ...street, axis: [{ x: 5, z: 0 }, { x: 40, z: 0 }] }], [deck])).toEqual([]);
  });
});
