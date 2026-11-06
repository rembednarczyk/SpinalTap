import { describe, expect, it } from "vitest";
import { DEFAULT_PAD_TUNING, PAD_CURVE_EXPONENT, PAD_DEADZONE, PAD_LOOK_SPEED, PAD_OUTER_DEADZONE, type PadCurve, type PadTuning, mapGamepad, shapeStick } from "../src/input/keymap";

/** The pad's sticks (ADR-0072, stage 4): radial dead zone, response curve, own sensitivity. */
const DT = 1 / 60;
const sticks = (lx: number, ly: number, rx = 0, ry = 0) => ({ axes: [lx, ly, rx, ry], buttons: [], pressed: [] });
const look = (rx: number, ry: number, tuning: Partial<PadTuning> = {}) => mapGamepad(sticks(0, 0, rx, ry), DT, { ...DEFAULT_PAD_TUNING, ...tuning });
const travel = (length: number, deadzone = PAD_DEADZONE) => Math.min(1, (length - deadzone) / (PAD_OUTER_DEADZONE - deadzone));

describe("radial dead zone of the pad sticks (ADR-0072)", () => {
  it("is 0.12 by default and swallows small deflections whatever their direction", () => {
    expect(PAD_DEADZONE).toBe(0.12);
    expect(DEFAULT_PAD_TUNING).toEqual({ deadzone: 0.12, curve: "classic", sensitivity: 1 });
    expect(shapeStick(0.1, 0, PAD_DEADZONE)).toEqual({ x: 0, y: 0 });
    // 0.08/0.08 is 0.113 long: inside the circle, though a 0.16 axis zone would cut it too.
    expect(look(0.08, 0.08)).toMatchObject({ lookYaw: 0, lookPitch: 0 });
    expect(mapGamepad(sticks(0.08, -0.08), DT)).toMatchObject({ moveX: 0 });
  });

  it("a 0.1/0.1 diagonal, 0.141 long, leaves the circle as a small diagonal (the axis zone of 0.16 ate it)", () => {
    const s = shapeStick(0.1, 0.1, PAD_DEADZONE);
    expect(s.x).toBeGreaterThan(0);
    expect(s.x).toBeCloseTo(s.y, 12);
    expect(Math.hypot(s.x, s.y)).toBeCloseTo(travel(Math.hypot(0.1, 0.1)), 12);
    expect(Math.hypot(s.x, s.y)).toBeLessThan(0.03);
  });

  it("0.3/0.3 keeps the diagonal and its length, and an uneven push keeps its direction (no snap to an axis)", () => {
    const s = shapeStick(0.3, 0.3, PAD_DEADZONE);
    expect(s.x).toBeCloseTo(s.y, 12);
    expect(Math.hypot(s.x, s.y)).toBeCloseTo(travel(Math.hypot(0.3, 0.3)), 12);
    // 0.3/0.1: an axis zone of 0.16 dropped the 0.1 and snapped the stick to the X axis.
    const uneven = shapeStick(0.3, 0.1, PAD_DEADZONE);
    expect(uneven.y).toBeGreaterThan(0);
    expect(uneven.y / uneven.x).toBeCloseTo(1 / 3, 12);
    const f = look(0.3, 0.1, { curve: "linear" });
    expect(f.lookPitch / f.lookYaw).toBeCloseTo(1 / 3, 12);
    const move = mapGamepad(sticks(0.3, -0.1), DT);
    expect(move.moveZ / move.moveX).toBeCloseTo(1 / 3, 12);
  });

  it("past the outer zone of 0.95 the stick is full travel", () => {
    expect(look(0.96, 0, { curve: "precise" }).lookYaw).toBeCloseTo(PAD_LOOK_SPEED * DT, 12);
    expect(mapGamepad(sticks(0, -0.97), DT).moveZ).toBeCloseTo(1, 12);
  });

  it("follows the dead zone setting", () => {
    expect(look(0.2, 0, { deadzone: 0.25 }).lookYaw).toBe(0);
    expect(look(0.2, 0, { deadzone: 0.05, curve: "linear" }).lookYaw).toBeCloseTo(travel(0.2, 0.05) * PAD_LOOK_SPEED * DT, 12);
  });
});

describe("look response curve and the pad's own sensitivity (ADR-0072)", () => {
  it.each([
    ["linear", 1],
    ["classic", 1.8],
    ["precise", 2.6],
  ] as const)("%s turns at the travel to the power %s, in the stick's direction", (curve: PadCurve, exponent) => {
    expect(PAD_CURVE_EXPONENT[curve]).toBe(exponent);
    for (const x of [0.2, 0.5, 0.8]) {
      const expected = travel(x) ** exponent * PAD_LOOK_SPEED * DT;
      expect(look(x, 0, { curve }).lookYaw).toBeCloseTo(expected, 12);
      expect(look(-x, 0, { curve }).lookYaw).toBeCloseTo(-expected, 12);
      expect(look(0, x, { curve }).lookPitch).toBeCloseTo(expected, 12);
    }
  });

  it("a steeper curve turns slower for small pushes and the same at full travel", () => {
    expect(look(0.4, 0, { curve: "classic" }).lookYaw).toBeLessThan(look(0.4, 0, { curve: "linear" }).lookYaw);
    expect(look(0.4, 0, { curve: "precise" }).lookYaw).toBeLessThan(look(0.4, 0, { curve: "classic" }).lookYaw);
    expect(look(1, 0, { curve: "precise" }).lookYaw).toBeCloseTo(look(1, 0, { curve: "linear" }).lookYaw, 12);
  });

  it("the curve bends the look only, never the walk", () => {
    expect(mapGamepad(sticks(0.5, 0), DT, { ...DEFAULT_PAD_TUNING, curve: "precise" }).moveX).toBeCloseTo(travel(0.5), 12);
  });

  it("sensitivity multiplies the look and leaves the walk alone", () => {
    const base = look(0.6, 0.3);
    const fast = look(0.6, 0.3, { sensitivity: 2.5 });
    expect(fast.lookYaw).toBeCloseTo(base.lookYaw * 2.5, 12);
    expect(fast.lookPitch).toBeCloseTo(base.lookPitch * 2.5, 12);
    expect(mapGamepad(sticks(0.6, 0), DT, { ...DEFAULT_PAD_TUNING, sensitivity: 2.5 }).moveX).toBeCloseTo(travel(0.6), 12);
  });
});
