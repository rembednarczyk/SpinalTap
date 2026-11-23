import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import { INTERIORS, type InteriorRoom, MALL_LEVELS, interiorAt, interiorFloorAt } from "../src";

/**
 * The storey under the player (ADR-0100): the interior, its number where the plan numbers them,
 * and the rooms of that floor, worked out from the interiors' rooms (ADR-0061).
 */

const roomsOf = (id: string): readonly InteriorRoom[] => INTERIORS.find((i) => i.id === id)!.rooms;
/** The middle of a room, on its floor. */
const on = (r: InteriorRoom): Vec3 => ({ x: (r.minX + r.maxX) / 2, y: r.bottom, z: (r.minZ + r.maxZ) / 2 });
/** The biggest room of an interior. */
const main = (id: string): InteriorRoom => [...roomsOf(id)].sort((a, b) => (b.maxX - b.minX) * (b.maxZ - b.minZ) - (a.maxX - a.minX) * (a.maxZ - a.minZ))[0]!;
const at = (p: Vec3) => interiorFloorAt(p, interiorAt(p)?.id ?? null);

describe("the storey under the player (ADR-0100)", () => {
  it("numbers Alchemia's car park P-1 and P-2, its tunnel P-2", () => {
    expect(at(on(main("alchemia-parking")))).toMatchObject({ interior: { id: "alchemia-parking" }, level: -1 });
    const p2 = at(on(main("alchemia-p2")))!;
    expect(p2).toMatchObject({ interior: { id: "alchemia-p2", name: "interior.alchemia-p2" }, level: -2 });
    expect(p2.rooms).toEqual(roomsOf("alchemia-p2"));
    expect(at(on(main("alchemia-p2-tunnel")))?.level).toBe(-2);
  });

  it("gives the gallery's floors P0 to P3, each with its own rooms and its shops'", () => {
    const levels = [MALL_LEVELS.p0, MALL_LEVELS.p1, MALL_LEVELS.p2, MALL_LEVELS.p3].map((y) => {
      const r = roomsOf("alchemia-gallery").find((g) => g.bottom === y) ?? roomsOf("alchemia-foodhall").find((g) => g.bottom === y)!;
      return at(on(r))!;
    });
    expect(levels.map((f) => f.level)).toEqual([0, 1, 2, 3]);
    // No room of one floor on another's plan.
    for (const f of levels) expect(new Set(f.rooms.map((r) => Math.round(r.bottom))).size).toBeLessThanOrEqual(2);
    expect(levels[1]!.rooms.length).toBeGreaterThan(roomsOf("alchemia-gallery").filter((r) => r.bottom === MALL_LEVELS.p1).length);
    // In a shop off P1: the shop's name, the gallery's level, the whole floor.
    const shop = INTERIORS.find((i) => i.within === "alchemia-gallery" && i.id.includes("-p1-"))!;
    const inShop = at(on(shop.rooms[0]!))!;
    expect(inShop.interior.id).toBe(shop.id);
    expect(inShop.level).toBe(1);
    expect(inShop.rooms).toBe(interiorFloorAt(on(shop.rooms[0]!), shop.id)!.rooms);
    expect(inShop.rooms).toContain(shop.rooms[0]);
  });

  it("names a metro platform without a number, with its flight and platform", () => {
    const platform = main("metro-kanal");
    const f = at(on(platform))!;
    expect(f).toMatchObject({ interior: { id: "metro-kanal" }, level: null });
    expect(f.rooms).toEqual(roomsOf("metro-kanal"));
  });

  it("splits W-3's hall into its floor and its gallery by height", () => {
    const hall = roomsOf("w3-hall");
    const low = hall.find((r) => r.bottom === Math.min(...hall.map((h) => h.bottom)))!;
    const high = hall.find((r) => r.bottom === Math.max(...hall.map((h) => h.bottom)))!;
    const ground = interiorFloorAt(on(low), "w3-hall")!;
    const up = interiorFloorAt(on(high), "w3-hall")!;
    expect(ground.rooms.every((r) => r.bottom === low.bottom)).toBe(true);
    expect(up.rooms.every((r) => r.bottom === high.bottom)).toBe(true);
    expect(ground.level).toBeNull();
  });

  it("is null outside and the same object on the same floor", () => {
    expect(interiorFloorAt({ x: 321, y: 0, z: -80 }, null)).toBeNull();
    expect(interiorFloorAt({ x: 0, y: 0, z: 0 }, "nowhere")).toBeNull();
    const r = main("alchemia-p2");
    expect(at({ ...on(r), x: r.minX + 1 })).toBe(at({ ...on(r), x: r.maxX - 1 }));
  });
});
