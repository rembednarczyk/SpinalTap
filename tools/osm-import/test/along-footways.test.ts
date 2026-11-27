import { describe, expect, it } from "vitest";
import { type Line } from "../src/features.ts";
import { footwaysAlongStreets } from "../src/streets/along-footways.ts";
import { roadWidth } from "../src/street-section.ts";

/** ADR-0104: the plain footways that are a street's sidewalk, matched to it by distance and heading. */

const street: Line = { id: "w1", osmId: 1, tags: { highway: "residential" }, line: [{ x: 0, z: 0 }, { x: 100, z: 0 }] };
const half = roadWidth(street.tags) / 2;
const footway = (id: string, z: number): Line => ({ id, osmId: 2, tags: { highway: "footway" }, line: [{ x: 10, z }, { x: 90, z }] });

describe("footways along streets (ADR-0104 mapped-way)", () => {
  it("takes a footway by the kerb, not one 6 m past it", () => {
    expect(footwaysAlongStreets([street, footway("near", half + 2), footway("far", half + 7)])).toEqual(new Set(["near"]));
  });

  it("takes a footway behind a bay mapped by the kerb (parking=street_side): the sidewalk behind the parked cars", () => {
    const bay = [{ x: 0, z: half }, { x: 100, z: half }, { x: 100, z: half + 5 }, { x: 0, z: half + 5 }];
    expect(footwaysAlongStreets([street, footway("far", half + 7)], [], [bay])).toEqual(new Set(["far"]));
    // A bay on the other side lets nothing through on this one.
    const other = bay.map((p) => ({ x: p.x, z: -p.z }));
    expect(footwaysAlongStreets([street, footway("far", half + 7)], [], [other])).toEqual(new Set());
  });
});
