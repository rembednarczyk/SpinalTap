import { describe, expect, it } from "vitest";
import { ALCHEMIA_ROOF_PROPS } from "../../../packages/sim/src/content/alchemia";
import { ROOF_MODEL_TOP, drawnHeight, roofModelHeight } from "./alchemia-landmark-checks";

describe("alchemia-roof-model-height (review of ADR-0093 O4)", () => {
  const tallest = ALCHEMIA_ROOF_PROPS.reduce((a, i) => (i.y + drawnHeight(i) > a.y + drawnHeight(a) ? i : a));

  it("finds a model of the game's on the roof whose drawn top stands over y 18.5, not one up to it", () => {
    // The roof's tallest tree lifted to just under the line and just over it.
    const lift = ROOF_MODEL_TOP - (tallest.y + drawnHeight(tallest));
    expect(roofModelHeight([{ ...tallest, y: tallest.y + lift - 0.01 }])).toEqual([]);
    expect(roofModelHeight([{ ...tallest, y: tallest.y + lift + 0.05 }])).toHaveLength(1);
    // A park lamp put up on a raised bed: its lantern over the line.
    const lamp = ALCHEMIA_ROOF_PROPS.find((i) => i.prop === "lamp-park")!;
    expect(roofModelHeight([{ ...lamp, y: ROOF_MODEL_TOP - drawnHeight(lamp) + 0.1 }])[0]!.what).toMatch(/^lamp-park up to y 18\.60$/);
  });

  it("finds none on the game's roof: its tallest model is a tree to y 18.04", () => {
    expect(tallest.prop).toBe("tree");
    expect(tallest.y + drawnHeight(tallest)).toBeCloseTo(18.04, 2);
    expect(roofModelHeight()).toEqual([]);
  });
});
