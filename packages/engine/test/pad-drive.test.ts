import { describe, expect, it } from "vitest";
import { EMPTY_INPUT } from "@seki/core";
import { mapGamepad, mergeFrames } from "../src/input/keymap";

/** The pad at the wheel (ADR-0097 §4): the triggers drive, the stick steers, A is the handbrake. */
const pad = (over: { axes?: number[]; buttons?: boolean[]; triggers?: readonly [number, number] }) => ({
  axes: over.axes ?? [0, 0, 0, 0],
  buttons: over.buttons ?? Array.from({ length: 17 }, () => false),
  pressed: Array.from({ length: 17 }, () => false),
  ...(over.triggers ? { triggers: over.triggers } : {}),
});

describe("the pad's driving axes (ADR-0097)", () => {
  it("gives the triggers' travel as throttle and brake, the stick as the steer to the left, A as the handbrake", () => {
    const buttons = Array.from({ length: 17 }, (_, i) => i === 0);
    const f = mapGamepad(pad({ axes: [-0.9, 0, 0, 0], buttons, triggers: [0.3, 0.8] }), 1 / 60);
    expect(f.drive).toBeDefined();
    expect(f.drive!.throttle).toBeCloseTo(0.8, 6);
    expect(f.drive!.brake).toBeCloseTo(0.3, 6);
    expect(f.drive!.steer).toBeGreaterThan(0.8);
    expect(f.drive!.handbrake).toBe(true);
  });

  it("gives none with the triggers let go (the movement axes drive then), and keeps it through the merge with the keyboard", () => {
    expect(mapGamepad(pad({ triggers: [0.02, 0] }), 1 / 60).drive).toBeUndefined();
    const f = mapGamepad(pad({ triggers: [0, 1] }), 1 / 60);
    expect(mergeFrames(EMPTY_INPUT, f).drive?.throttle).toBe(1);
    expect(mergeFrames(f, EMPTY_INPUT).drive?.throttle).toBe(1);
  });
});
