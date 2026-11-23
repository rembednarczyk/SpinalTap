import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { ALCHEMIA_MARKET_PROPS, FOODHALL, HANA_SPOT, T1_CART, T1_DETAIL, T1_EXTRACT, T1_FURNITURE, T1_HATCH, T1_SMOKERS, WORLD_SCENERY, beforeHatch, opening } from "../src";
import { ACTIVITY_SPOTS } from "../src/content/activity-spots";
import { groundY } from "../src/content/lublin/terrain";

/*
 * T1 after its card (`docs/lokacje/alchemia-t1.md`, ADR-0102 point 5): Hana's cart drawn where its solid stands, Fumiko's
 * hatch with its awning, extract and stools, the smokers' leavings where people smoke, the café garden and the bin clear
 * of the ways from the gallery's doors to the cart.
 */

const keyOf = (variant: number): string => ROOM_DETAIL_SHAPES[variant]!.key;
const models = (key: string) => T1_DETAIL.filter((i) => i.prop === "room-detail" && keyOf(i.variant) === key);
const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
/** The distance of `p` from the segment a-b on the ground. */
const offSegment = (p: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
};

describe("Alchemia's T1 scene (ADR-0102 point 5)", () => {
  it("draws Hana's cart by its model where its solid stands, the block no more drawn", () => {
    const solid = ALCHEMIA_MARKET_PROPS.find((p) => p.center.x === T1_CART.x && p.center.z === T1_CART.z)!;
    expect(solid.solid).toBe(true);
    expect(solid.scenery).toBe(true);
    const [cart] = models("rd-t1-cart");
    expect(flat(cart!, T1_CART)).toBeLessThan(1e-9);
    expect(flat(cart!, HANA_SPOT)).toBeCloseTo(1.3, 5);
    expect(ROOM_DETAIL_SHAPES.find((s) => s.key === "rd-t1-cart")?.sound).toBe("hum");
    expect(WORLD_SCENERY.some((s) => s.view.kind === "street-props" && s.view.items === T1_DETAIL)).toBe(true);
  });

  it("dresses Fumiko's hatch: its awning and extract on the front over it, her stools where the night market sits", () => {
    const hatch = opening("fumiko-hatch");
    expect(T1_HATCH.x).toBeCloseTo((hatch.x0 + hatch.x1) / 2, 9);
    expect(T1_HATCH.z).toBe(FOODHALL.maxZ);
    for (const key of ["rd-t1-hatch", "rd-t1-stools"]) {
      const [m] = models(key);
      expect(flat(m!, T1_HATCH), key).toBeLessThan(1e-9);
    }
    // The extract's fan box out of the wall over the hatch's west half, its source past the room's 0.6 m (open air).
    const [extract] = models("rd-t1-extract");
    expect(flat(extract!, T1_EXTRACT)).toBeLessThan(1e-9);
    expect(T1_EXTRACT.z - FOODHALL.maxZ).toBeGreaterThan(0.6);
    expect(T1_EXTRACT.x).toBeGreaterThan(hatch.x0);
    expect(ROOM_DETAIL_SHAPES.find((s) => s.key === "rd-t1-extract")?.sound).toBe("vent");
    // The model's stools stand 1.2 m out of the hatch at -1.6 and 0 across it, where the sitters' spots are.
    for (const across of [-1.6, 0]) {
      const stool = beforeHatch(1.2, across);
      expect(ACTIVITY_SPOTS.some((s) => flat(s.at, stool) < 0.05), `${across}`).toBe(true);
    }
  });

  it("leaves the smokers' leavings at the front's foot where they smoke, every piece on T1", () => {
    const butts = models("rd-t1-butts");
    expect(butts.map((b) => b.x)).toEqual([...T1_SMOKERS]);
    for (const b of butts) expect(ACTIVITY_SPOTS.some((s) => Math.abs(s.at.x - b.x) < 0.05 && Math.abs(s.at.z - b.z) < 1)).toBe(true);
    for (const i of T1_DETAIL) {
      expect(i.y, `${i.prop} ${i.x},${i.z}`).toBeCloseTo(groundY(i.x, i.z), 5);
      expect(Math.abs(i.y - FOODHALL.floor), `${i.prop} ${i.x},${i.z}`).toBeLessThan(0.05);
    }
  });

  it("keeps the ways from the gallery's entrance and its east door to the cart free of the garden and the bin", () => {
    const entrance = opening("entrance");
    const east = opening("east-door");
    const ways = [
      [{ x: (entrance.x0 + entrance.x1) / 2, z: FOODHALL.maxZ + 0.5 }, HANA_SPOT],
      [{ x: (east.x0 + east.x1) / 2, z: FOODHALL.maxZ + 0.5 }, HANA_SPOT],
    ] as const;
    for (const f of T1_FURNITURE) for (const [a, b] of ways) expect(offSegment(f, a, b), f.prop).toBeGreaterThan(2);
    // Fumiko's door stays clear too.
    const door = opening("fumiko-door");
    for (const f of T1_FURNITURE) expect(flat(f, { x: (door.x0 + door.x1) / 2, z: FOODHALL.maxZ + 0.4 }), f.prop).toBeGreaterThan(0.9);
  });
});
