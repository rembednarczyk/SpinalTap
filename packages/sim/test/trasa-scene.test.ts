import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { INTERIORS, interiorAt } from "../src";
import { MEI_POSTER, TRASA_DETAIL, TRASA_EXIT_SIGN, TRASA_LEAK } from "../src/content/trasa-detail";
import { TRASA_PODZIEMNA } from "../src/content/lublin/sites";

/*
 * Trasa Podziemna after its card (`docs/pomieszczenia/trasa-podziemna.md`, ADR-0102 point 5): the exit sign at the
 * stairs' foot facing back up them, Mei's poster in the loch, the leak in the south corridor, all inside the cellars.
 */

const keyOf = (variant: number): string => ROOM_DETAIL_SHAPES[variant]!.key;
const at = (key: string) => TRASA_DETAIL.find((i) => keyOf(i.variant) === key && Math.abs(i.x - (key === "rd-w3h-exit" ? TRASA_EXIT_SIGN.x : i.x)) < 1e-9)!;
const F = TRASA_PODZIEMNA.floor;

describe("Trasa Podziemna's scene (ADR-0102 point 5)", () => {
  it("marks the way out at the stairs' foot, facing up them, under the stair hall's ceiling", () => {
    const sign = at("rd-w3h-exit");
    expect(sign.x).toBe(TRASA_EXIT_SIGN.x);
    expect(sign.z).toBeGreaterThan(TRASA_PODZIEMNA.stairs.minZ);
    expect(sign.z).toBeLessThan(TRASA_PODZIEMNA.stairs.maxZ);
    expect(Math.sin(sign.yaw)).toBeCloseTo(-1, 9);
    expect(sign.y - F).toBeLessThan(TRASA_PODZIEMNA.hall);
  });

  it("puts Mei's poster in the loch and the leak in the south corridor, inside the cellars, the leak dripping", () => {
    const trasa = INTERIORS.find((i) => interiorAt({ x: MEI_POSTER.x, y: F + 1, z: MEI_POSTER.z + 0.3 })?.id === i.id);
    expect(trasa).toBeDefined();
    expect(interiorAt({ x: TRASA_LEAK.x, y: F + 1, z: TRASA_LEAK.z })?.id).toBe(trasa!.id);
    expect(at("rd-trasa-poster").y).toBe(F);
    expect(ROOM_DETAIL_SHAPES.find((s) => s.key === "rd-trasa-drip")?.sound).toBe("drip");
  });
});
