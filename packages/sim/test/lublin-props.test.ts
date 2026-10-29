import { describe, expect, it } from "vitest";
import { terrainHeightAt } from "@seki/core";
import { LUBLIN_CHUNKS, LUBLIN_STREET_PROPS, streetPropsView } from "../src/content/lublin";
import { decodePropTable } from "../src/content/lublin/props";

describe("street furniture of Lublin (ADR-0047)", () => {
  it("decodes the table into items per chunk, kind by kind", () => {
    const out = decodePropTable({ "a-0-0": { bench: [1, 2, 3, 0.5, 7, 4, 5, 6, -1, 8], tree: [9, 9, 9, 0, 1] } });
    expect(out["a-0-0"]).toEqual([
      { prop: "bench", x: 1, y: 2, z: 3, yaw: 0.5, variant: 7 },
      { prop: "bench", x: 4, y: 5, z: 6, yaw: -1, variant: 8 },
      { prop: "tree", x: 9, y: 9, z: 9, yaw: 0, variant: 1 },
    ]);
  });

  it("has furniture in every chunk, inside it and on its terrain, and a view per chunk", () => {
    for (const c of LUBLIN_CHUNKS) {
      const items = LUBLIN_STREET_PROPS[c.id] ?? [];
      expect(items.length, c.id).toBeGreaterThan(0);
      for (const i of items) {
        expect(i.x >= c.bounds.minX - 0.05 && i.x <= c.bounds.maxX + 0.05 && i.z >= c.bounds.minZ - 0.05 && i.z <= c.bounds.maxZ + 0.05).toBe(true);
        expect(Math.abs(i.y - terrainHeightAt(c.terrain, i.x, i.z))).toBeLessThan(0.2);
      }
      const view = streetPropsView(c.id);
      expect(view.kind === "street-props" && view.items.length).toBe(items.length);
    }
    const none = streetPropsView("nowhere");
    expect(none.kind === "street-props" && none.items.length).toBe(0);
  });
});
