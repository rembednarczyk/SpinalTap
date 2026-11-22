import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { CAPSULE_DETAIL, CAPSULE_DOOR, CAPSULE_FURNITURE, CAPSULE_INTERIOR_ROOM, ROOM_DETAIL_SCENERY, WORLD_SCENERY } from "../src";

/**
 * The capsule room's detail built by Blender after its card (ADR-0098, `docs/pomieszczenia/capsule.md`): drawn
 * only, in the room, out of a body's way, its view the last of the rooms' detail's.
 */
describe("the capsule room's detail (ADR-0098)", () => {
  const r = CAPSULE_INTERIOR_ROOM;
  const key = (variant: number) => ROOM_DETAIL_SHAPES[variant]!.key;

  it("stands every model in the room, by a shape of the capsule's", () => {
    expect(CAPSULE_DETAIL.map((p) => key(p.variant))).toEqual([
      "rd-capsule-door",
      "rd-capsule-hooks",
      "rd-capsule-trash",
      "rd-capsule-sink",
      "rd-capsule-food",
      "rd-capsule-towel",
      "rd-capsule-charger",
      "rd-capsule-rules",
    ]);
    for (const p of CAPSULE_DETAIL) {
      expect(p.x, key(p.variant)).toBeGreaterThanOrEqual(r.minX - 0.01);
      expect(p.x, key(p.variant)).toBeLessThanOrEqual(r.maxX + 0.01);
      expect(p.z, key(p.variant)).toBeGreaterThanOrEqual(r.minZ - 0.01);
      expect(p.z, key(p.variant)).toBeLessThanOrEqual(r.maxZ + 0.01);
      expect(p.y, key(p.variant)).toBeGreaterThanOrEqual(r.bottom);
      expect(p.y, key(p.variant)).toBeLessThan(r.top);
    }
  });

  it("leaves the doorway clear: the door's leaf lies on the wall east of it, the bag west of it", () => {
    const door = CAPSULE_DETAIL.find((p) => key(p.variant) === "rd-capsule-door")!;
    const jambR = CAPSULE_DOOR.at.x + CAPSULE_DOOR.width / 2;
    const jambL = CAPSULE_DOOR.at.x - CAPSULE_DOOR.width / 2;
    // The leaf is 1.14 m wide and overlaps its jamb by 0.1 at most.
    expect(door.x - 0.57).toBeGreaterThan(jambR - 0.11);
    expect(door.x + 0.57).toBeLessThanOrEqual(r.maxX);
    const bag = CAPSULE_DETAIL.find((p) => key(p.variant) === "rd-capsule-trash")!;
    expect(bag.x + 0.25).toBeLessThan(jambL);
  });

  it("stands the floor's models clear of the furniture's solids", () => {
    for (const p of CAPSULE_DETAIL.filter((q) => q.y < r.bottom + 0.01)) {
      for (const f of CAPSULE_FURNITURE) {
        const v = f.view as { size: { x: number; z: number } };
        const inside = Math.abs(p.x - f.center.x) < v.size.x / 2 && Math.abs(p.z - f.center.z) < v.size.z / 2;
        expect(inside, key(p.variant)).toBe(false);
      }
    }
  });

  it("follows the Old Town's rooms in the rooms' detail's views, at the scenery's end", () => {
    expect(WORLD_SCENERY.slice(-ROOM_DETAIL_SCENERY.length)).toEqual(ROOM_DETAIL_SCENERY);
    expect(ROOM_DETAIL_SCENERY.at(-2)!.view).toEqual({ kind: "street-props", items: CAPSULE_DETAIL });
  });
});
