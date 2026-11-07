// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { EMPTY_INPUT } from "@seki/core";
import { BrowserInput, DEFAULT_LOOK_TUNING } from "../src/input/browser-input";

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

  it("swaps the TPP shoulder on G and keeps the side in every frame, menus included (G-275)", () => {
    const i = make();
    const told: boolean[] = [];
    i.shoulder.onChange = (left) => told.push(left);
    expect(i.poll().leftShoulder).toBeUndefined();
    key("keydown", "KeyG");
    expect(i.poll().leftShoulder).toBe(true);
    expect(i.poll().leftShoulder).toBe(true);
    i.enabled = false;
    expect(i.poll()).toEqual({ ...EMPTY_INPUT, leftShoulder: true });
    expect(told).toEqual([true]);
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

  it("fires once on a click shorter than a poll, and a held button keeps firing (ADR-0075)", () => {
    const i = make();
    document.dispatchEvent(new Event("pointerlockerror"));
    window.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
    window.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
    expect(i.poll().fire).toBe(true);
    expect(i.poll().fire).toBe(false);
    window.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
    expect([i.poll().fire, i.poll().fire]).toEqual([true, true]);
    window.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
    expect(i.poll().fire).toBe(false);
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

describe("BrowserInput releasing a lock still in flight (G-306)", () => {
  const lockTo = (el: Element | null) => Object.defineProperty(document, "pointerLockElement", { configurable: true, get: () => el });
  const change = (el: Element | null) => {
    lockTo(el);
    document.dispatchEvent(new Event("pointerlockchange"));
  };
  // The browser grants the lock only when the test says so, as after the loading screen in Chromium.
  const setup = () => {
    const canvas = document.createElement("canvas");
    let asked = 0;
    canvas.requestPointerLock = (() => (asked++, Promise.resolve())) as HTMLCanvasElement["requestPointerLock"];
    let exits = 0;
    document.exitPointerLock = () => {
      exits++;
      change(null);
    };
    input = new BrowserInput(canvas);
    return { i: input, grant: () => change(canvas), exits: () => exits, asked: () => asked, canvas };
  };
  afterEach(() => lockTo(null));

  it("lets go of a lock the browser grants after the release was asked for", () => {
    const { i, grant, exits } = setup();
    i.requestPointerLock();
    i.releasePointerLock();
    grant();
    expect(exits()).toBe(1);
    expect(i.locked).toBe(false);
  });

  it("keeps a lock granted while it is still wanted", () => {
    const { i, grant, exits } = setup();
    i.requestPointerLock();
    grant();
    expect(exits()).toBe(0);
    expect(i.locked).toBe(true);
  });

  it("keeps a lock asked for again after the release", () => {
    const { i, grant, exits } = setup();
    i.requestPointerLock();
    i.releasePointerLock();
    i.requestPointerLock();
    grant();
    expect(exits()).toBe(0);
    expect(i.locked).toBe(true);
  });

  it("does not retry without raw input once the release was asked for", async () => {
    const { i, canvas } = setup();
    let plain = 0;
    canvas.requestPointerLock = ((o?: unknown) => (o ? Promise.reject(new DOMException("raw", "NotSupportedError")) : (plain++, Promise.resolve()))) as HTMLCanvasElement["requestPointerLock"];
    i.requestPointerLock();
    i.releasePointerLock();
    await new Promise((r) => setTimeout(r, 0));
    expect(plain).toBe(0);
  });
});

describe("touch fire button and the aim latch (ADR-0072)", () => {
  const touchInput = (touchFire: "aims" | "separate", aim: "hold" | "toggle") => {
    const i = make();
    i.setButtonModes({ aim, crouch: "hold", sprint: "hold" });
    i.virtualPad.touchFire = touchFire;
    i.virtualPad.adsWeapon = true;
    return i;
  };
  /** A tap on ◎ that lasts one poll, as a finger's tap outlasts a frame. */
  const tapAim = (i: BrowserInput) => {
    i.virtualPad.press("aim");
    i.poll();
    i.virtualPad.release("aim");
  };

  it("A: holding fire aims and fires; letting go ends both", () => {
    const i = touchInput("aims", "hold");
    i.virtualPad.press("fire");
    expect(i.poll()).toMatchObject({ fire: true, aim: true });
    i.virtualPad.release("fire");
    expect(i.poll()).toMatchObject({ fire: false, aim: false });
  });

  it("A with a toggled aim: fire does not flip the latch, and a latched aim outlasts the fire button", () => {
    const i = touchInput("aims", "toggle");
    i.virtualPad.press("fire");
    expect(i.poll().aim).toBe(true);
    i.virtualPad.release("fire");
    expect(i.poll().aim).toBe(false);
    tapAim(i);
    expect(i.poll().aim).toBe(true);
    i.virtualPad.press("fire");
    i.poll();
    i.virtualPad.release("fire");
    expect(i.poll()).toMatchObject({ fire: false, aim: true });
  });

  it("B: a tap on aim latches the sights, fire then only fires and steers, a second tap lets go", () => {
    const i = touchInput("separate", "toggle");
    i.virtualPad.press("fire");
    expect(i.poll()).toMatchObject({ fire: true, aim: false });
    i.virtualPad.release("fire");
    tapAim(i);
    expect(i.poll().aim).toBe(true);
    i.virtualPad.press("fire");
    i.virtualPad.look(0.1, 0);
    expect(i.poll()).toMatchObject({ fire: true, aim: true, lookYaw: 0.1 });
    i.virtualPad.release("fire");
    expect(i.poll().aim).toBe(true);
    i.virtualPad.press("aim");
    expect(i.poll().aim).toBe(false);
  });

  it("B: a tap on aim quicker than a step still latches the sights", () => {
    const i = touchInput("separate", "toggle");
    i.virtualPad.press("aim");
    i.virtualPad.release("aim");
    expect(i.poll().aim).toBe(true);
    expect(i.poll().aim).toBe(true);
    i.virtualPad.press("aim");
    i.virtualPad.release("aim");
    expect(i.poll().aim).toBe(false);
  });

  it("A with a melee weapon: fire strikes without raising the guard", () => {
    const i = touchInput("aims", "hold");
    i.virtualPad.adsWeapon = false;
    i.virtualPad.press("fire");
    expect(i.poll()).toMatchObject({ fire: true, aim: false });
  });
});

describe("the aim assist in the adapter (ADR-0072, stage 3)", () => {
  /** A mouse move the browser reports with movement deltas (jsdom has no `movementX`). */
  const mouseMove = (x: number, y = 0) => {
    const e = new MouseEvent("mousemove");
    Object.defineProperties(e, { movementX: { value: x }, movementY: { value: y } });
    window.dispatchEvent(e);
  };
  /** Mouse look without a lock (the frame refuses it), touch and a target on the crosshair 3° right. */
  const assisted = () => {
    const i = make();
    document.dispatchEvent(new Event("pointerlockerror"));
    i.aimAssist.adsWeapon = true;
    i.aimAssist.targets = [{ yaw: 0.0524, pitch: 0, angle: 0.0524, radius: 0.04, distance: 12 }];
    return i;
  };

  it("slows touch look over a target, after the touch sensitivity, and never the mouse", () => {
    const i = assisted();
    i.setLookTuning({ ...DEFAULT_LOOK_TUNING, touch: 2 });
    const factor = 0.55 + 0.45 * (0.0524 / 0.06);
    i.virtualPad.look(0.01, 0);
    expect(i.poll().lookYaw).toBeCloseTo(0.02 * factor, 9);
    mouseMove(10);
    expect(i.poll().lookYaw).toBeCloseTo(10 * 0.0022, 9);
  });

  it("pulls when touch raises the sights, not when the right mouse button does", () => {
    const touch = assisted();
    touch.virtualPad.press("aim");
    touch.poll();
    expect(touch.aimAssist.pulling).toBe(true);
    touch.dispose();
    const mouse = assisted();
    window.dispatchEvent(new MouseEvent("mousedown", { button: 2 }));
    expect(mouse.poll().aim).toBe(true);
    expect(mouse.aimAssist.pulling).toBe(false);
    window.dispatchEvent(new MouseEvent("mouseup", { button: 2 }));
  });

  it("the fire button that aims pulls too, and a menu drops the pull", () => {
    const i = assisted();
    i.virtualPad.adsWeapon = true;
    i.virtualPad.press("fire");
    expect(i.poll().aim).toBe(true);
    expect(i.aimAssist.pulling).toBe(true);
    i.enabled = false;
    expect(i.aimAssist.pulling).toBe(false);
  });
});
