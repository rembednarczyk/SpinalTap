import { describe, expect, it } from "vitest";
import { FARA_BENCHES, FARA_TELESCOPE, PO_FARZE_DETAIL, WORLD_SCENERY, inBuilding, nearestWall } from "../src";

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
});
