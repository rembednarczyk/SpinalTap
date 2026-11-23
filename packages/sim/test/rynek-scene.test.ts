import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { GRODZKA_LANTERN, KANAL_PROPS, RYNEK_DETAIL, RYNEK_FURNITURE, RYNEK_VENDING, TETSU_TABLE, WORLD_SCENERY, inBuilding, nearestWall } from "../src";
import { ENCOUNTERS } from "../src/content/encounters";
import { groundY } from "../src/content/lublin/terrain";

/*
 * The Rynek after its card (`docs/lokacje/rynek.md`, ADR-0102 point 5): Tetsu's table drawn where its solid stands, the
 * fronts' clusters at their walls' feet, the drinks machine at its encounter, the lantern at the mouth of Grodzka.
 */

const keyOf = (variant: number): string => ROOM_DETAIL_SHAPES[variant]!.key;
const modelOf = (key: string) => RYNEK_DETAIL.find((i) => i.prop === "room-detail" && keyOf(i.variant) === key)!;
const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

describe("the Rynek's scene (ADR-0102 point 5)", () => {
  it("draws Tetsu's table by its model where its solid stands, humming, the block no more drawn", () => {
    const solid = KANAL_PROPS.find((p) => Math.abs(p.center.x - TETSU_TABLE.x) < 1e-9 && Math.abs(p.center.z - TETSU_TABLE.z) < 1e-9)!;
    expect(solid.solid).toBe(true);
    expect(solid.scenery).toBe(true);
    expect(flat(modelOf("rd-ry-table"), TETSU_TABLE)).toBeLessThan(1e-9);
    expect(ROOM_DETAIL_SHAPES.find((s) => s.key === "rd-ry-table")?.sound).toBe("hum");
    expect(WORLD_SCENERY.some((s) => s.view.kind === "street-props" && s.view.items === RYNEK_DETAIL)).toBe(true);
  });

  it("leaves each front's cluster at its wall's foot, out of the house, near its neon", () => {
    const neon = (label: string) => KANAL_PROPS.find((p) => p.view.kind === "neon" && p.view.label === label)!.center;
    for (const [key, label] of [["rd-ry-denki", "DENKI"], ["rd-ry-sake", "SAKE"], ["rd-ry-karaoke", "KARAOKE"]] as const) {
      const m = modelOf(key);
      const front = neon(label);
      expect(inBuilding(m.x, m.z), key).toBe(false);
      expect(nearestWall(m.x, m.z).d, key).toBeLessThan(0.2);
      expect(flat(m, front), key).toBeLessThan(1);
      expect(m.y, key).toBeCloseTo(groundY(m.x, m.z), 5);
    }
  });

  it("puts the drinks machine where the vending encounter talks and a lantern at the mouth of Grodzka", () => {
    const vending = ENCOUNTERS.find((e) => e.id === "kanal_vending")!;
    expect(flat(RYNEK_VENDING.at, vending.at)).toBeLessThan(vending.radius);
    expect(inBuilding(RYNEK_VENDING.at.x, RYNEK_VENDING.at.z)).toBe(false);
    expect(flat(GRODZKA_LANTERN.at, { x: 577, z: -23 })).toBeLessThan(4);
    expect(RYNEK_FURNITURE.map((f) => f.prop)).toEqual(["vending-machine", "lamp-wall-lantern"]);
  });
});
