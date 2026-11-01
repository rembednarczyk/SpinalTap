import { EMPTY_INPUT, type InputFrame, type InputPort } from "@seki/core";
import { type ButtonMode, DEFAULT_KEYMAP, DoubleTap, InputLatches, type KeyMap, mapGamepad, mapKeyboardMouse, mergeFrames } from "./keymap";
import { VirtualPad } from "./virtual-pad";

const MOUSE_SENSITIVITY = 0.0022;
/** Wheel travel (pixels) per weapon change: one notch of a regular mouse wheel. */
const WHEEL_NOTCH = 50;
/** Browsers emulate mouse events after a touch; ignore them for this long. */
const TOUCH_MOUSE_GUARD_MS = 800;

/**
 * InputPort for the browser: keyboard, mouse (pointer lock) and the first standard gamepad.
 * Mouse deltas and button edges accumulate between polls and are consumed by poll().
 */
export class BrowserInput implements InputPort {
  keymap: KeyMap = DEFAULT_KEYMAP;
  /** On-screen touch gamepad; merged with keyboard, mouse and physical pads. */
  readonly virtualPad = new VirtualPad();
  private lastTouchAt = -Infinity;
  private active = false;
  /** Set when pointer lock is refused (some embedded frames): mouse look then works on plain movement. */
  private lockUnavailable = false;
  /**
   * The browser answers a lock request with a promise, so the outcome comes from it and not from
   * pointerlockerror: Chromium also sends that for the refused raw-input option, before the plain
   * retry takes the lock (G-139).
   */
  private lockByPromise = false;
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  /** Whether the pointer was locked at the last mouse move. */
  private movedLocked = false;
  private padPrev: boolean[] = [];
  /** B tapped twice dashes (ADR-0036). */
  private readonly padDash = new DoubleTap();
  private lastPoll: number | null = null;
  private readonly disposers: (() => void)[] = [];
  private readonly latches = new InputLatches();
  private modes: { aim: ButtonMode; crouch: ButtonMode; sprint: ButtonMode } = { aim: "hold", crouch: "hold", sprint: "hold" };
  /** Wheel travel not yet turned into a notch (trackpads send many small deltas). */
  private wheel = 0;

  constructor(private readonly target: HTMLElement) {
    const on = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void) => {
      window.addEventListener(type, fn);
      this.disposers.push(() => window.removeEventListener(type, fn));
    };
    on("keydown", (e) => {
      // Space jumps and Alt dashes in play: neither may scroll the page, press a focused button
      // or open the browser's menu bar.
      if (this.active && (e.code === "Space" || e.code === "AltLeft")) e.preventDefault();
      if (e.repeat) return;
      this.held.add(e.code);
      this.pressed.add(e.code);
    });
    on("keyup", (e) => this.held.delete(e.code));
    on("blur", () => this.held.clear());
    const onLockError = () => {
      if (!this.lockByPromise) this.lockUnavailable = true;
    };
    document.addEventListener("pointerlockerror", onLockError);
    this.disposers.push(() => document.removeEventListener("pointerlockerror", onLockError));
    on("touchstart", () => {
      this.lastTouchAt = performance.now();
    });
    on("mousedown", (e) => {
      if (!this.mouseActive || this.touchEmulated()) return;
      this.held.add(`Mouse${e.button}`);
      this.pressed.add(`Mouse${e.button}`);
    });
    on("mouseup", (e) => this.held.delete(`Mouse${e.button}`));
    // The right button aims; keep the browser's context menu away from the game canvas.
    const noMenu = (e: Event) => e.preventDefault();
    target.addEventListener("contextmenu", noMenu);
    this.disposers.push(() => target.removeEventListener("contextmenu", noMenu));
    // The wheel changes weapons; one notch per WHEEL_NOTCH of travel, and no page scroll in play.
    const onWheel = (e: WheelEvent) => {
      if (!this.active || !this.mouseActive) return;
      e.preventDefault();
      this.wheel += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      if (Math.abs(this.wheel) < WHEEL_NOTCH) return;
      this.pressed.add(this.wheel > 0 ? "WheelDown" : "WheelUp");
      this.wheel = 0;
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    this.disposers.push(() => window.removeEventListener("wheel", onWheel));
    on("mousemove", (e) => {
      // Chromium reports the move into pointer lock as one jump by minus the cursor's position
      // (half the screen from a centred button): not a turn of the view (G-046). It can come before pointerlockchange, so the lock is compared move to move.
      const locked = this.locked;
      const lockChanged = locked !== this.movedLocked;
      this.movedLocked = locked;
      if (lockChanged || !this.mouseActive || this.touchEmulated()) return;
      this.yaw += e.movementX * MOUSE_SENSITIVITY;
      this.pitch += e.movementY * MOUSE_SENSITIVITY;
    });
  }

  /** "hold" (default) or "toggle" for the aim button, from the settings (ADR-0019). */
  get aimMode(): ButtonMode {
    return this.modes.aim;
  }

  set aimMode(mode: ButtonMode) {
    this.setButtonModes({ ...this.modes, aim: mode });
  }

  /** Hold or toggle for aim, crouch and sprint, from the control settings. */
  setButtonModes(modes: { aim: ButtonMode; crouch: ButtonMode; sprint: ButtonMode }): void {
    this.modes = modes;
    this.latches.setModes(modes);
  }

  /** When false (menus, dialogue) poll() returns an empty frame. */
  get enabled(): boolean {
    return this.active;
  }

  /**
   * Toggling drops buffered edges and mouse deltas, so the key that closed a menu or a
   * dialogue (e.g. E) does not leak into the first gameplay frame and reopen it.
   */
  set enabled(value: boolean) {
    if (value !== this.active) {
      this.clearBuffered();
      this.latches.reset();
    }
    this.active = value;
  }

  get locked(): boolean {
    return document.pointerLockElement === this.target;
  }

  /** Mouse drives look and fire when locked, or always when the frame refuses pointer lock. */
  get mouseActive(): boolean {
    return this.locked || this.lockUnavailable;
  }

  requestPointerLock(): void {
    if (this.locked) return;
    try {
      // Some browsers return a promise that rejects when the request is refused.
      // Raw mouse input (no OS acceleration) where the browser offers it, like PC games read it.
      const r = (this.target.requestPointerLock as (o?: { unadjustedMovement?: boolean }) => unknown).call(this.target, { unadjustedMovement: true });
      if (r instanceof Promise) {
        this.lockByPromise = true;
        r.catch(() => {
          // Refused with the option (older Chromium, Linux without raw input): try without it.
          try {
            const plain = this.target.requestPointerLock() as unknown;
            // Refused for want of a user gesture (a panel closed with Esc before the first click,
            // G-135): the next click asks again, so the lock stays available.
            if (plain instanceof Promise) plain.catch((e: unknown) => (this.lockUnavailable = !isNoGesture(e)));
          } catch {
            this.lockUnavailable = true;
          }
        });
      }
    } catch {
      this.lockUnavailable = true;
    }
  }

  releasePointerLock(): void {
    if (this.locked) document.exitPointerLock();
  }

  poll(): InputFrame {
    const now = performance.now();
    const dt = this.lastPoll === null ? 0 : Math.min(0.1, (now - this.lastPoll) / 1000);
    this.lastPoll = now;
    if (!this.active) {
      this.clearBuffered();
      return EMPTY_INPUT;
    }
    const km = mapKeyboardMouse({ held: this.held, pressed: this.pressed }, { yaw: this.yaw, pitch: this.pitch }, this.keymap);
    this.clearDeviceBuffers();
    // The pad consumes its own edges and look deltas while polling.
    const withTouch = mergeFrames(km, this.virtualPad.poll());
    const pad = this.pollPad(dt);
    return this.latches.apply(pad ? mergeFrames(withTouch, pad) : withTouch);
  }

  dispose(): void {
    for (const d of this.disposers) d();
  }

  private touchEmulated(): boolean {
    return performance.now() - this.lastTouchAt < TOUCH_MOUSE_GUARD_MS;
  }

  private clearBuffered(): void {
    this.virtualPad.flush();
    this.padDash.reset();
    this.wheel = 0;
    this.clearDeviceBuffers();
  }

  /** Keyboard edges and mouse deltas only. */
  private clearDeviceBuffers(): void {
    this.pressed.clear();
    this.yaw = 0;
    this.pitch = 0;
  }

  private pollPad(dt: number): InputFrame | null {
    const pad = typeof navigator.getGamepads === "function" ? navigator.getGamepads().find((p) => p?.mapping === "standard") : null;
    if (!pad) return null;
    const buttons = pad.buttons.map((b) => b.pressed);
    const pressed = buttons.map((b, i) => b && !this.padPrev[i]);
    this.padPrev = buttons;
    const dash = this.padDash.update(pressed[1] ?? false, dt);
    return mapGamepad({ axes: pad.axes, buttons, pressed, dash }, dt);
  }
}

/** A pointer lock refused only because no user gesture was under way: worth asking again. */
const isNoGesture = (e: unknown): boolean => typeof e === "object" && e !== null && (e as { name?: unknown }).name === "NotAllowedError";
