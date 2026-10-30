import { describe, expect, it } from "vitest";
import { underStreet } from "../src/renderer/prop-views";

describe("props in a room under the street", () => {
  it("are the ones well below the street above them (the Trasa Podziemna under the Rynek)", () => {
    expect(underStreet(-1.8, 0.4)).toBe(true);
    expect(underStreet(-3.4, 0)).toBe(true);
  });

  it("leave out the props on the street, on its slope and off the map's terrain", () => {
    expect(underStreet(4.35, 1.2)).toBe(false);
    expect(underStreet(0.9, 1.1)).toBe(false);
    expect(underStreet(-5, null)).toBe(false);
  });
});
