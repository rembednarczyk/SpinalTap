import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { INTERIORS, KOI_DETAIL, ROOM_DETAIL_SCENERY, S7_INTERIORS, WORLD_SCENERY } from "../src";

/**
 * Neon Koi's detail built by Blender after its card (ADR-0098, `docs/pomieszczenia/neon-koi.md`): its
 * models stand in the bar, the blocks they draw stay solids without a view, its view is the scenery's last.
 */
describe("Neon Koi's detail (ADR-0098)", () => {
  const koi = INTERIORS.find((i) => i.id === "neon-koi")!;
  const inKoi = (x: number, y: number, z: number) => koi.rooms.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ && y >= r.bottom - 0.3 && y <= r.top);

  it("stands every model of the bar in the bar, by a shape of the rooms' detail", () => {
    expect(KOI_DETAIL.length).toBe(14);
    for (const p of KOI_DETAIL) {
      expect(inKoi(p.x, p.y, p.z), `${p.x},${p.z}`).toBe(true);
      expect(ROOM_DETAIL_SHAPES[p.variant]!.key.startsWith("rd-koi-")).toBe(true);
    }
  });

  it("keeps the counter, shelf, tables and jukebox as solids (the stools and chairs as before, not), drawn by the models alone", () => {
    const drawn = S7_INTERIORS.filter((p) => p.scenery && inKoi(p.center.x, p.center.y, p.center.z));
    expect(drawn).toHaveLength(14);
    expect(drawn.filter((p) => p.solid)).toHaveLength(5);
    expect(drawn.filter((p) => p.view.kind === "neon")).toHaveLength(2);
  });

  it("is the first of the rooms' detail's views, the scenery's last, so the ids before them stay", () => {
    expect(WORLD_SCENERY.slice(-ROOM_DETAIL_SCENERY.length)).toEqual(ROOM_DETAIL_SCENERY);
    expect(ROOM_DETAIL_SCENERY[0]!.view).toEqual({ kind: "street-props", items: KOI_DETAIL });
  });
});
