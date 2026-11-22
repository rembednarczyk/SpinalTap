import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { FOODHALL_DETAIL, INTERIORS, ROOM_DETAIL_SCENERY, seatingPieces } from "../src";

/**
 * The food hall's round things after its card (ADR-0098, comic realism): its lanterns, meals, cups and the knocked
 * stool are the rooms' detail's models, no box of the seating stands for them any more.
 */
describe("the food hall's detail (ADR-0098)", () => {
  // The food hall and L3's dining room, where one of its table groups moved (ADR-0093 O5).
  const rooms = INTERIORS.filter((i) => i.id.startsWith("alchemia-")).flatMap((i) => i.rooms);
  const key = (variant: number) => ROOM_DETAIL_SHAPES[variant]!.key;
  const inside = (x: number, y: number, z: number) => rooms.some((r) => x >= r.minX - 0.01 && x <= r.maxX + 0.01 && z >= r.minZ - 0.01 && z <= r.maxZ + 0.01 && y >= r.bottom - 0.01 && y <= r.top + 0.01);

  it("stands every model in Alchemia's rooms, by a shape of the food hall's", () => {
    for (const p of FOODHALL_DETAIL) {
      expect(key(p.variant).startsWith("rd-fh-"), key(p.variant)).toBe(true);
      expect(inside(p.x, p.y, p.z), `${key(p.variant)} ${p.x},${p.y},${p.z}`).toBe(true);
    }
    expect(FOODHALL_DETAIL.filter((p) => key(p.variant) === "rd-fh-lantern").length).toBeGreaterThanOrEqual(16);
    expect(FOODHALL_DETAIL.filter((p) => key(p.variant) === "rd-fh-lantern-small").length).toBeGreaterThanOrEqual(30);
  });

  it("leaves no box for a lantern or a cup in the seating, nor the knocked stool", () => {
    const pieces = seatingPieces();
    expect(pieces.filter((p) => p.kind === "lantern" || p.kind === "cup")).toEqual([]);
    expect(pieces.filter((p) => p.kind === "bench" && !p.solid)).toEqual([]);
  });

  it("is one of the rooms' detail's views", () => {
    expect(ROOM_DETAIL_SCENERY.map((s) => s.view)).toContainEqual({ kind: "street-props", items: FOODHALL_DETAIL });
  });
});
