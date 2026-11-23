import { describe, expect, it } from "vitest";
import { GLAZ_KATOWSKI, KATEDRALNY_DETAIL, KATEDRALNY_MONUMENT, WORLD_SCENERY, inBuilding } from "../src";

/*
 * Plac Katedralny after its card (`docs/lokacje/plac-katedralny.md`, ADR-0102 point 5): the candles before the
 * monument, the terminal beside the stone, on the square.
 */
describe("Plac Katedralny's scene (ADR-0102 point 5)", () => {
  it("lays the candles before the monument and stands the terminal beside the stone, out of the houses", () => {
    expect(KATEDRALNY_MONUMENT).toBeDefined();
    expect(GLAZ_KATOWSKI).toBeDefined();
    const [candles, terminal] = KATEDRALNY_DETAIL;
    expect(KATEDRALNY_DETAIL).toHaveLength(2);
    expect(Math.hypot(candles!.x - KATEDRALNY_MONUMENT!.x, candles!.z - KATEDRALNY_MONUMENT!.z)).toBeCloseTo(1, 6);
    expect(Math.hypot(terminal!.x - GLAZ_KATOWSKI!.x, terminal!.z - GLAZ_KATOWSKI!.z)).toBeCloseTo(1.5, 6);
    for (const i of KATEDRALNY_DETAIL) expect(inBuilding(i.x, i.z)).toBe(false);
    expect(WORLD_SCENERY.some((s) => s.view.kind === "street-props" && s.view.items === KATEDRALNY_DETAIL)).toBe(true);
  });
});
