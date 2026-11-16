import { describe, expect, it } from "vitest";
import { type AlbedoMedians, mediansOf, readMedians } from "../../orto/src/albedo-medians.ts";
import { ALBEDO_DRIFT, albedoSurfaces, laidColour, luma, orthoPavingKeys, pavingAlbedoDrift, planToGrass } from "./paving-albedo";

/** Medians of two flights, the first the reference: lawns of luma 100, a square of 170 and a pool's floor of 190. */
const medians = (square: number): AlbedoMedians =>
  mediansOf([
    { id: "2025-04", photographed: ["2025-04-12"], rows: [{ surface: "grass", median: [100, 100, 100], luma: 100, samples: 10 }, { surface: "square", median: [square, square, square], luma: square, samples: 5 }, { surface: "basin", median: [190, 190, 190], luma: 190, samples: 3 }] },
    { id: "2024-06", photographed: ["2024-06-21"], rows: [{ surface: "grass", median: [80, 80, 80], luma: 80, samples: 10 }, { surface: "square", median: [140, 140, 140], luma: 140, samples: 5 }] },
  ]);

describe("paving-albedo-drift (G-721, G-734)", () => {
  it("writes the medians small and in order, with the ratio to the lawns", () => {
    const m = medians(170);
    expect(m.reference).toBe("2025-04");
    expect(Object.keys(m.flights["2025-04"]!.surfaces)).toEqual(["basin", "grass", "square"]);
    expect(m.flights["2025-04"]!.surfaces.square).toEqual({ rgb: [170, 170, 170], luma: 170, toGrass: 1.7, samples: 5 });
    expect(m.flights["2024-06"]!.surfaces.square!.toGrass).toBe(1.75);
  });

  it("finds a paving laid off the orthophoto's ratio by more than the threshold, the fountains' floor left out", () => {
    expect(pavingAlbedoDrift({ square: 1.7 }, medians(170))).toEqual([]);
    expect(pavingAlbedoDrift({ square: 1.7 + ALBEDO_DRIFT - 0.01 }, medians(170))).toEqual([]);
    expect(pavingAlbedoDrift({ square: 1.3 }, medians(170)).map((f) => f.at)).toEqual(["ground-plan:square"]);
    // Dark on purpose (the player's decision of 13.11): never a hit.
    expect(pavingAlbedoDrift({ basin: 0.2 }, medians(170))).toEqual([]);
    expect(pavingAlbedoDrift({ cobble: 1.5 }, medians(170))[0]!.what).toContain("no median");
    expect(pavingAlbedoDrift({ square: 1.7 }, undefined)).toHaveLength(1);
  });

  it("reads the palette's surfaces and colours from the renderer", () => {
    expect(orthoPavingKeys("const ORTHO_PAVING = {\n  square: { rgb: [1, 2, 3], toSquare: 1 },\n  cobble: { rgb: [1, 2, 3], toSquare: 0.9 },\n} as const;")).toEqual(["square", "cobble"]);
    expect(orthoPavingKeys()).toEqual(expect.arrayContaining(["square", "cobble", "footway", "sidewalk"]));
    const plan = planToGrass(["square", "road"]);
    // The squares are laid at 1.7 the lawns' brightness (`SQUARE_TO_GRASS`), the asphalt darker than the lawns.
    expect(plan.square).toBeCloseTo(1.7, 3);
    expect(plan.road).toBeLessThan(1);
    expect(luma(laidColour("grass"))).toBeGreaterThan(0);
    // Beside the palette, every surface laid with a median (the roads), never the lawns or the fountains' floor.
    expect(albedoSurfaces(["square"], medians(170))).toEqual(["square"]);
    expect(albedoSurfaces(["cobble"], { ...medians(170), flights: { "2025-04": { photographed: [], surfaces: { road: { rgb: [1, 1, 1], luma: 1, toGrass: 0.7, samples: 1 }, basin: { rgb: [1, 1, 1], luma: 1, toGrass: 1, samples: 1 } } } } })).toEqual(["cobble", "road"]);
    // The committed medians hold the reference flight and every surface of the palette.
    const m = readMedians()!;
    expect(Object.keys(m.flights[m.reference]!.surfaces)).toEqual(expect.arrayContaining(orthoPavingKeys()));
  });
});
