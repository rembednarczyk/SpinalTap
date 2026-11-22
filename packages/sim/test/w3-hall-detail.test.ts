import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { INTERIORS, ROOM_DETAILS, W3_HALL_DETAIL, W3_INSIDE_BLOCKS, W3_PALLETS, W3_PROPS } from "../src";

/**
 * W-3's assembly hall's detail built by Blender after its card (ADR-0098, `docs/pomieszczenia/w3-hall.md`): in the hall,
 * the pallets' solids drawn by their models and left out of the hall's inside mesh, the rest drawn only.
 */
describe("W-3's hall's detail (ADR-0098)", () => {
  const room = INTERIORS.find((i) => i.id === "w3-hall")!;
  const key = (variant: number) => ROOM_DETAIL_SHAPES[variant]!.key;
  const inRoom = (x: number, y: number, z: number) => room.rooms.some((r) => x >= r.minX - 0.01 && x <= r.maxX + 0.01 && z >= r.minZ - 0.01 && z <= r.maxZ + 0.01 && y >= r.bottom - 0.01 && y <= r.top + 0.01);

  it("stands every model in the hall, by a shape of the hall's", () => {
    expect(W3_HALL_DETAIL).toHaveLength(14);
    for (const p of W3_HALL_DETAIL) {
      expect(key(p.variant).startsWith("rd-w3h-"), key(p.variant)).toBe(true);
      expect(inRoom(p.x, p.y, p.z), `${key(p.variant)} ${p.x},${p.y},${p.z}`).toBe(true);
    }
  });

  it("draws each pallet's solid with a pallet's model on it, and the hall's inside mesh leaves the pallets out", () => {
    const models = W3_HALL_DETAIL.filter((p) => key(p.variant).startsWith("rd-w3h-pallet-"));
    expect(models).toHaveLength(W3_PALLETS.length);
    for (const r of W3_PALLETS) {
      const x = (r.minX + r.maxX) / 2;
      const z = (r.minZ + r.maxZ) / 2;
      expect(models.some((m) => m.x === x && m.z === z), `${x},${z}`).toBe(true);
      expect(W3_PROPS.some((p) => p.solid && p.center.x === x && p.center.z === z), `solid ${x},${z}`).toBe(true);
      expect(W3_INSIDE_BLOCKS.some((b) => b.center.x === x && b.center.z === z)).toBe(false);
    }
  });

  it("is one of the rooms' detail's views, at the scenery's end", () => {
    expect(ROOM_DETAILS).toContain(W3_HALL_DETAIL);
  });
});
