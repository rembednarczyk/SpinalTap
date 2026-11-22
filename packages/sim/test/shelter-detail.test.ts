import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { INTERIORS, ROOM_DETAILS, SHELTER, SHELTER_DETAIL } from "../src";

/**
 * The air-raid shelter's detail after its card (ADR-0098, `docs/pomieszczenia/alchemia-shelter.md`): every model in the
 * shelter's room, drawn only, its view one of the rooms' detail's.
 */
describe("the shelter's detail (ADR-0098)", () => {
  const rooms = INTERIORS.find((i) => i.id === "alchemia-shelter")!.rooms;
  const key = (variant: number) => ROOM_DETAIL_SHAPES[variant]!.key;

  it("stands every model in the shelter, by a shape of the shelter's", () => {
    expect(SHELTER_DETAIL).toHaveLength(10);
    for (const p of SHELTER_DETAIL) {
      expect(key(p.variant).startsWith("rd-shelter-"), key(p.variant)).toBe(true);
      const inside = rooms.some((r) => p.x >= r.minX - 0.01 && p.x <= r.maxX + 0.01 && p.z >= r.minZ - 0.01 && p.z <= r.maxZ + 0.01 && p.y >= r.bottom - 0.01 && p.y <= r.top + 0.01);
      expect(inside, `${key(p.variant)} ${p.x},${p.y},${p.z}`).toBe(true);
    }
  });

  it("runs the conduits under the ceiling, the boot prints on the floor", () => {
    for (const p of SHELTER_DETAIL.filter((q) => key(q.variant) === "rd-shelter-conduit")) expect(p.y).toBeLessThan(SHELTER.ceiling - 0.1);
    expect(SHELTER_DETAIL.find((q) => key(q.variant) === "rd-shelter-prints")!.y).toBe(SHELTER.floor);
  });

  it("is one of the rooms' detail's views", () => {
    expect(ROOM_DETAILS).toContain(SHELTER_DETAIL);
  });
});
