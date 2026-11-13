import { describe, expect, it } from "vitest";
import { CONTACT_SHADE, CONTACT_SHADE_GLSL, halfTangents } from "../src/npr/contact-shade";
import { QUALITY_TIERS } from "../src/npr/quality";

describe("contact shade (graphics backlog 13.11, step 2)", () => {
  it("takes the half-angle tangents from a horizontally fixed field of view", () => {
    const [x, y] = halfTangents(Math.PI / 2, true, 1600, 900);
    expect(x).toBeCloseTo(1, 6);
    expect(y).toBeCloseTo(900 / 1600, 6);
  });

  it("and from a vertically fixed one", () => {
    const [x, y] = halfTangents(Math.PI / 2, false, 1600, 900);
    expect(y).toBeCloseTo(1, 6);
    expect(x).toBeCloseTo(1600 / 900, 6);
  });

  it("shades on high quality only, in one hard step within a metre and a half", () => {
    expect(QUALITY_TIERS.high.contactShade).toBe(true);
    expect(QUALITY_TIERS.medium.contactShade).toBe(false);
    expect(QUALITY_TIERS.low.contactShade).toBe(false);
    expect(CONTACT_SHADE.radius).toBeLessThanOrEqual(1.5);
    expect(CONTACT_SHADE.strength).toBeGreaterThan(0);
    expect(CONTACT_SHADE.strength).toBeLessThan(1);
  });

  it("reads the depth sixteen times and keeps the pattern fixed between frames", () => {
    expect(CONTACT_SHADE_GLSL).toContain("i < 16");
    expect(CONTACT_SHADE_GLSL).not.toMatch(/\btime\b/);
  });
});
