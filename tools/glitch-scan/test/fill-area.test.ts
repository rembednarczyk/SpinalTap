import { describe, expect, it } from "vitest";
import { generatedCity } from "../../osm-import/test/city.ts";
import { fillAreaMismatch } from "./fill-area";

/** Two 2 m squares meeting at (2; 2), as one ring visiting that corner twice. */
const EIGHT = [0, 0, 2, 0, 2, 2, 4, 2, 4, 4, 2, 4, 2, 2, 0, 2];

describe("pieces of the bare ground rule laid as triangles of their own area (fill-area-mismatch, G-764)", () => {
  it("names a ring touching itself, and no simple ring", () => {
    const found = fillAreaMismatch([{ id: "c", fills: [{ surface: "square", outline: EIGHT }, { surface: "grass", outline: [0, 0, 2, 0, 2, 2, 0, 2] }] }]);
    expect(found.map((f) => f.at)).toEqual(["0.00,0.00"]);
  });

  it("finds none over the city (13.11.2026: 12 before the rings were cut at the points they touch)", () => {
    expect(fillAreaMismatch(generatedCity().stats)).toEqual([]);
  });
});
