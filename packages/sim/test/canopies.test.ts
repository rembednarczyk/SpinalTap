import { describe, expect, it } from "vitest";
import { WORLD_CHUNKS } from "../src";
import { canopyPosts, canopyProp, CANOPY_POST } from "../src/content/lublin/canopies";
import { MAP_CHUNKS } from "../src/content/lublin/sites";

/** The roofs on posts of the map (G-063) in the game: solids one walks under between the posts. */
const ROOFS = MAP_CHUNKS.flatMap((c) => (c.canopies ?? []).map((r) => ({ chunk: c.id, r })));

describe("the map's roofs on posts in the game (G-063)", () => {
  it("are the last solids of their chunks' streets, so the ids before them stay", () => {
    expect(ROOFS.length).toBe(8);
    for (const { chunk, r } of ROOFS) {
      const street = WORLD_CHUNKS.find((c) => c.id === chunk)!.street ?? [];
      const own = street.filter((p) => p.center.x === r.x && p.center.z === r.z);
      expect(own, r.id).toHaveLength(1);
      expect(street.slice(-(MAP_CHUNKS.find((c) => c.id === chunk)!.canopies ?? []).length)).toContain(own[0]);
    }
  });

  it("leave the space under the slab open but for the posts", () => {
    for (const { r } of ROOFS) {
      const prop = canopyProp(r);
      const posts = canopyPosts(r);
      const under = (prop.prisms ?? []).filter((p) => p.bottom < r.soffit);
      expect(under, r.id).toHaveLength(posts.length);
      for (const p of under) {
        const xs = p.points.map((q) => q.x);
        expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(CANOPY_POST, 5);
        expect(p.top).toBe(r.soffit);
      }
      const slab = (prop.prisms ?? []).filter((p) => p.bottom === r.soffit);
      expect(slab.length, r.id).toBe(r.parts.length);
      expect(prop.view.kind).toBe("building");
    }
  });
});
