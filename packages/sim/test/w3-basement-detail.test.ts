import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { INTERIORS, ROOM_DETAIL_SCENERY, W3_BASEMENT_DETAIL, W3_PROPS, WORLD_SCENERY } from "../src";

/**
 * W-3's basement's detail built by Blender after its card (ADR-0098, `docs/pomieszczenia/w3-basement.md`): drawn
 * only, in the basement and the culvert, the hall's solids untouched, its view the last of the rooms' detail's.
 */
describe("W-3's basement's detail (ADR-0098)", () => {
  const room = INTERIORS.find((i) => i.id === "w3-basement")!;
  const key = (variant: number) => ROOM_DETAIL_SHAPES[variant]!.key;
  const inRoom = (x: number, y: number, z: number) => room.rooms.some((r) => x >= r.minX - 0.01 && x <= r.maxX + 0.01 && z >= r.minZ - 0.01 && z <= r.maxZ + 0.01 && y >= r.bottom - 0.01 && y <= r.top + 0.01);

  it("stands every model in the basement or the culvert, by a shape of the basement's", () => {
    expect(W3_BASEMENT_DETAIL).toHaveLength(12);
    for (const p of W3_BASEMENT_DETAIL) {
      expect(key(p.variant).startsWith("rd-w3b-"), key(p.variant)).toBe(true);
      expect(inRoom(p.x, p.y, p.z), `${key(p.variant)} ${p.x},${p.y},${p.z}`).toBe(true);
    }
  });

  it("stands the pump clear of the hall's solids (the bench, the columns, the stairs)", () => {
    const pump = W3_BASEMENT_DETAIL.find((p) => key(p.variant) === "rd-w3b-pump")!;
    // Its footprint: 0.95 m across x (its back to the west wall), 1.6 m along z.
    const fp = { minX: pump.x - 0.5, maxX: pump.x + 0.45, minZ: pump.z - 0.95, maxZ: pump.z + 0.65 };
    const solids = W3_PROPS.filter((p) => p.solid && p.view.kind === "block" && p.center.y > pump.y - 0.5 && p.center.y < pump.y + 3);
    for (const s of solids) {
      const sz = (s.view as { size: { x: number; y: number; z: number } }).size;
      const sheet = sz.x <= 0.31 || sz.y <= 0.31 || sz.z <= 0.31;
      // Walls, floors and slabs: the pump stands against them.
      if (sheet) continue;
      const hit = s.center.x + sz.x / 2 > fp.minX && s.center.x - sz.x / 2 < fp.maxX && s.center.z + sz.z / 2 > fp.minZ && s.center.z - sz.z / 2 < fp.maxZ;
      expect(hit, `${s.center.x},${s.center.z}`).toBe(false);
    }
  });

  it("is the last of the rooms' detail's views, the scenery's last", () => {
    expect(WORLD_SCENERY.slice(-ROOM_DETAIL_SCENERY.length)).toEqual(ROOM_DETAIL_SCENERY);
    expect(ROOM_DETAIL_SCENERY.at(-1)!.view).toEqual({ kind: "street-props", items: W3_BASEMENT_DETAIL });
  });
});
