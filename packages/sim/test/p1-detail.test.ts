import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { INTERIORS, P1_DETAIL, ROOM_DETAILS } from "../src";

/**
 * P-1's detail after its card (ADR-0098, `docs/pomieszczenia/alchemia-parking.md`): every model in P-1's rooms, drawn only,
 * its view one of the rooms' detail's.
 */
describe("P-1's detail (ADR-0098)", () => {
  const rooms = INTERIORS.find((i) => i.id === "alchemia-parking")!.rooms;
  const key = (variant: number) => ROOM_DETAIL_SHAPES[variant]!.key;

  it("stands every model in P-1, by a shape of P-1's", () => {
    expect(P1_DETAIL).toHaveLength(15);
    for (const p of P1_DETAIL) {
      expect(key(p.variant).startsWith("rd-p1-"), key(p.variant)).toBe(true);
      const inside = rooms.some((r) => p.x >= r.minX - 0.01 && p.x <= r.maxX + 0.01 && p.z >= r.minZ - 0.01 && p.z <= r.maxZ + 0.01 && p.y >= r.bottom - 0.01 && p.y <= r.top + 0.01);
      expect(inside, `${key(p.variant)} ${p.x},${p.y},${p.z}`).toBe(true);
    }
  });

  it("is one of the rooms' detail's views", () => {
    expect(ROOM_DETAILS).toContain(P1_DETAIL);
  });
});
