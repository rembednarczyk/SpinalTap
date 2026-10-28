import { WORLD_CHUNKS } from "@seki/sim";
import { describe, expect, it } from "vitest";
import { DISTRICT_PALETTES, PALETTE_BLEND_SECONDS, PaletteBlend, districtAt, lerpHue, lerpPalette, rigWithPalette } from "../src/npr/district-palette";
import { DAY_RIG, NIGHT_RIG } from "../src/npr/lighting";

const hue = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

describe("district colour script (ADR-0030)", () => {
  it("has a palette for every district of the map", () => {
    for (const c of WORLD_CHUNKS) expect(DISTRICT_PALETTES[c.district]).toBeDefined();
  });

  it("gives each district its own colours: pink-violet, amber-red, cold blue with sodium", () => {
    const s = DISTRICT_PALETTES["shinsekai-7"];
    expect(hue(s.fog)).toBeGreaterThan(240);
    expect(hue(s.rim)).toBeGreaterThan(290);
    const t = DISTRICT_PALETTES.targ;
    expect(hue(t.fog)).toBeLessThan(40);
    expect(hue(t.rim)).toBeGreaterThan(20);
    expect(hue(t.rim)).toBeLessThan(45);
    const d = DISTRICT_PALETTES.doki;
    expect(hue(d.fog)).toBeGreaterThan(200);
    expect(hue(d.fog)).toBeLessThan(230);
    expect(hue(d.rim)).toBeGreaterThan(20);
    expect(hue(d.rim)).toBeLessThan(40);
    expect(d.saturation).toBeLessThan(t.saturation);
  });

  it("names districts by camera position as the simulation does (later chunks win at seams)", () => {
    expect(districtAt(0, 0)).toBe("shinsekai-7");
    expect(districtAt(106, 79)).toBe("targ");
    expect(districtAt(27, 145)).toBe("doki");
    expect(districtAt(20, 70)).toBe("kanal");
    // Under the market gate Kanałowa runs on into the market's bounds: the market wins.
    expect(districtAt(70, 70)).toBe("targ");
    expect(districtAt(1000, 1000)).toBeNull();
  });

  it("blends hues the short way round", () => {
    expect(lerpHue(350, 10, 0.5)).toBeCloseTo(0);
    expect(lerpHue(10, 350, 0.25)).toBeCloseTo(5);
    expect(lerpHue(100, 200, 0.5)).toBeCloseTo(150);
  });

  it("interpolates every field and returns the ends exactly", () => {
    const a = DISTRICT_PALETTES["shinsekai-7"];
    const b = DISTRICT_PALETTES.targ;
    expect(lerpPalette(a, b, 0)).toBe(a);
    expect(lerpPalette(a, b, 1)).toBe(b);
    const m = lerpPalette(a, b, 0.5);
    expect(m.saturation).toBeCloseTo((a.saturation + b.saturation) / 2);
    expect(m.fog).not.toBe(a.fog);
    expect(m.fog).not.toBe(b.fog);
    // 272 -> 356 the short way passes 314.
    expect(m.shadows.hue).toBeCloseTo(314);
  });

  it("takes the night haze and ambient from the district and gives way to the day rig", () => {
    const p = DISTRICT_PALETTES.doki;
    const night = rigWithPalette(NIGHT_RIG, p, 0);
    expect(night.fogColor).toBe(p.fog);
    expect(night.ambient).toBe(p.ambient);
    expect(night.sunDir).toBe(NIGHT_RIG.sunDir);
    const day = rigWithPalette(DAY_RIG, p, 1);
    expect(day.fogColor).toBe(DAY_RIG.fogColor);
    expect(day.ambient).toBe(DAY_RIG.ambient);
  });

  it("eases from district to district and restarts from what is on screen", () => {
    const blend = new PaletteBlend(DISTRICT_PALETTES.kanal);
    expect(blend.update(0.1)).toBe(false);
    blend.retarget(DISTRICT_PALETTES.targ);
    expect(blend.update(PALETTE_BLEND_SECONDS / 2)).toBe(true);
    const mid = blend.value;
    expect(mid).not.toBe(DISTRICT_PALETTES.kanal);
    expect(mid).not.toBe(DISTRICT_PALETTES.targ);
    // Turning back mid-way starts from the mixed palette, not from the market's.
    blend.retarget(DISTRICT_PALETTES.kanal);
    blend.update(0.0001);
    expect(blend.value.saturation).toBeCloseTo(mid.saturation, 1);
    blend.update(PALETTE_BLEND_SECONDS);
    expect(blend.value).toBe(DISTRICT_PALETTES.kanal);
    expect(blend.update(1)).toBe(false);
    blend.retarget(DISTRICT_PALETTES.doki, true);
    expect(blend.value).toBe(DISTRICT_PALETTES.doki);
    expect(blend.target).toBe(DISTRICT_PALETTES.doki);
  });
});
