import { EMPTY_INPUT } from "@seki/core";
import { describe, expect, it } from "vitest";
import { DEFAULT_KEYMAP } from "../src/input/keymap";
import { ShoulderSwitch } from "../src/input/shoulder-switch";

describe("shoulder swap (G-275)", () => {
  it("is on G by default, next to V for the view", () => {
    expect(DEFAULT_KEYMAP.swapShoulder).toEqual(["KeyG"]);
    expect(Object.entries(DEFAULT_KEYMAP).filter(([, codes]) => codes.includes("KeyG")).map(([a]) => a)).toEqual(["swapShoulder"]);
  });

  it("flips the side on the key and writes it into every frame after, telling the settings", () => {
    const s = new ShoulderSwitch();
    const told: boolean[] = [];
    s.onChange = (left) => told.push(left);
    expect(s.apply(EMPTY_INPUT, false, false)).toBe(EMPTY_INPUT);
    expect(s.apply(EMPTY_INPUT, true, false).leftShoulder).toBe(true);
    expect(s.apply({ ...EMPTY_INPUT, fire: true }, false, false)).toMatchObject({ fire: true, leftShoulder: true });
    expect(s.apply(EMPTY_INPUT, true, false).leftShoulder).toBeUndefined();
    expect(told).toEqual([true, false]);
  });

  it("swaps on the pad's left stick click only while aiming: otherwise the click sprints", () => {
    const s = new ShoulderSwitch();
    expect(s.apply({ ...EMPTY_INPUT, sprint: true }, false, true).leftShoulder).toBeUndefined();
    expect(s.apply({ ...EMPTY_INPUT, aim: true, sprint: true }, false, true).leftShoulder).toBe(true);
  });

  it("starts from the side the settings give", () => {
    const s = new ShoulderSwitch();
    s.left = true;
    expect(s.apply(EMPTY_INPUT, false, false).leftShoulder).toBe(true);
  });
});
