import { describe, expect, it } from "vitest";
import { ENEMY_TYPES, appearanceOf, appearanceOfEnemy, sameAppearance, starterKit } from "../src";

describe("appearance", () => {
  it("describes the starting kit: Unity-9 at the hip, jacket and pants", () => {
    const { inventory, equipment } = starterKit();
    const look = appearanceOf(inventory, equipment);
    expect(look.weapons).toEqual({ primary: null, secondary: "pistol", melee: null, active: "secondary" });
    expect(look.garments.torso).toEqual({ tint: "jacket-seki" });
    expect(look.garments.legs).toEqual({ tint: "cargo" });
    expect(look.garments.head).toBeUndefined();
  });

  it("gives an enemy its weapon in the matching slot and its outfit", () => {
    const look = appearanceOfEnemy(ENEMY_TYPES.hebi_enforcer);
    expect(look.weapons.active).toBe("primary");
    expect(look.weapons.primary).toBe("shotgun");
    expect(look.garments.head?.attachments).toEqual([{ point: "head", mesh: "helmet" }]);
  });

  it("puts a sidearm or a melee weapon in its own slot", () => {
    expect(appearanceOfEnemy(ENEMY_TYPES.hebi_lookout).weapons).toEqual({ primary: null, secondary: "pistol", melee: null, active: "secondary" });
    expect(appearanceOfEnemy({ ...ENEMY_TYPES.hebi_lookout, weapon: "baton" }).weapons).toEqual({ primary: null, secondary: null, melee: "baton", active: "melee" });
  });

  it("compares looks by value", () => {
    const { inventory, equipment } = starterKit();
    expect(sameAppearance(appearanceOf(inventory, equipment), appearanceOf(inventory, equipment))).toBe(true);
    expect(sameAppearance(appearanceOf(inventory, equipment), appearanceOf(inventory, { ...equipment, active: "primary" }))).toBe(false);
    expect(sameAppearance(null, null)).toBe(true);
    expect(sameAppearance(null, appearanceOf(inventory, equipment))).toBe(false);
  });
});
