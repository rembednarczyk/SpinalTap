import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { INTERIORS, METRO_DETAIL, METRO_PLATFORMS, ROOM_DETAIL_SCENERY } from "../src";

/**
 * The metro's platforms' detail after their cards (ADR-0098, `docs/pomieszczenia/metro-*.md`): one set on each
 * platform, placed from its layout, every piece inside its platform's room, drawn only.
 */
describe("the metro platforms' detail (ADR-0098)", () => {
  it("gives every platform its set, inside its own room", () => {
    expect(METRO_DETAIL).toHaveLength(METRO_PLATFORMS.length);
    METRO_PLATFORMS.forEach((e, i) => {
      const rooms = INTERIORS.find((r) => r.id === `metro-${e.station}`)!.rooms;
      const set = METRO_DETAIL[i]!;
      expect(set).toHaveLength(7);
      for (const p of set) {
        const name = p.prop === "room-detail" ? ROOM_DETAIL_SHAPES[p.variant]!.key : p.prop;
        const inside = rooms.some((r) => p.x >= r.minX - 0.01 && p.x <= r.maxX + 0.01 && p.z >= r.minZ - 0.01 && p.z <= r.maxZ + 0.01 && p.y >= r.bottom - 0.01 && p.y <= r.top + 0.01);
        expect(inside, `${e.station} ${name} ${p.x},${p.y},${p.z}`).toBe(true);
      }
    });
  });

  it("lays the litter on a bench's seat, 0.45 m over the floor", () => {
    METRO_PLATFORMS.forEach((e, i) => {
      const litter = METRO_DETAIL[i]!.find((p) => p.prop === "room-detail" && ROOM_DETAIL_SHAPES[p.variant]!.key === "rd-metro-litter")!;
      expect(litter.y).toBeCloseTo(e.platform.floor + 0.45, 5);
    });
  });

  it("is in the rooms' detail's views, one a platform", () => {
    for (const set of METRO_DETAIL) expect(ROOM_DETAIL_SCENERY.map((s) => s.view)).toContainEqual({ kind: "street-props", items: set });
  });
});
