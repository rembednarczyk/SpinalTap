import { describe, expect, it } from "vitest";
import { LANDMARK_RECIPES } from "../../../packages/engine/src/renderer/mapcity/landmarks/recipes";
import { LANDMARK_BUILDINGS, isListedLandmark } from "../src/landmark-ids.ts";

describe("the landmarks' list (G-631)", () => {
  it("holds every part of the renderer's landmark recipes", () => {
    const parts = LANDMARK_RECIPES.flatMap((r) => r.parts.map((p) => p.osm));
    expect(parts.length).toBeGreaterThan(0);
    for (const id of parts) expect(LANDMARK_BUILDINGS, id).toContain(id);
  });

  it("takes a split piece by its whole's id, and no id twice", () => {
    expect(isListedLandmark("w66264159/1")).toBe(true);
    expect(isListedLandmark("w1")).toBe(false);
    expect(new Set(LANDMARK_BUILDINGS).size).toBe(LANDMARK_BUILDINGS.length);
  });
});
