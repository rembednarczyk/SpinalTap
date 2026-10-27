import { describe, expect, it } from "vitest";
import { EMPTY_INPUT } from "@seki/core";
import { DEFAULT_KEYMAP, PAD_DEADZONE, mapGamepad, mapKeyboardMouse, mergeFrames, remap } from "../src/input/keymap";

const keys = (held: string[], pressed: string[] = []) => ({ held: new Set(held), pressed: new Set(pressed) });

describe("keyboard and mouse mapping", () => {
  it("maps WASD to move axes and cancels opposite keys", () => {
    expect(mapKeyboardMouse(keys(["KeyW", "KeyD"]), { yaw: 0, pitch: 0 })).toMatchObject({ moveZ: 1, moveX: 1 });
    expect(mapKeyboardMouse(keys(["KeyA", "KeyD", "KeyS"]), { yaw: 0, pitch: 0 })).toMatchObject({ moveX: 0, moveZ: -1 });
  });

  it("passes mouse look through and treats interact/camera as edges", () => {
    const f = mapKeyboardMouse(keys(["KeyE", "Mouse0"], ["KeyV"]), { yaw: 0.1, pitch: -0.2 });
    expect(f).toMatchObject({ lookYaw: 0.1, lookPitch: -0.2, fire: true, interact: false, toggleCamera: true });
  });

  it("crouches while C is held", () => {
    expect(mapKeyboardMouse(keys(["KeyC"]), { yaw: 0, pitch: 0 }).crouch).toBe(true);
    expect(mapKeyboardMouse(keys([], ["KeyC"]), { yaw: 0, pitch: 0 }).crouch).toBe(false);
  });

  it("reloads on R and picks weapon slots with 1 to 3 (edges only)", () => {
    expect(mapKeyboardMouse(keys([], ["KeyR"]), { yaw: 0, pitch: 0 }).reload).toBe(true);
    expect(mapKeyboardMouse(keys(["KeyR"]), { yaw: 0, pitch: 0 }).reload).toBe(false);
    expect(mapKeyboardMouse(keys([], ["Digit1"]), { yaw: 0, pitch: 0 }).weaponSlot).toBe(1);
    expect(mapKeyboardMouse(keys([], ["Numpad2"]), { yaw: 0, pitch: 0 }).weaponSlot).toBe(2);
    expect(mapKeyboardMouse(keys([], ["Digit3"]), { yaw: 0, pitch: 0 }).weaponSlot).toBe(3);
    expect(mapKeyboardMouse(keys(["Digit1"]), { yaw: 0, pitch: 0 }).weaponSlot).toBe(0);
  });

  it("supports remapping", () => {
    const map = remap(DEFAULT_KEYMAP, "fire", ["KeyF"]);
    expect(mapKeyboardMouse(keys(["KeyF"]), { yaw: 0, pitch: 0 }, map).fire).toBe(true);
    expect(mapKeyboardMouse(keys(["Mouse0"]), { yaw: 0, pitch: 0 }, map).fire).toBe(false);
  });
});

describe("gamepad mapping", () => {
  const pad = (axes: number[], buttons: boolean[] = [], pressed: boolean[] = []) => ({ axes, buttons, pressed });

  it("applies a deadzone and inverts the forward axis", () => {
    expect(mapGamepad(pad([PAD_DEADZONE / 2, -1, 0, 0]), 1 / 60)).toMatchObject({ moveX: 0, moveZ: 1 });
  });

  it("scales look by dt and maps buttons", () => {
    const buttons: boolean[] = [];
    buttons[7] = true;
    const pressed: boolean[] = [true, false, false, true];
    const f = mapGamepad(pad([0, 0, 1, 0], buttons, pressed), 0.5);
    expect(f.lookYaw).toBeCloseTo(1.4);
    expect(f).toMatchObject({ fire: true, interact: true, toggleCamera: true, sprint: false });
  });

  it("crouches while B is held", () => {
    const buttons: boolean[] = [];
    buttons[1] = true;
    expect(mapGamepad(pad([0, 0, 0, 0], buttons), 1 / 60).crouch).toBe(true);
    expect(mapGamepad(pad([0, 0, 0, 0]), 1 / 60).crouch).toBe(false);
    expect(mergeFrames(EMPTY_INPUT, { ...EMPTY_INPUT, crouch: true }).crouch).toBe(true);
  });

  it("reloads on d-pad down and picks slots with the other d-pad directions", () => {
    const at = (i: number) => {
      const pressed: boolean[] = [];
      pressed[i] = true;
      return mapGamepad(pad([0, 0, 0, 0], [], pressed), 1 / 60);
    };
    expect(at(13).reload).toBe(true);
    expect(at(14).weaponSlot).toBe(1);
    expect(at(12).weaponSlot).toBe(2);
    expect(at(15).weaponSlot).toBe(3);
    expect(mapGamepad(pad([0, 0, 0, 0]), 1 / 60)).toMatchObject({ reload: false, weaponSlot: 0 });
  });

  it("merges devices", () => {
    const f = mergeFrames({ ...EMPTY_INPUT, moveX: 1, fire: true }, { ...EMPTY_INPUT, moveX: 1, lookYaw: 0.2, reload: true, weaponSlot: 3 });
    expect(f).toMatchObject({ moveX: 1, fire: true, lookYaw: 0.2, reload: true, weaponSlot: 3 });
    expect(mergeFrames({ ...EMPTY_INPUT, weaponSlot: 1 }, { ...EMPTY_INPUT, weaponSlot: 2 }).weaponSlot).toBe(1);
  });
});
