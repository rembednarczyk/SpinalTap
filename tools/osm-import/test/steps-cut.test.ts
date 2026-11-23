import { FillRule, type Path64, areaPaths, intersect, union } from "clipper2-ts";
import { describe, expect, it } from "vitest";
import { type Pt, pointInRing, selfIntersects } from "../src/geometry.ts";
import { type Band, chunkGround, lineBands } from "../src/ground.ts";
import { type GroundOut } from "../src/model.ts";

/** G-781: the ground lifted higher than steps ends on a flight's outline instead of running onto its lowest tread. */

const rect = { minX: -20, minZ: -20, maxX: 40, maxZ: 40 };
const ringOf = (g: GroundOut): Pt[] => Array.from({ length: g.outline.length / 2 }, (_, i) => ({ x: g.outline[2 * i]!, z: g.outline[2 * i + 1]! }));
const path = (r: readonly Pt[]): Path64 => r.map((p) => ({ x: Math.round(p.x * 1000), y: Math.round(p.z * 1000) }));
const m2 = (paths: Path64[]) => Math.abs(areaPaths(paths)) / 1e6;
const stepsWay = { id: "w1", osmId: 1, tags: { highway: "steps", width: "3" }, line: [{ x: 0, z: 0 }, { x: 8, z: 0 }] };
const steps = lineBands(stepsWay, false);
const area = (surface: Band["surface"], ring: Pt[], extra: Partial<Band> = {}): Band => ({ surface, ring, bridge: false, source: `a-${surface}`, ...extra });
const over = (ground: readonly GroundOut[], surface: string) => {
  const flights = union(ground.filter((g) => g.surface === "steps" && !g.bridge).map((g) => path(ringOf(g))), FillRule.NonZero);
  return m2(intersect(ground.filter((g) => g.surface === surface && !g.bridge).map((g) => path(ringOf(g))), flights, FillRule.NonZero));
};

describe("ground over a flight of steps (G-781)", () => {
  it("cuts a footway across a flight off its outline", () => {
    const footway = lineBands({ id: "w2", osmId: 2, tags: { highway: "footway" }, line: [{ x: 3, z: -6 }, { x: 5, z: 6 }] }, false);
    const ground = chunkGround([...steps, ...footway], rect);
    expect(over(ground, "footway")).toBeLessThanOrEqual(0.01);
    // What is left of it either side of the flight.
    expect(ground.filter((g) => g.surface === "footway").length).toBe(2);
    expect(ground.filter((g) => g.surface === "steps").length).toBeGreaterThan(0);
  });

  // A long slanting flight out of it too: the cut's corners rounded to the 0.1 m grid would swing its edges over the treads.
  it.each([
    ["straight", steps],
    ["slanting", lineBands({ ...stepsWay, line: [{ x: -8.3, z: -1.7 }, { x: 18.6, z: 1.2 }] }, false)],
  ])("cuts a square off the %s flight, no bare ground left in it and no ring crossing itself", (_, flight) => {
    const square = area("square", [{ x: -5, z: -5 }, { x: 13, z: -5 }, { x: 13, z: 5 }, { x: -5, z: 5 }]);
    const ground = chunkGround([square, ...flight], rect);
    expect(over(ground, "square")).toBeLessThanOrEqual(0.002);
    for (const g of ground) expect(selfIntersects(ringOf(g))).toBe(false);
    const rings = ground.map(ringOf);
    for (let x = -4.95; x < 13; x += 0.1) for (let z = -4.95; z < 5; z += 0.1) expect(rings.some((r) => pointInRing({ x, z }, r)), `${x},${z}`).toBe(true);
  });

  it("keeps what lies under the steps and what lies on a bridge", () => {
    const lawn = area("grass", [{ x: -5, z: -5 }, { x: 13, z: -5 }, { x: 13, z: 5 }, { x: -5, z: 5 }]);
    const deck = area("footway", [{ x: 2, z: -5 }, { x: 4, z: -5 }, { x: 4, z: 5 }, { x: 2, z: 5 }], { bridge: true });
    const ground = chunkGround([lawn, deck, ...steps], rect);
    expect(ground.filter((g) => g.surface === "grass").map(ringOf)).toEqual([lawn.ring]);
    expect(ground.filter((g) => g.bridge).length).toBe(1);
  });
});

/** G-963: a flight mapped to a street's axis stops at its carriageway's kerb; a parking area's asphalt does not cut it. */
describe("a flight of steps at a carriageway (G-963)", () => {
  // A street along z = 7 whose carriageway reaches 3 m either side: the flight's top 4 m lie on it.
  const street = lineBands({ id: "w3", osmId: 3, tags: { highway: "residential", width: "6" }, line: [{ x: -10, z: 7 }, { x: 30, z: 7 }] }, false);
  const flight = lineBands({ ...stepsWay, line: [{ x: 2, z: -4 }, { x: 2, z: 7 }] }, false);

  it("ends the flight at the kerb, its sides on their line, the asphalt whole", () => {
    expect(street.some((b) => b.carriageway)).toBe(true);
    const ground = chunkGround([...street, ...flight], rect);
    expect(over(ground, "road")).toBeLessThanOrEqual(0.002);
    const treads = ground.filter((g) => g.surface === "steps").flatMap(ringOf);
    expect(Math.max(...treads.map((p) => p.z))).toBeCloseTo(4, 2);
    expect(new Set(treads.map((p) => p.x.toFixed(3)))).toEqual(new Set(["0.500", "3.500"]));
    for (const x of [0.6, 2, 3.4]) for (const z of [4.05, 6, 7]) expect(ground.some((g) => g.surface === "road" && pointInRing({ x, z }, ringOf(g))), `${x},${z}`).toBe(true);
  });

  it("keeps the flight whole on a parking area's asphalt", () => {
    const parking = area("road", [{ x: -5, z: 4 }, { x: 10, z: 4 }, { x: 10, z: 10 }, { x: -5, z: 10 }]);
    const ground = chunkGround([parking, ...flight], rect);
    const treads = ground.filter((g) => g.surface === "steps").flatMap(ringOf);
    expect(Math.max(...treads.map((p) => p.z))).toBeGreaterThan(6.9);
  });
});
