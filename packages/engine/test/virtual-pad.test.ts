import { describe, expect, it } from "vitest";
import { STICK_SPRINT_THRESHOLD, VirtualPad } from "../src/input/virtual-pad";

describe("VirtualPad", () => {
  it("maps the stick to move axes and clamps it to the unit circle", () => {
    const pad = new VirtualPad();
    pad.setStick(3, 4);
    const f = pad.poll();
    expect(f.moveX).toBeCloseTo(0.6);
    expect(f.moveZ).toBeCloseTo(0.8);
    expect(f.sprint).toBe(true);
  });

  it("sprints only near full deflection", () => {
    const pad = new VirtualPad();
    pad.setStick(0, STICK_SPRINT_THRESHOLD - 0.05);
    expect(pad.poll().sprint).toBe(false);
  });

  it("crouches while the crouch button is latched and stands on release", () => {
    const pad = new VirtualPad();
    pad.press("crouch");
    expect(pad.poll().crouch).toBe(true);
    expect(pad.poll().crouch).toBe(true);
    pad.release("crouch");
    expect(pad.poll().crouch).toBe(false);
    pad.press("crouch");
    pad.reset();
    expect(pad.poll().crouch).toBe(false);
  });

  it("accumulates look between polls and consumes it", () => {
    const pad = new VirtualPad();
    pad.look(0.1, 0.02);
    pad.look(0.1, 0.02);
    expect(pad.poll()).toMatchObject({ lookYaw: 0.2, lookPitch: 0.04 });
    expect(pad.poll()).toMatchObject({ lookYaw: 0, lookPitch: 0 });
  });

  it("holds fire while pressed and fires edges once", () => {
    const pad = new VirtualPad();
    pad.press("fire");
    pad.press("interact");
    expect(pad.poll()).toMatchObject({ fire: true, interact: true });
    pad.press("interact");
    expect(pad.poll()).toMatchObject({ fire: true, interact: false });
    pad.release("fire");
    pad.release("interact");
    pad.press("ability");
    pad.press("useItem");
    pad.press("toggleCamera");
    expect(pad.poll()).toMatchObject({ fire: false, ability: true, useItem: true, toggleCamera: true });
  });

  it("reloads on the R button edge and passes a tapped weapon slot once", () => {
    const pad = new VirtualPad();
    pad.press("reload");
    pad.selectWeaponSlot(3);
    expect(pad.poll()).toMatchObject({ reload: true, weaponSlot: 3 });
    expect(pad.poll()).toMatchObject({ reload: false, weaponSlot: 0 });
  });

  it("reset lifts every finger", () => {
    const pad = new VirtualPad();
    pad.setStick(0, 1);
    pad.press("fire");
    pad.look(1, 1);
    pad.reset();
    expect(pad.poll()).toMatchObject({ moveZ: 0, fire: false, lookYaw: 0 });
  });
});

describe("virtual pad aim button (ADR-0019)", () => {
  it("aims while the aim button is held", () => {
    const pad = new VirtualPad();
    pad.press("aim");
    expect(pad.poll().aim).toBe(true);
    pad.release("aim");
    expect(pad.poll().aim).toBe(false);
  });
});
