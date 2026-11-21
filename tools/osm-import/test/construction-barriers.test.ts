import { describe, expect, it } from "vitest";
import { CLUTTER, CLUTTER_SHAPES } from "../../../packages/core/src/world/clutter.ts";
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { type SiteGround, lineDistance } from "../src/construction-ground.ts";
import { CONE_STEP, WALK_LEFT } from "../src/construction-barriers.ts";
import { planSite } from "../src/construction-site.ts";
import { FENCE_INSET, insetRing } from "../src/construction-fence.ts";
import { type Pt, pointInRing } from "../src/geometry.ts";

/**
 * The cones and barriers on a building site's street side (ADR-0096 rule 2) on a plan: a site
 * 40 x 24 m from (0, 0), a pavement 3 m wide south of it, the carriageway past it with a street
 * on its axis at z -6.
 */
const outline: Pt[] = [
  { x: 0, z: 0 },
  { x: 40, z: 0 },
  { x: 40, z: 24 },
  { x: 0, z: 24 },
];
/** The fence's line, 0.3 m in from the outline. */
const fence = insetRing(outline, FENCE_INSET);
const street = [
  { x: -50, z: -6 },
  { x: 90, z: -6 },
];
const surface = (p: Pt): "road" | "walk" | null => (p.z < -3 && p.z > -9 ? "road" : p.z <= 0.1 && p.z >= -3 ? "walk" : null);
const ground = (opts: { street?: boolean; verge?: boolean } = {}): SiteGround => ({
  free: (p) => surface(p) === null,
  open: () => true,
  ...(opts.verge === false ? {} : { verge: (p: Pt) => surface(p) !== "road" && !pointInRing(p, fence) }),
  heightAt: (p) => 0.01 * p.x,
  cellAt: () => 2.5,
  driveDistance: (p) => (opts.street === false ? Infinity : lineDistance(p, street)),
  walkDistance: (p) => Math.abs(p.z + 1.5),
  neighbours: [],
});

const clutter = (pieces: readonly StreetPropItem[]) => pieces.filter((p) => p.prop === "clutter");
const shapes = (pieces: readonly StreetPropItem[]) => clutter(pieces).map((p) => p.variant);

describe("a building site's street side (ADR-0096 rule 2)", () => {
  const site = planSite({ id: "w1", ring: outline }, ground());
  const pieces = clutter(site.pieces);

  it("lines the fence on the street with cones every 1.5 m, out on the pavement, none on the carriageway", () => {
    const cones = pieces.filter((p) => p.variant === CLUTTER.cone);
    expect(cones.length).toBeGreaterThan(10);
    for (const c of cones) {
      expect(surface(c)).toBe("walk");
      expect(c.z).toBeLessThan(0);
    }
    const xs = cones.map((c) => c.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]! >= CONE_STEP - 0.01).toBe(true);
    // Only the street side: the other three sides have no street within reach.
    expect(pieces.every((p) => p.z < 0)).toBe(true);
  });

  it("keeps every piece's footprint off the carriageway and the fence, a way past it, and the gate's opening and board clear", () => {
    expect(site.gate).not.toBeNull();
    const gateX = site.pieces.find((p) => p.prop === "site-gate")!.x;
    const board = site.pieces.find((p) => p.prop === "site-board")!;
    for (const p of pieces) {
      const s = CLUTTER_SHAPES[p.variant]!.solid!;
      const [c, n] = [Math.cos(p.yaw), Math.sin(p.yaw)];
      for (const [x, z] of [
        [-s.hx, -s.hz],
        [s.hx, -s.hz],
        [-s.hx, s.hz],
        [s.hx, s.hz],
      ] as const) {
        const q = { x: p.x + x * c + z * n, z: p.z - x * n + z * c };
        // Between the fence and the carriageway: the pavement, or the strip behind the outline in front of the panels.
        expect(surface(q), `${p.variant} at ${p.x}`).not.toBe("road");
        expect(pointInRing(q, fence), `${p.variant} at ${p.x}`).toBe(false);
        expect(q.z).toBeGreaterThan(-3 + WALK_LEFT - 0.6 - 1e-6);
      }
      expect(Math.abs(p.x - gateX)).toBeGreaterThan(3 + s.hx);
      expect(Math.abs(p.x - board.x)).toBeGreaterThan(1.2 + s.hx);
    }
  });

  it("puts a barrier at each corner of the street side and crowd barriers by the gate, at most one in four bent", () => {
    const barriers = pieces.filter((p) => (CLUTTER.barriers as readonly number[]).includes(p.variant));
    // The gate takes the stretch nearest the west corner (the first of the places equally near the street), its barrier with it.
    expect(barriers.length).toBe(1);
    expect(barriers[0]!.x).toBeGreaterThan(38);
    expect(barriers[0]!.x).toBeLessThan(40 - 0.3 - CLUTTER_SHAPES[barriers[0]!.variant]!.solid!.hx + 1e-6);
    const railings = pieces.filter((p) => CLUTTER.railings.some((r) => (r as readonly number[]).includes(p.variant)));
    expect(railings.length).toBeGreaterThanOrEqual(1);
    expect(railings.length).toBeLessThanOrEqual(2);
    // Within the fence's side: none past the corner.
    for (const r of railings) expect(r.x - CLUTTER_SHAPES[r.variant]!.solid!.hx).toBeGreaterThan(0.3 - 1e-6);
    // Across many sites, the bent ones stay near one in four.
    const all = Array.from({ length: 200 }, (_, k) => shapes(planSite({ id: `w${k + 10}`, ring: outline }, ground()).pieces)).flat();
    const bent = all.filter((v) => v === CLUTTER.railings[0][1] || v === CLUTTER.railings[1][1]).length;
    const whole = all.filter((v) => v === CLUTTER.railings[0][0] || v === CLUTTER.railings[1][0]).length;
    expect(bent / (bent + whole)).toBeLessThan(0.35);
    expect(bent).toBeGreaterThan(0);
  });

  it("is the same twice, keeps the site's own pieces as they were, and lays nothing off a street or with no verge", () => {
    expect(planSite({ id: "w1", ring: outline }, ground()).pieces).toEqual(site.pieces);
    const bare = planSite({ id: "w1", ring: outline }, ground({ verge: false }));
    expect(site.pieces.filter((p) => p.prop !== "clutter")).toEqual(bare.pieces);
    expect(clutter(bare.pieces)).toEqual([]);
    expect(clutter(planSite({ id: "w1", ring: outline }, ground({ street: false })).pieces)).toEqual([]);
  });
});
