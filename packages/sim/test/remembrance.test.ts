import { describe, expect, it } from "vitest";
import { ALCHEMIA_MEMORIAL, MEMORIAL_CLEAR, REMEMBRANCE_PLACES, remembranceOff } from "../src";

describe("the places of remembrance the city's neon keeps off (ADR-0074 §6, G-943)", () => {
  it("are the memorial of Plac Ofiar Getta and the six stumbling stones of the map", () => {
    expect(REMEMBRANCE_PLACES.map((r) => r.name).sort()).toEqual(
      [
        "the memorial of Plac Ofiar Getta",
        "the stumbling stone Abram Cygielman",
        "the stumbling stone Bela Mandelsberg-Szyldkraut",
        "the stumbling stone Bela Szpiro-Nisenbaum",
        "the stumbling stone Jakub Hersz Nisenbaum",
        "the stumbling stone Lejb Cygielman",
        "the stumbling stone Maria Rechtszaft",
      ].sort(),
    );
    expect(MEMORIAL_CLEAR).toBe(20);
  });

  it("measure across the plan from the memorial's box, 0 inside it", () => {
    const m = REMEMBRANCE_PLACES[0]!;
    expect(remembranceOff({ x: (ALCHEMIA_MEMORIAL.x0 + ALCHEMIA_MEMORIAL.x1) / 2, z: ALCHEMIA_MEMORIAL.z0 + 0.1 }, m)).toBe(0);
    expect(remembranceOff({ x: ALCHEMIA_MEMORIAL.x1 + 3, z: ALCHEMIA_MEMORIAL.z1 + 4 }, m)).toBeCloseTo(5, 9);
  });
});
