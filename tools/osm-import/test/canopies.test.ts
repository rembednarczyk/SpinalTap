import { describe, expect, it } from "vitest";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { NABRZEZE_CHUNKS } from "../../../packages/sim/src/content/lublin/nabrzeze.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import { CANOPY, canopyPosts } from "../src/canopies.ts";
import { pointInRing } from "../src/geometry.ts";

/**
 * The map's roofs on posts (`building=roof`, G-063): the bus platform on Aleja Tysiąclecia, the
 * stall roofs of Targ na Ruskiej, the museum's well and the two shelters, once left out of the
 * import. Each is a slab over its outline on posts inside it, high enough to walk under.
 */
const CHUNKS = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS];
const ROOFS = CHUNKS.flatMap((c) => c.canopies ?? []);
const ring = (flat: readonly number[]) => Array.from({ length: flat.length >> 1 }, (_, i) => ({ x: flat[2 * i]!, z: flat[2 * i + 1]! }));

describe("roofs on posts (G-063)", () => {
  it("stands the eight of the audit, none of them a building of its chunk", () => {
    // The audit's places (glitches.md G-063): the platform, the market's four, the well, two shelters.
    expect(ROOFS.map((r) => r.id).sort()).toEqual(["w1382568876", "w1547216433", "w1547216435", "w1547216436", "w1547216437", "w175886790", "w458862470", "w828763988"]);
    const buildings = new Set(CHUNKS.flatMap((c) => c.buildings.map((b) => b.id)));
    for (const r of ROOFS) expect(buildings.has(r.id), r.id).toBe(false);
  });

  it("lifts each slab to a clearance one walks under, a slab deep, on posts inside its outline", () => {
    for (const r of ROOFS) {
      const clearance = r.soffit - r.plinth;
      expect(clearance, r.id).toBeGreaterThanOrEqual(2.2);
      expect(clearance, r.id).toBeLessThanOrEqual(4.5);
      expect(r.height - r.soffit, r.id).toBeCloseTo(CANOPY.slab, 5);
      const outline = ring(r.outline);
      const posts = ring(r.posts);
      expect(posts.length, r.id).toBeGreaterThanOrEqual(4);
      for (const p of posts) expect(pointInRing(p, outline), `${r.id} ${p.x},${p.z}`).toBe(true);
    }
  });

  it("sets posts at a square roof's corners and along its edges a bay apart at most", () => {
    const square = [{ x: -5, z: -2 }, { x: 5, z: -2 }, { x: 5, z: 2 }, { x: -5, z: 2 }];
    const posts = canopyPosts(square);
    // Four corners and one post halfway along each long side.
    expect(posts).toHaveLength(6);
    // Rounded to 0.1 m: the inset within 0.1 m.
    for (const p of posts) expect(Math.abs(Math.min(5 - Math.abs(p.x), 2 - Math.abs(p.z)) - CANOPY.inset)).toBeLessThan(0.1);
  });
});
