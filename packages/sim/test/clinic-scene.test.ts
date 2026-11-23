import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { CLINIC_DETAIL, interiorAt } from "../src";

/*
 * Mori's clinic after its card (`docs/pomieszczenia/clinic.md`, ADR-0102 point 5): Kaito's stool stands by the chair
 * inside the clinic, off the chair and the cart.
 */
const keyOf = (variant: number): string => ROOM_DETAIL_SHAPES[variant]!.key;
const at = (key: string) => CLINIC_DETAIL.find((i) => keyOf(i.variant) === key)!;
const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

describe("the clinic's scene (ADR-0102 point 5)", () => {
  it("stands Kaito's stool by the chair, in the clinic, clear of the chair and the cart", () => {
    const stool = at("rd-clinic-stool");
    const chair = at("rd-clinic-chair");
    expect(interiorAt({ x: stool.x, y: stool.y + 0.5, z: stool.z })?.id).toBe("clinic");
    expect(flat(stool, chair)).toBeLessThan(1.8);
    expect(flat(stool, chair)).toBeGreaterThan(0.8);
    expect(flat(stool, at("rd-clinic-cart"))).toBeGreaterThan(1.2);
  });
});
