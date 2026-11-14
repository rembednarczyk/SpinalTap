import { describe, expect, it } from "vitest";
import {
  CONTACT_BLUR_FRAGMENT,
  CONTACT_NEAR_WEIGHT,
  CONTACT_OCCLUSION_FRAGMENT,
  CONTACT_SHADE,
  CONTACT_SHADE_GLSL,
  contactWeight,
  halfTangents,
} from "../src/npr/contact-shade";
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

  it("counts occluding samples in its own pass and blurs them along one surface", () => {
    expect(CONTACT_SHADE_GLSL).toContain("i < 12");
    expect(CONTACT_SHADE_GLSL).not.toMatch(/\btime\b/);
    expect(CONTACT_OCCLUSION_FRAGMENT).toContain("contactOcclusion(vUV, d, n)");
    // The blur weighs neighbours by the depth difference, so the shade does not cross a silhouette.
    expect(CONTACT_BLUR_FRAGMENT).toContain("abs(sd - d)");
  });

  /**
   * The occlusion seen from straight above (G-796), in metres: samples spread over the floor disc
   * of the reach (a golden-angle spiral, as the shader's), each standing on what covers the floor
   * there. Returns the weighed share the shader thresholds.
   */
  const shareFromAbove = (cover: (x: number, z: number) => readonly [number, number, number] | null): number => {
    const r = CONTACT_SHADE.radius;
    const n = 4096;
    let occ = 0;
    for (let i = 0; i < n; i++) {
      const t = Math.sqrt((i + 0.5) / n) * r;
      const a = i * 2.3999632;
      const v = cover(Math.cos(a) * t, Math.sin(a) * t);
      if (!v) continue;
      const l = Math.hypot(...v);
      if (v[1] / Math.max(l, 1e-4) > 0.3 && l < r) occ += contactWeight(l, r);
    }
    return Math.min(1, occ / n);
  };
  // A figure from above: skirt, arms and a gun held out, 0.7 m over the floor, 0.5 m round.
  const figure =
    (rho: number) =>
    (x: number, z: number): readonly [number, number, number] | null =>
      (x - rho) ** 2 + z * z < 0.25 ? [x, 0.7, z] : null;
  // A wall `d` m away, seen at 45 degrees: beyond its foot the samples climb it.
  const wall =
    (d: number) =>
    (x: number, z: number): readonly [number, number, number] | null =>
      x > d ? [d, x - d, z] : null;

  it("leaves no shade round a figure seen from above, where the share hovered at the threshold (G-796)", () => {
    // Counted alike, the share stood at 0.21-0.11 from 0.4 to 0.7 m: a wide patch round the
    // 0.18 step, which the samples' noise broke into blocks.
    for (const rho of [0.4, 0.5, 0.6, 0.7]) expect(shareFromAbove(figure(rho))).toBeLessThan(CONTACT_SHADE.threshold * 0.6);
  });

  it("keeps the band at a wall's foot, where the occluders stand near", () => {
    for (const d of [0.05, 0.1, 0.2]) expect(shareFromAbove(wall(d))).toBeGreaterThan(CONTACT_SHADE.threshold * 1.5);
    expect(contactWeight(0, 1)).toBe(CONTACT_NEAR_WEIGHT);
    expect(contactWeight(1, 1)).toBe(0);
    // The shader counts the same weight.
    expect(CONTACT_SHADE_GLSL).toContain(`${CONTACT_NEAR_WEIGHT.toFixed(1)} * (1.0 - sqrt(l2) / r)`);
  });
});
