import { describe, expect, it } from "vitest";
import { type Line } from "../src/features.ts";
import { coveredByWater, lineBands } from "../src/ground.ts";

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
