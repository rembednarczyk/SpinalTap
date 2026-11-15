import { describe, expect, it } from "vitest";
import { HUD_SCALE_RANGE } from "../src";
import { COMPACT_ROOM, DESKTOP_ROOM, HIT_CLEARANCE_PX, MIN_HIT_PX, MIN_TOUCH_SCALE, MIN_TOUCH_SPREAD, PAD_PITCH, isCompact, uiScale } from "../src/scale/ui-scale";

const [MIN, MAX] = HUD_SCALE_RANGE;

describe("interface scale (ADR-0085)", () => {
  it("keeps a scale under 1 as it is, on every screen: the pad keeps its layout and is drawn as small", () => {
    for (const screen of [
      { width: 844, height: 390 },
      { width: 667, height: 375 },
      { width: 1280, height: 720 },
      { width: 390, height: 844 },
    ]) {
      expect(uiScale(MIN, screen).ui).toBe(MIN);
      expect(uiScale(MIN, screen, undefined, true)).toEqual({ ui: MIN, touch: MIN_TOUCH_SCALE, touchLook: MIN, touchSpread: 0.92 });
    }
  });

  it("pulls the pad toward its corners as far as the interface shrinks, but never so far that its 44 px targets meet", () => {
    const phone = { width: 844, height: 390 };
    // The tightest pitch of 44 px targets stays 44 px on screen and a little more, for the
    // browser's snapping of hit areas to whole px.
    expect(MIN_TOUCH_SPREAD * PAD_PITCH).toBeCloseTo(MIN_HIT_PX + HIT_CLEARANCE_PX, 6);
    expect(uiScale(0.8, phone, undefined, true).touchSpread).toBe(0.92);
    expect(uiScale(0.9, phone, undefined, true).touchSpread).toBe(0.92);
    expect(uiScale(0.95, phone, undefined, true).touchSpread).toBe(0.95);
    // At 1 and above the pad's groups stay where they were.
    expect(uiScale(1, phone, undefined, true).touchSpread).toBe(1);
    expect(uiScale(1.4, phone, undefined, true).touchSpread).toBe(1);
    expect(uiScale(0.8, { width: 1280, height: 720 }).touchSpread).toBe(1);
  });

  it("grows above 1 only while the layout keeps its room", () => {
    expect(uiScale(MAX, { width: 1920, height: 1080 }).ui).toBe(MAX);
    // 1280x720 holds 1024x600 up to 1.2.
    expect(uiScale(MAX, { width: 1280, height: 720 }).ui).toBe(1.2);
    // The smallest desktop and the smallest phone have no room to spare: they stay at 1.
    expect(uiScale(MAX, { width: DESKTOP_ROOM.width, height: DESKTOP_ROOM.height }).ui).toBe(1);
    expect(uiScale(MAX, { width: COMPACT_ROOM.width, height: 375 }, undefined, true)).toEqual({ ui: 1, touch: 1, touchLook: 1, touchSpread: 1 });
    // A phone held sideways: the compact room, 390 / 370.
    expect(uiScale(MAX, { width: 844, height: 390 }, undefined, true)).toEqual({ ui: 1.054, touch: 1.054, touchLook: 1, touchSpread: 1 });
    // Never under 1 for a setting over it, even on a screen smaller than the room (portrait).
    expect(uiScale(1.2, { width: 390, height: 844 }).ui).toBe(1);
  });

  it("takes the safe area off the room", () => {
    const notch = { top: 0, right: 44, bottom: 21, left: 44 };
    expect(uiScale(MAX, { width: 932, height: 430 }).ui).toBe(1.162);
    expect(uiScale(MAX, { width: 932, height: 430 }, notch).ui).toBe(1.105);
  });

  it("tells the compact layout as the styles' media query does", () => {
    expect(isCompact({ width: 844, height: 390 })).toBe(true);
    expect(isCompact({ width: 390, height: 844 })).toBe(true);
    expect(isCompact({ width: 1024, height: 600 })).toBe(false);
  });

  it("falls back to 1 for a setting that is no number", () => {
    expect(uiScale(Number.NaN, { width: 1920, height: 1080 }).ui).toBe(1);
  });
});
