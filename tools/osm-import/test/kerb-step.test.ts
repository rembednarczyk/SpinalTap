import { describe, expect, it } from "vitest";
import { kerbFillFlicker } from "../../glitch-scan/test/kerb-fill-flicker.ts";
import { generatedAround } from "./city.ts";

describe("the corner by a widened carriageway's step out beside a lawn (G-897)", () => {
  it("lays one surface along the kerb at the end of Ruska's zebra in Podzamcze, not grass between squares", () => {
    // PZGiK: paving from the asphalt to the lawn's corner at (1066.2, 474.4) and on to the sidewalk.
    // The carriageway w228683887 widened to the sidewalk at the zebra's north end steps out 1.5 m
    // by the lawn w804709930, and the corner beside the step was the bare ground rule's: 1 m of
    // grass between two squares along the kerb (`kerb-fill-flicker podzamcze-2-1 1060,470`).
    const at = { x: 1066.4, z: 474.7 };
    const found = kerbFillFlicker(generatedAround([at]).chunks).filter((f) => {
      const [x, z] = f.at.split(",").map(Number) as [number, number];
      return Math.hypot(x - at.x, z - at.z) < 5;
    });
    expect(found.map((f) => `${f.at} ${f.what}`)).toEqual([]);
  });
});
