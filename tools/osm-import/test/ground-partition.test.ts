import { FillRule, type Path64, areaPaths, intersect } from "clipper2-ts";
import { describe, expect, it } from "vitest";
import { type GroundSurface } from "../../../packages/core/src/world/city-geo.ts";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites.ts";
import { type Pt, pointInRing, ringBounds, selfIntersects } from "../src/geometry.ts";
import { partitionGround } from "../src/ground-partition.ts";
import { type GroundOut } from "../src/model.ts";

/** ADR-0078 step 3 (ADR-0080 PR 6): the chunk's ground as a partition of the plane, ranked by what the picture draws on top. */

const ringOf = (g: GroundOut): Pt[] => Array.from({ length: g.outline.length / 2 }, (_, i) => ({ x: g.outline[2 * i]!, z: g.outline[2 * i + 1]! }));
const path = (r: readonly Pt[]): Path64 => r.map((p) => ({ x: Math.round(p.x * 1000), y: Math.round(p.z * 1000) }));
const m2 = (paths: Path64[]) => Math.abs(areaPaths(paths)) / 1e6;
const box = (surface: GroundSurface, x0: number, z0: number, x1: number, z1: number, extra: Partial<GroundOut> = {}): GroundOut => ({ surface, outline: [x0, z0, x1, z0, x1, z1, x0, z1], ...extra });
const under = (ground: readonly GroundOut[], x: number, z: number): string[] => ground.filter((g) => pointInRing({ x, z }, ringOf(g))).map((g) => g.surface + (g.bridge ? "(bridge)" : ""));
/** The m² two pieces of the ground off the bridges share. */
const overlap = (ground: readonly GroundOut[]): number => {
  const plane = ground.filter((g) => !g.bridge).map((g) => path(ringOf(g)));
  let sum = 0;
  for (let i = 0; i < plane.length; i++) for (let j = i + 1; j < plane.length; j++) sum += m2(intersect([plane[i]!], [plane[j]!], FillRule.NonZero));
  return sum;
};

describe("the ground as a partition of the plane (ADR-0078 step 3)", () => {
  // A street (6 m) with its sidewalk lapping over its edge by 0.5 m, a footway mapped across it and a lawn under all.
  const road = box("road", 0, 0, 40, 6);
  const sidewalk = box("sidewalk", 0, 5.5, 40, 8);
  const footway = box("footway", 10, -5, 12, 12);
  const lawn = box("grass", -10, -10, 50, 20);
  const ground = partitionGround([lawn, road, sidewalk, footway]);

  it("leaves one piece under every point: no two pieces lap", () => {
    expect(overlap(ground)).toBeLessThan(1e-3);
    for (const g of ground) expect(selfIntersects(ringOf(g))).toBe(false);
  });

  it("ranks the pieces as the picture draws them on top: a sidewalk over the asphalt, the asphalt over a footway across it, the paving over the lawn", () => {
    expect(under(ground, 20, 5.8)).toEqual(["sidewalk"]);
    expect(under(ground, 11, 3)).toEqual(["road"]);
    expect(under(ground, 11, 10)).toEqual(["footway"]);
    expect(under(ground, 11, -3)).toEqual(["footway"]);
    expect(under(ground, 30, 15)).toEqual(["grass"]);
    // The lawn's piece has holes where the paving is, and no bare ground is left between.
    expect(m2(ground.map((g) => path(ringOf(g))))).toBeCloseTo(60 * 30, 3);
  });

  it("keeps a piece nothing cuts to the digit, and cuts along the edges of the pieces over it", () => {
    expect(ground.find((g) => g.surface === "sidewalk")).toBe(sidewalk);
    const asphalt = ground.filter((g) => g.surface === "road");
    // Up to the sidewalk's edge, across the footway.
    expect(asphalt).toHaveLength(1);
    expect(m2(asphalt.map((g) => path(ringOf(g))))).toBeCloseTo(40 * 5.5, 3);
    // The footway either side of the street.
    expect(ground.filter((g) => g.surface === "footway")).toHaveLength(2);
  });

  it("lets a flight of steps cut what it lies on, and a zebra the asphalt under it, keeping both their rectangles", () => {
    const flight = box("steps", 2, 6, 5, 9);
    const zebra = box("crossing", 20, 0, 23, 6);
    const out = partitionGround([road, sidewalk, flight, zebra]);
    expect(out.find((g) => g.surface === "steps")).toBe(flight);
    expect(under(out, 3, 7)).toEqual(["steps"]);
    expect(under(out, 21, 3)).toEqual(["crossing"]);
    // A sidewalk's end over the zebra keeps it: the picture draws the kerb's slabs over its paint.
    expect(under(out, 21, 5.8)).toEqual(["sidewalk"]);
    expect(overlap(out)).toBeLessThan(1e-3);
  });

  it("cuts a sidewalk's lap over the carriageway instead, ranked by the carriageway", () => {
    const zebra = box("crossing", 20, 0, 23, 6);
    const out = partitionGround([lawn, road, sidewalk, footway, zebra], "carriageway");
    expect(under(out, 15, 5.8)).toEqual(["road"]);
    expect(under(out, 15, 6.2)).toEqual(["sidewalk"]);
    // The zebra's rectangle whole, the sidewalk's end cut by it.
    expect(out.find((g) => g.surface === "crossing")).toBe(zebra);
    expect(under(out, 21, 5.8)).toEqual(["crossing"]);
    expect(m2(out.filter((g) => g.surface === "road").map((g) => path(ringOf(g))))).toBeCloseTo(40 * 6 - 3 * 6, 3);
    expect(overlap(out)).toBeLessThan(1e-3);
  });

  it("leaves a bridge's deck out: it neither cuts the ground under it nor is cut", () => {
    const deck = box("road", 5, -2, 15, 10, { bridge: true, deck: [5, 4, 15, 4] });
    const out = partitionGround([lawn, road, deck]);
    expect(out).toContain(deck);
    expect(under(out, 10, 3)).toEqual(["road", "road(bridge)"]);
  });

  it("cuts a cobbled way over a plain square of one lift, and of one surface the smaller piece over the larger", () => {
    const square = box("square", 0, 0, 20, 20);
    const setts = box("cobble", 5, -5, 8, 25);
    const patch = box("square", 12, 12, 14, 14);
    const out = partitionGround([square, setts, patch]);
    expect(under(out, 6, 10)).toEqual(["cobble"]);
    expect(out).toContain(patch);
    expect(under(out, 13, 13)).toEqual(["square"]);
    expect(overlap(out)).toBeLessThan(1e-3);
  });

  it("lays the city's ground (the committed tables) with no piece over another and no outline crossing itself", () => {
    let lapped = 0;
    let crossed = 0;
    for (const c of MAP_CHUNKS) {
      const out = c.ground.filter((g) => !g.bridge);
      crossed += out.filter((g) => selfIntersects(ringOf(g))).length;
      // Pairs of pieces whose boxes meet, their shared m² in Clipper's millimetres: 93 thousand m² laid over
      // each other before the partition, 0.94 m² after, slivers along the 0.1 m steps of slanting edges.
      const boxes = out.map((g) => ringBounds(ringOf(g)));
      const paths = out.map((g) => [path(ringOf(g))]);
      for (let i = 0; i < out.length; i++)
        for (let j = i + 1; j < out.length; j++) {
          const [a, b] = [boxes[i]!, boxes[j]!];
          if (a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ) lapped += m2(intersect(paths[i]!, paths[j]!, FillRule.NonZero));
        }
    }
    expect(lapped).toBeLessThan(1);
    // One piece the map lays crossing itself, uncut (Stare Miasto's square at 758.4, -101.3; four before the partition).
    expect(crossed).toBeLessThanOrEqual(1);
  });

  it("gives the same pieces twice, in the order they came", () => {
    const again = partitionGround([lawn, road, sidewalk, footway]);
    expect(again).toEqual(ground);
    expect(ground.map((g) => g.surface)).toEqual(["grass", "road", "sidewalk", "footway", "footway"]);
  });
});
