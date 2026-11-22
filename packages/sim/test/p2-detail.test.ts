import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { INTERIORS, P2_DETAIL, ROOM_DETAIL_SCENERY } from "../src";

/**
 * P-2's detail after its card (ADR-0098, `docs/pomieszczenia/alchemia-p2.md`): every model in P-2's rooms, drawn only,
 * its view one of the rooms' detail's.
 */
describe("P-2's detail (ADR-0098)", () => {
  const rooms = INTERIORS.find((i) => i.id === "alchemia-p2")!.rooms;
  const key = (variant: number) => ROOM_DETAIL_SHAPES[variant]!.key;

  it("stands every model in P-2, by a shape of P-2's", () => {
    expect(P2_DETAIL).toHaveLength(7);
    for (const p of P2_DETAIL) {
      expect(key(p.variant).startsWith("rd-p2-"), key(p.variant)).toBe(true);
      const inside = rooms.some((r) => p.x >= r.minX - 0.01 && p.x <= r.maxX + 0.01 && p.z >= r.minZ - 0.01 && p.z <= r.maxZ + 0.01 && p.y >= r.bottom - 0.01 && p.y <= r.top + 0.01);
      expect(inside, `${key(p.variant)} ${p.x},${p.y},${p.z}`).toBe(true);
    }
  });

  it("is one of the rooms' detail's views", () => {
    expect(ROOM_DETAIL_SCENERY.map((s) => s.view)).toContainEqual({ kind: "street-props", items: P2_DETAIL });
  });
});
