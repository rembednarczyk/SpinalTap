import { describe, expect, it } from "vitest";
import { EMPTY_INPUT } from "@seki/core";
import { AimLatch, DEFAULT_KEYMAP, DOUBLE_TAP_SECONDS, DoubleTap, InputLatches, PAD_DEADZONE, mapGamepad, mapKeyboardMouse, mergeFrames, remap } from "../src/input/keymap";

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

  it("jumps on the Space edge (ADR-0021)", () => {
    expect(mapKeyboardMouse(keys(["Space"], ["Space"]), { yaw: 0, pitch: 0 }).jump).toBe(true);
    expect(mapKeyboardMouse(keys(["Space"]), { yaw: 0, pitch: 0 }).jump).toBe(false);
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

  it("holds the scanner on Z or the middle button; there the number keys pick quickhacks (ADR-0028)", () => {
    const look = { yaw: 0, pitch: 0 };
    expect(mapKeyboardMouse(keys(["Mouse1"]), look)).toMatchObject({ scan: true, quickhack: 0 });
    expect(mapKeyboardMouse(keys(["KeyZ", "Digit2"], ["Digit2"]), look)).toMatchObject({ scan: true, quickhack: 2, weaponSlot: 0 });
    expect(mapKeyboardMouse(keys(["KeyZ", "Digit5"], ["Digit5"]), look)).toMatchObject({ quickhack: 5 });
    expect(mapKeyboardMouse(keys(["Digit2"], ["Digit2"]), look)).toMatchObject({ scan: false, quickhack: 0, weaponSlot: 2 });
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
    const pressed: boolean[] = [false, false, true, false, false, false, false, false, true];
    const f = mapGamepad(pad([0, 0, 1, 0], buttons, pressed), 0.5);
    expect(f.lookYaw).toBeCloseTo(1.4);
    expect(f).toMatchObject({ fire: true, interact: true, toggleCamera: true, sprint: false, jump: false });
  });

  it("jumps on A, heals on Y (ADR-0021)", () => {
    expect(mapGamepad(pad([0, 0, 0, 0], [], [true]), 1 / 60)).toMatchObject({ jump: true, interact: false });
    expect(mapGamepad(pad([0, 0, 0, 0], [], [false, false, false, true]), 1 / 60)).toMatchObject({ useItem: true, toggleCamera: false });
    expect(mergeFrames(EMPTY_INPUT, { ...EMPTY_INPUT, jump: true }).jump).toBe(true);
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

describe("aim button (ADR-0019)", () => {
  it("aims while the right mouse button or the left trigger is held", () => {
    expect(mapKeyboardMouse(keys(["Mouse2"]), { yaw: 0, pitch: 0 }).aim).toBe(true);
    expect(mapKeyboardMouse(keys(["Mouse0"]), { yaw: 0, pitch: 0 }).aim).toBe(false);
    const buttons: boolean[] = [];
    buttons[6] = true;
    expect(mapGamepad({ axes: [0, 0, 0, 0], buttons, pressed: [] }, 1 / 60).aim).toBe(true);
    expect(mergeFrames(EMPTY_INPUT, { ...EMPTY_INPUT, aim: true }).aim).toBe(true);
  });

  it("passes the button through in hold mode", () => {
    const latch = new AimLatch();
    expect(latch.apply({ ...EMPTY_INPUT, aim: true }).aim).toBe(true);
    expect(latch.apply(EMPTY_INPUT).aim).toBe(false);
  });

  it("flips the aim on each press in toggle mode and forgets it on reset", () => {
    const latch = new AimLatch();
    latch.mode = "toggle";
    const down = { ...EMPTY_INPUT, aim: true };
    expect(latch.apply(down).aim).toBe(true);
    expect(latch.apply(down).aim).toBe(true);
    expect(latch.apply(EMPTY_INPUT).aim).toBe(true);
    expect(latch.apply(down).aim).toBe(false);
    expect(latch.apply(EMPTY_INPUT).aim).toBe(false);
    latch.apply(down);
    latch.reset();
    expect(latch.apply(EMPTY_INPUT).aim).toBe(false);
  });
});

describe("PC controls (wheel, F, hold or toggle)", () => {
  const keys = (held: string[], pressed: string[] = []) => ({ held: new Set(held), pressed: new Set(pressed) });
  const still = { yaw: 0, pitch: 0 };

  it("turns wheel notches into weapon cycling and F into interact", () => {
    expect(mapKeyboardMouse(keys([], ["WheelDown"]), still).weaponCycle).toBe(1);
    expect(mapKeyboardMouse(keys([], ["WheelUp"]), still).weaponCycle).toBe(-1);
    expect(mapKeyboardMouse(keys([]), still).weaponCycle).toBe(0);
    expect(mapKeyboardMouse(keys([], ["KeyF"]), still).interact).toBe(true);
    expect(mergeFrames({ ...EMPTY_INPUT, weaponCycle: -1 }, EMPTY_INPUT).weaponCycle).toBe(-1);
  });

  it("toggles crouch with a press and drops it on a sprint or a jump", () => {
    const l = new InputLatches();
    l.setModes({ aim: "hold", crouch: "toggle", sprint: "hold" });
    expect(l.apply({ ...EMPTY_INPUT, crouch: true }).crouch).toBe(true);
    expect(l.apply(EMPTY_INPUT).crouch).toBe(true);
    expect(l.apply({ ...EMPTY_INPUT, crouch: true }).crouch).toBe(false);
    l.apply({ ...EMPTY_INPUT, crouch: false });
    l.apply({ ...EMPTY_INPUT, crouch: true });
    expect(l.apply(EMPTY_INPUT).crouch).toBe(true);
    expect(l.apply({ ...EMPTY_INPUT, jump: true }).crouch).toBe(false);
    expect(l.apply(EMPTY_INPUT).crouch).toBe(false);
  });

  it("toggles sprint until the player stops moving forward or aims", () => {
    const l = new InputLatches();
    l.setModes({ aim: "hold", crouch: "hold", sprint: "toggle" });
    const run = { ...EMPTY_INPUT, moveZ: 1 };
    expect(l.apply({ ...run, sprint: true }).sprint).toBe(true);
    expect(l.apply(run).sprint).toBe(true);
    expect(l.apply(EMPTY_INPUT).sprint).toBe(false);
    expect(l.apply(run).sprint).toBe(false);
    l.apply({ ...run, sprint: true });
    expect(l.apply({ ...run, aim: true }).sprint).toBe(false);
    // Hold mode passes the key through.
    l.setModes({ aim: "hold", crouch: "hold", sprint: "hold" });
    expect(l.apply({ ...run, sprint: true }).sprint).toBe(true);
    expect(l.apply(run).sprint).toBe(false);
  });
});

describe("dash on the pad (ADR-0036)", () => {
  it("dashes on a double tap of B within the window, not on a single or a slow pair", () => {
    const tap = new DoubleTap();
    expect(tap.update(true, 0)).toBe(false);
    expect(tap.update(false, DOUBLE_TAP_SECONDS / 2)).toBe(false);
    expect(tap.update(true, 0.01)).toBe(true);
    // A third tap starts a new pair.
    expect(tap.update(true, 0.05)).toBe(false);
    expect(tap.update(false, DOUBLE_TAP_SECONDS + 0.05)).toBe(false);
    expect(tap.update(true, 0)).toBe(false);
    tap.reset();
    expect(tap.update(true, 0.01)).toBe(false);
  });

  it("passes the detected dash through the pad mapping", () => {
    expect(mapGamepad({ axes: [0, 0, 0, 0], buttons: [], pressed: [], dash: true }, 1 / 60).dash).toBe(true);
    expect(mapGamepad({ axes: [0, 0, 0, 0], buttons: [], pressed: [] }, 1 / 60).dash).toBe(false);
  });

  it("dashes on left Alt on the keyboard", () => {
    expect(mapKeyboardMouse(keys(["AltLeft"], ["AltLeft"]), { yaw: 0, pitch: 0 }).dash).toBe(true);
    expect(mapKeyboardMouse(keys(["AltLeft"]), { yaw: 0, pitch: 0 }).dash).toBe(false);
  });
});
