// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { EMPTY_INPUT } from "@seki/core";
import { BrowserInput } from "../src/input/browser-input";

const key = (type: "keydown" | "keyup", code: string, repeat = false) =>
  window.dispatchEvent(new KeyboardEvent(type, { code, repeat }));

let input: BrowserInput | null = null;
afterEach(() => input?.dispose());

const make = () => {
  input = new BrowserInput(document.createElement("canvas"));
  input.enabled = true;
  return input;
};

describe("BrowserInput (InputPort contract)", () => {
  it("returns an empty frame while disabled", () => {
    const i = make();
    i.enabled = false;
    key("keydown", "KeyW");
    expect(i.poll()).toEqual(EMPTY_INPUT);
  });

  it("maps held keys and reports interact only on the first poll after the press", () => {
    const i = make();
    key("keydown", "KeyW");
    key("keydown", "KeyE");
    expect(i.poll()).toMatchObject({ moveZ: 1, interact: true });
    expect(i.poll()).toMatchObject({ moveZ: 1, interact: false });
    key("keyup", "KeyW");
    expect(i.poll().moveZ).toBe(0);
  });

  it("ignores key auto-repeat for edges", () => {
    const i = make();
    key("keydown", "KeyV");
    i.poll();
    key("keydown", "KeyV", true);
    expect(i.poll().toggleCamera).toBe(false);
  });

  it("drops a buffered press when re-enabled, so closing a dialogue with E does not reopen it", () => {
    const i = make();
    i.enabled = false;
    key("keydown", "KeyE");
    i.enabled = true;
    expect(i.poll().interact).toBe(false);
  });

  it("ignores mouse buttons and movement without pointer lock", () => {
    const i = make();
    window.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
    expect(i.poll().fire).toBe(false);
  });

  it("releases held keys when the window loses focus", () => {
    const i = make();
    key("keydown", "KeyD");
    window.dispatchEvent(new Event("blur"));
    expect(i.poll().moveX).toBe(0);
  });
});

describe("BrowserInput without pointer lock", () => {
  it("falls back to plain mouse look and fire when the frame refuses the lock", () => {
    const i = make();
    document.dispatchEvent(new Event("pointerlockerror"));
    window.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
    const f = i.poll();
    expect(f.fire).toBe(true);
    expect(i.mouseActive).toBe(true);
  });
});

describe("BrowserInput with the touch pad", () => {
  it("merges the virtual pad into the polled frame, edges and look included", () => {
    const i = make();
    i.virtualPad.setStick(0, 1);
    i.virtualPad.press("fire");
    i.virtualPad.press("interact");
    i.virtualPad.look(0.3, -0.1);
    expect(i.poll()).toMatchObject({ moveZ: 1, fire: true, interact: true, lookYaw: 0.3, lookPitch: -0.1 });
    expect(i.poll()).toMatchObject({ interact: false, lookYaw: 0 });
  });

  it("ignores the mouse events browsers emulate right after a touch", () => {
    const i = make();
    document.dispatchEvent(new Event("pointerlockerror"));
    window.dispatchEvent(new Event("touchstart"));
    window.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
    expect(i.poll().fire).toBe(false);
  });

  it("drops touch edges while disabled", () => {
    const i = make();
    i.enabled = false;
    i.virtualPad.press("interact");
    i.enabled = true;
    expect(i.poll().interact).toBe(false);
  });
});

describe("BrowserInput entering pointer lock (G-046)", () => {
  const lockTo = (el: Element | null) => Object.defineProperty(document, "pointerLockElement", { configurable: true, get: () => el });
  const move = (dx: number, dy = 0) => {
    const e = new MouseEvent("mousemove");
    Object.defineProperties(e, { movementX: { value: dx }, movementY: { value: dy } });
    window.dispatchEvent(e);
  };
  afterEach(() => lockTo(null));

  it("does not turn the view with the jump Chromium reports as the first move under a new lock", () => {
    const canvas = document.createElement("canvas");
    input = new BrowserInput(canvas);
    input.enabled = true;
    // The cursor rests on the New Game button at (640, 274); the lock comes in after the click.
    move(640, 274);
    lockTo(canvas);
    move(-640, -274);
    expect(input.poll()).toMatchObject({ lookYaw: 0, lookPitch: 0 });
    // The mouse turns the view again from the next move on.
    move(10);
    expect(input.poll().lookYaw).toBeCloseTo(0.022);
  });

  it("keeps the lock available when only the raw-input option is refused (G-139)", async () => {
    const canvas = document.createElement("canvas");
    // Chromium on Linux refuses `unadjustedMovement` and sends pointerlockerror for it; the
    // plain request that follows takes the lock.
    canvas.requestPointerLock = ((options?: { unadjustedMovement?: boolean }) =>
      options?.unadjustedMovement ? Promise.reject(new Error("NotSupportedError")) : Promise.resolve()) as HTMLCanvasElement["requestPointerLock"];
    input = new BrowserInput(canvas);
    input.enabled = true;
    move(640, 274);
    input.requestPointerLock();
    await Promise.resolve();
    document.dispatchEvent(new Event("pointerlockerror"));
    expect(input.mouseActive).toBe(false);
    // The jump into the lock before pointerLockElement is set is no turn of the view.
    move(-640, -274);
    lockTo(canvas);
    expect(input.poll()).toMatchObject({ lookYaw: 0, lookPitch: 0 });
  });

  it("keeps the lock available when it is refused only for want of a gesture (G-135)", async () => {
    const canvas = document.createElement("canvas");
    // A panel closed with Esc before the first click: Chromium refuses both requests as NotAllowedError.
    const noGesture = () => Promise.reject(new DOMException("no user activation", "NotAllowedError"));
    canvas.requestPointerLock = noGesture as HTMLCanvasElement["requestPointerLock"];
    input = new BrowserInput(canvas);
    input.requestPointerLock();
    await new Promise((r) => setTimeout(r, 0));
    document.dispatchEvent(new Event("pointerlockerror"));
    expect(input.mouseActive).toBe(false);
    // The next click asks again and takes the lock.
    let asked = 0;
    canvas.requestPointerLock = (() => (asked++, Promise.resolve())) as HTMLCanvasElement["requestPointerLock"];
    input.requestPointerLock();
    expect(asked).toBe(1);
  });

  it("falls back to plain mouse look when the plain request is refused as well", async () => {
    const canvas = document.createElement("canvas");
    canvas.requestPointerLock = (() => Promise.reject(new Error("SecurityError"))) as HTMLCanvasElement["requestPointerLock"];
    input = new BrowserInput(canvas);
    input.requestPointerLock();
    await new Promise((r) => setTimeout(r, 0));
    expect(input.mouseActive).toBe(true);
  });
});
