import { describe, expect, it } from "vitest";
import { WallIndex, alongWalls, isCourtyard, mostlyInside } from "../../osm-import/src/courtyards.ts";
import { LUBLIN_STREET_PROPS } from "../../../packages/sim/src/content/lublin";
import { loadLitWays, loadPlanFile } from "../../osm-import/src/props-osm.ts";
import { lampsFreestandingInCourtyard, squareStyleLeak } from "./lamp-squares";

const square = (x0: number, z0: number, x1: number, z1: number) => [
  { x: x0, z: z0 },
  { x: x1, z: z0 },
  { x: x1, z: z1 },
  { x: x0, z: z1 },
];

describe("lamps by the squares (G-798 review)", () => {
  it("takes a square walled round as a courtyard, an open one not", () => {
    const court = square(0, 0, 40, 40);
    // Four houses along its sides, 2 m out, with a 3 m gate in the north side.
    const walled = new WallIndex([square(-10, -12, 50, -2), square(-10, 42, 18, 52), square(21, 42, 50, 52), square(-12, -10, -2, 50), square(42, -10, 52, 50)]);
    expect(alongWalls(court, walled)).toBeGreaterThan(0.9);
    expect(isCourtyard(court, walled)).toBe(true);
    // Houses on two sides only: a square in the street.
    const open = new WallIndex([square(-10, -12, 50, -2), square(-12, -10, -2, 50)]);
    expect(isCourtyard(court, open)).toBe(false);
    expect(mostlyInside([{ x: 5, z: 5 }, { x: 35, z: 30 }, { x: 60, z: 30 }], court)).toBe(true);
    expect(mostlyInside([{ x: 5, z: 5 }, { x: 60, z: 30 }, { x: 70, z: 30 }], court)).toBe(false);
  });

  it("finds a lamp on a post inside a courtyard, not a wall lantern or a lamp outside", () => {
    const courts = [{ id: "w1", ring: square(0, 0, 40, 40) }];
    const found = lampsFreestandingInCourtyard([{ prop: "lamp-park", x: 20, z: 20 }, { prop: "lamp-wall-lantern", x: 1, z: 20 }, { prop: "lamp-road", x: 50, z: 20 }, { prop: "bench", x: 10, z: 10 }], courts);
    expect(found).toEqual([{ at: "20.0,20.0", what: "lamp-park on a post in the courtyard w1" }]);
  });

  it("finds a candelabrum more than 12 m from the plan's candelabra lines", () => {
    const lines = [[{ x: 0, z: 0 }, { x: 100, z: 0 }]];
    const found = squareStyleLeak([{ prop: "lamp-candelabra", x: 50, z: 6 }, { prop: "lamp-candelabra", x: 50, z: 20 }, { prop: "lamp-pastoral", x: 50, z: 40 }], lines);
    expect(found).toEqual([{ at: "50.0,20.0", what: "lamp-candelabra 20.0 m from the plan's candelabra lines" }]);
  });

  it("finds no lamp on a post in Dziedziniec Zamkowy and no candelabrum off Plac Zamkowy in the city's table", () => {
    const lamps = Object.values(LUBLIN_STREET_PROPS).flat();
    const courts = loadLitWays().filter((w) => w.court === "square").map((w) => ({ id: `w${w.id}`, ring: w.pts }));
    expect(courts.map((c) => c.id)).toEqual(["w383162808"]);
    expect(lampsFreestandingInCourtyard(lamps, courts)).toEqual([]);
    const lines = loadPlanFile()
      .items.filter((g) => g.kind === "lamp-candelabra")
      .flatMap((g) => [...(g.line ? [g.line] : []), ...(g.lines ?? [])])
      .map((f) => Array.from({ length: Math.floor(f.length / 2) }, (_, i) => ({ x: f[2 * i]!, z: f[2 * i + 1]! })));
    expect(squareStyleLeak(lamps, lines)).toEqual([]);
  });
});
