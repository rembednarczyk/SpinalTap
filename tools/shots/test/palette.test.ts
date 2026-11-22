import { describe, expect, it } from "vitest";
import type { Frame } from "../src/metrics.ts";
import { PALETTE_BANDS, groupOf, paletteFaults, paletteSplit } from "../src/palette.ts";

/** A frame of 100 pixels: `base` dark ones, `lit` warm lit ones, the rest magenta neon. */
const frame = (base: number, lit: number): Frame => {
  const rgb = new Uint8Array(300);
  for (let i = 0; i < 100; i++) rgb.set(i < base ? [20, 18, 30] : i < base + lit ? [200, 170, 130] : [255, 40, 200], i * 3);
  return { width: 10, height: 10, rgb };
};

describe("the 60-30-10 rule of light colour on a shot (zasady-lokacji §13)", () => {
  it("tells the dark base, the motivated light and the neon accents apart", () => {
    expect(groupOf(0, 0, 0)).toBe("base");
    expect(groupOf(60, 50, 70)).toBe("base");
    // A warm lamp's pool, a cold fluorescent white: lit, not accents.
    expect(groupOf(210, 170, 120)).toBe("motivated");
    expect(groupOf(220, 230, 240)).toBe("motivated");
    // Neon magenta and cyan, and a dim saturated sign: an accent only when bright.
    expect(groupOf(255, 40, 200)).toBe("accent");
    expect(groupOf(40, 220, 255)).toBe("accent");
    expect(groupOf(110, 10, 80)).toBe("motivated");
  });

  it("splits a frame and keeps the rule at 60-30-10, not with a flat lit frame or a neon wall", () => {
    expect(paletteSplit(frame(60, 30))).toEqual({ base: 60, motivated: 30, accent: 10 });
    expect(paletteFaults(paletteSplit(frame(60, 30)))).toEqual([]);
    // The old moonlit interior: everything evenly lit, no dark base.
    expect(paletteFaults(paletteSplit(frame(20, 75)))).toEqual([`base 20% < ${PALETTE_BANDS.base[0]}%`, `motivated 75% > ${PALETTE_BANDS.motivated[1]}%`]);
    // A wall of neon.
    expect(paletteFaults(paletteSplit(frame(55, 15)))).toContain(`accent 30% > ${PALETTE_BANDS.accent[1]}%`);
  });
});
