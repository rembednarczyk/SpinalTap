import { describe, expect, it } from "vitest";
import { constructionBuilt, siteLandBuilt } from "./construction-built";

/** A 10 × 10 m square from (x; 0). */
const square = (x: number) => [
  { x, z: 0 },
  { x: x + 10, z: 0 },
  { x: x + 10, z: 10 },
  { x, z: 10 },
];

describe("osm-construction-built (G-872)", () => {
  const site = { id: "w1", tags: { building: "construction" }, ring: square(0) };
  const lod1 = [{ id: "L1", height: 12, ground: 200, ring: square(2) }];

  it("finds a site LoD1 covers with no solid in the game", () => {
    expect(constructionBuilt([site], lod1, new Set())).toEqual([{ at: "5,5", what: "w1 building=construction 80% under LoD1 2024, no solid in the game" }]);
  });

  it("not one the game builds, one LoD1 leaves bare or covers less than half, nor other outlines", () => {
    expect(constructionBuilt([site], lod1, new Set(["w1"]))).toEqual([]);
    expect(constructionBuilt([site], [], new Set())).toEqual([]);
    expect(constructionBuilt([site], [{ ...lod1[0]!, ring: square(6) }], new Set())).toEqual([]);
    expect(constructionBuilt([{ ...site, tags: { building: "yes" } }, { ...site, tags: { landuse: "construction" } }], lod1, new Set())).toEqual([]);
  });
});

describe("construction-landuse-built (G-872)", () => {
  const land = { id: "w2", kind: "construction", ring: square(-10).map((p) => ({ x: p.x * 3 + 15, z: p.z * 3 - 10 })) };
  const house = { id: "w1", x: 5, z: 5, outline: [-5, -5, 5, -5, 5, 5, -5, 5] };

  it("finds a site's land round a building OSM still tags building=construction", () => {
    expect(siteLandBuilt([land], [house], new Set(["w1"]))).toEqual([{ at: "5,5", what: "w2 building site round w1, which stands finished" }]);
  });

  it("not land that is no site, a building OSM tags built, nor the building's own outline", () => {
    expect(siteLandBuilt([{ ...land, kind: "building" }], [house], new Set(["w1"]))).toEqual([]);
    expect(siteLandBuilt([land], [house], new Set())).toEqual([]);
    expect(siteLandBuilt([{ ...land, id: "w1" }], [house], new Set(["w1"]))).toEqual([]);
  });
});
