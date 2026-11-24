import { describe, expect, it } from "vitest";
import { FARA_BENCHES, FARA_STEPS_BULB, FARA_TELESCOPE, PO_FARZE_DETAIL, PO_FARZE_LAMPS, SCENE_LAMP_GROUPS, WORLD_SCENERY, groundY, inBuilding, nearestWall } from "../src";
import { LUBLIN_CHUNKS } from "../src/content/lublin";

/*
 * Plac po Farze after its card (`docs/lokacje/plac-po-farze.md`, ADR-0102 point 5): the telescope and its benches on
 * the square's open east side, out of the houses, looking east.
 */
describe("Plac po Farze's scene (ADR-0102 point 5)", () => {
  it("stands the telescope and two benches on the open square, facing east", () => {
    const t = PO_FARZE_DETAIL[0]!;
    expect(Math.hypot(t.x - FARA_TELESCOPE.x, t.z - FARA_TELESCOPE.z)).toBeLessThan(1e-9);
    expect(Math.sin(t.yaw)).toBeCloseTo(1, 9);
    for (const p of [t, ...FARA_BENCHES]) {
      expect(inBuilding(p.x, p.z)).toBe(false);
      expect(nearestWall(p.x, p.z).d).toBeGreaterThan(1.5);
    }
    expect(WORLD_SCENERY.some((s) => s.view.kind === "street-props" && s.view.items === PO_FARZE_DETAIL)).toBe(true);
  });

  it("lights the square at night in fittings: the telescope's screen and a bulb at the head of the steps to Zaułek Panasa", () => {
    // The bulb off the houses and off the steps, a stride from the top flight's head (696.1; 48.7).
    expect(inBuilding(FARA_STEPS_BULB.x, FARA_STEPS_BULB.z)).toBe(false);
    expect(Math.hypot(FARA_STEPS_BULB.x - 696.1, FARA_STEPS_BULB.z - 48.7)).toBeLessThan(2.5);
    const steps = LUBLIN_CHUNKS.flatMap((c) => c.ground.filter((g) => g.surface === "steps"));
    const inside = (flat: readonly number[], x: number, z: number) => {
      let hit = false;
      for (let i = 0, j = flat.length - 2; i < flat.length; j = i, i += 2) {
        const [xi, zi, xj, zj] = [flat[i]!, flat[i + 1]!, flat[j]!, flat[j + 1]!];
        if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
      }
      return hit;
    };
    expect(steps.some((g) => inside(g.outline, FARA_STEPS_BULB.x, FARA_STEPS_BULB.z))).toBe(false);
    expect(PO_FARZE_DETAIL.some((p) => p.x === FARA_STEPS_BULB.x && p.z === FARA_STEPS_BULB.z)).toBe(true);
    // Each light within a hand of its fitting, at its height, and the group among the scenes' lights.
    const [screen, bulb] = PO_FARZE_LAMPS.lamps;
    expect(Math.hypot(screen!.at.x - FARA_TELESCOPE.x, screen!.at.z - FARA_TELESCOPE.z)).toBeLessThan(0.6);
    expect(screen!.at.y - groundY(FARA_TELESCOPE.x, FARA_TELESCOPE.z)).toBeCloseTo(1.055, 3);
    expect(Math.hypot(bulb!.at.x - FARA_STEPS_BULB.x, bulb!.at.z - FARA_STEPS_BULB.z)).toBeCloseTo(0.5, 3);
    expect(SCENE_LAMP_GROUPS).toContain(PO_FARZE_LAMPS);
  });
});
