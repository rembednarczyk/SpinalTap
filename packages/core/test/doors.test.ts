import { describe, expect, it } from "vitest";
import { DOOR_MAX, DOOR_MODELS, doorLayout, doorVariant } from "../src";

describe("the variant of a facade door (ADR-0058 stage 9)", () => {
  it("keeps the model and the size, rounded up to 5 cm across and 2 cm up, in 16 bits", () => {
    for (const model of DOOR_MODELS) {
      for (const [width, height] of [
        [0.8, 2.0],
        [1.15, 2.3],
        [2.62, 3.41],
      ] as const) {
        const v = doorVariant({ model, width, height });
        expect(v).toBeLessThan(1 << 16);
        const d = doorLayout(v);
        expect(d.model).toBe(model);
        expect(d.width - width).toBeGreaterThanOrEqual(-1e-9);
        expect(d.width - width).toBeLessThan(0.05);
        expect(d.height - height).toBeGreaterThanOrEqual(-1e-9);
        expect(d.height - height).toBeLessThan(0.02);
        // On the grid it stays where it is.
        expect(doorLayout(doorVariant(d))).toEqual(d);
      }
    }
  });

  it("clamps a size outside its range", () => {
    const d = doorLayout(doorVariant({ model: "tall", width: 9, height: 1 }));
    expect(d.width).toBe(DOOR_MAX.width);
    expect(d.height).toBe(2);
    expect(doorLayout(doorVariant({ model: "tall", width: 1, height: 9 })).height).toBe(DOOR_MAX.height);
  });

  it("the model is the low 3 bits, the shape the renderer reads", () => {
    expect(doorVariant({ model: "shop", width: 1.2, height: 2.3 }) % 8).toBe(DOOR_MODELS.indexOf("shop"));
  });
});
