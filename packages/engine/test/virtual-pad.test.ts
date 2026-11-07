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

  it("dashes once per press of the dash button (ADR-0036)", () => {
    const pad = new VirtualPad();
    pad.press("dash");
    expect(pad.poll().dash).toBe(true);
    expect(pad.poll().dash).toBe(false);
    pad.release("dash");
    pad.press("dash");
    expect(pad.poll().dash).toBe(true);
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

  it("fires once on a tap that goes down and up between two polls (ADR-0075)", () => {
    const pad = new VirtualPad();
    pad.press("fire");
    pad.release("fire");
    expect(pad.poll().fire).toBe(true);
    expect(pad.poll().fire).toBe(false);
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

  it("jumps once per press of the jump button (ADR-0021)", () => {
    const pad = new VirtualPad();
    pad.press("jump");
    expect(pad.poll().jump).toBe(true);
    expect(pad.poll().jump).toBe(false);
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

describe("virtual pad fire button that aims (ADR-0072)", () => {
  const aimed = (pad: VirtualPad) => pad.withFireAim(pad.poll()).aim;

  it("in \"aims\" mode the held fire button aims too, with a firearm in hand", () => {
    const pad = new VirtualPad();
    pad.adsWeapon = true;
    pad.press("fire");
    expect(pad.poll().aim).toBe(false);
    expect(pad.fireAims).toBe(true);
    expect(pad.withFireAim(pad.poll())).toMatchObject({ fire: true, aim: true });
    pad.release("fire");
    expect(aimed(pad)).toBe(false);
  });

  it("with a melee weapon the fire button only strikes, without the guard", () => {
    const pad = new VirtualPad();
    pad.adsWeapon = false;
    pad.press("fire");
    expect(pad.withFireAim(pad.poll())).toMatchObject({ fire: true, aim: false });
  });

  it("in \"separate\" mode the fire button never aims", () => {
    const pad = new VirtualPad();
    pad.adsWeapon = true;
    pad.touchFire = "separate";
    pad.press("fire");
    expect(pad.withFireAim(pad.poll())).toMatchObject({ fire: true, aim: false });
  });

  it("aims by default, the mode the settings start with", () => {
    expect(new VirtualPad().touchFire).toBe("aims");
  });

  it("lifting every finger ends the fire button's aim", () => {
    const pad = new VirtualPad();
    pad.adsWeapon = true;
    pad.press("fire");
    pad.reset();
    expect(aimed(pad)).toBe(false);
  });
});
