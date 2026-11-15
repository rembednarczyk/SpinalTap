import { describe, expect, it } from "vitest";
import { LAMP_STREAK_GLSL, MAX_LAMP_STREAKS, lampStreak, streakShows } from "../src/npr/lamp-streaks";
import { TOON_FRAGMENT } from "../src/npr/toon-shader";
import { LampStreakFeed, type StreakLamp, pickStreakLamps } from "../src/renderer/mapcity/lamp-streak-feed";
import type { ToonWetGround } from "../src/npr/toon-wet-ground";

/**
 * The lamps' streaks on the wet street at night (ADR-0084 stage 1, round 3): one narrow streak
 * per lamp towards the eye, in the water only, long at a grazing view.
 */

/** A road lamp's light 6 m up at the origin; the eye 1.7 m up, `d` m away along +z. */
const LAMP = { x: 0, y: 6, z: 0 };
const eyeAt = (d: number) => ({ x: 0, y: 1.7, z: d });

/** The streak's lit run across at `along` m from the lamp towards the eye (m), 0 where it is dark. */
const widthAt = (along: number, d: number, seed = 7): number => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let x = -4; x <= 4; x += 0.005) {
    if (lampStreak({ x, y: 0, z: along }, LAMP, seed, eyeAt(d)) > 0) {
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
  }
  return hi > lo ? hi - lo : 0;
};

/** Its lit run along the line to the eye (m). */
const lengthOf = (d: number, seed = 7): number => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let z = 0; z <= d; z += 0.02) {
    let lit = false;
    for (let x = -1; x <= 1 && !lit; x += 0.02) lit = lampStreak({ x, y: 0, z }, LAMP, seed, eyeAt(d)) > 0;
    if (lit) {
      lo = Math.min(lo, z);
      hi = Math.max(hi, z);
    }
  }
  return hi > lo ? hi - lo : 0;
};

describe("a lamp's streak on the wet street (ADR-0084)", () => {
  it("lies where the ground mirrors the lamp to the eye", () => {
    // Mirror point: along / 6 = (20 - along) / 1.7, so along = 20 * 6 / 7.7.
    const mirror = (20 * 6) / 7.7;
    expect(lampStreak({ x: 0, y: 0, z: mirror }, LAMP, 0, eyeAt(20))).toBeGreaterThan(0);
    expect(lampStreak({ x: 0, y: 0, z: 2 }, LAMP, 0, eyeAt(20))).toBe(0);
    expect(lampStreak({ x: 0, y: 0, z: -3 }, LAMP, 0, eyeAt(20))).toBe(0);
  });

  it("is narrow: under 0.6 m across 30 m from the eye, under 0.25 m at 8 m", () => {
    for (const seed of [0, 7, 41, 96]) {
      // 30 m from the eye: a lamp 45 m off seen at its streak's far end.
      expect(widthAt(15, 45, seed)).toBeLessThan(0.6);
      expect(widthAt(12, 20, seed)).toBeLessThan(0.25);
    }
    expect(widthAt((20 * 6) / 7.7, 20)).toBeGreaterThan(0.05);
  });

  it("is long at a grazing view and short looking down", () => {
    const far = lengthOf(40);
    const near = lengthOf(8);
    expect(near).toBeGreaterThan(0.1);
    expect(far).toBeGreaterThan(3 * near);
  });

  it("is broken into flat steps: 1 in its core, 0.5 in its rim, nothing between", () => {
    const seen = new Set<number>();
    for (let z = 15; z < 29; z += 0.05) for (let x = -1; x <= 1; x += 0.01) seen.add(lampStreak({ x, y: 0, z }, LAMP, 3, eyeAt(30)));
    expect([...seen].sort()).toEqual([0, 0.5, 1]);
  });

  it("keeps two lamps 3 m apart as two streaks with dark street between", () => {
    const other = { x: 3, y: 6, z: 0 };
    const eye = { x: 1.5, y: 1.7, z: 30 };
    let rows = 0;
    for (let z = 10; z < 28; z += 0.05) {
      let leftEnd = -Infinity;
      let rightStart = Infinity;
      for (let x = -1; x <= 4; x += 0.01) {
        if (lampStreak({ x, y: 0, z }, LAMP, 1, eye) > 0) leftEnd = Math.max(leftEnd, x);
        if (lampStreak({ x, y: 0, z }, other, 2, eye) > 0) rightStart = Math.min(rightStart, x);
      }
      if (!Number.isFinite(leftEnd) || !Number.isFinite(rightStart)) continue;
      rows++;
      expect(rightStart - leftEnd).toBeGreaterThan(0.02);
    }
    expect(rows).toBeGreaterThan(5);
  });

  it("shows bright in standing water, faint on the wet street, not at all where water never lies", () => {
    expect(streakShows(1, 0.4)).toBe(1);
    expect(streakShows(0.5, 0.4)).toBeLessThan(1);
    expect(streakShows(0, 0.4)).toBeLessThan(0.5);
    expect(streakShows(0, 0)).toBeGreaterThan(0);
    expect(streakShows(0, -1)).toBe(0);
    expect(LAMP_STREAK_GLSL).toContain(`step(-0.5, hold) * ${streakShows(0, 0)}`);
  });

  it("is drawn by the wet ground, which no longer mirrors the probe off its standing water (stray dots of neon)", () => {
    expect(TOON_FRAGMENT).toContain("spec += lampStreaks(vWorldPos, standing, vWater.y);");
    expect(TOON_FRAGMENT).toContain("env *= step(0.25, standing);");
    expect(TOON_FRAGMENT).not.toContain("wetStreaks");
  });
});

describe("the lamps fed to the ground (ADR-0084)", () => {
  const lamp = (x: number, z: number, seed: number): StreakLamp => ({ x, y: 6, z, color: [1, 0.8, 0.5], seed });

  it("are the nearest within reach, those in front of the eye first", () => {
    const lamps = [lamp(0, -5, 0), lamp(0, 10, 1), lamp(0, 20, 2), lamp(0, 80, 3)];
    expect(pickStreakLamps(lamps, { x: 0, z: 0 }, { x: 0, z: 1 }, 2).map((l) => l.seed)).toEqual([1, 2]);
    expect(pickStreakLamps(lamps, { x: 0, z: 0 }, null, 8).map((l) => l.seed)).toEqual([0, 1, 2]);
  });

  it("go dark by day and fill half the slots on a phone", () => {
    const pushed: number[][] = [];
    const wet = { setLampStreaks: (pos: readonly number[]) => pushed.push([...pos]) } as unknown as ToonWetGround;
    const lamps = Array.from({ length: 12 }, (_, i) => lamp(i, 5, i));
    const phone = new LampStreakFeed(wet, "low");
    phone.setLamps(lamps);
    phone.aim({ x: 0, z: 0 }, { x: 0, z: 1 });
    expect(phone.current).toHaveLength(MAX_LAMP_STREAKS / 2);
    expect(pushed.at(-1)).toHaveLength((MAX_LAMP_STREAKS / 2) * 4);
    phone.setNight(0);
    expect(pushed.at(-1)).toEqual([]);
  });
});
