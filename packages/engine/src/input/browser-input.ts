import { EMPTY_INPUT, type InputFrame, type InputPort } from "@seki/core";
import { AimLatch, type AimMode, DEFAULT_KEYMAP, type KeyMap, mapGamepad, mapKeyboardMouse, mergeFrames } from "./keymap";
import { VirtualPad } from "./virtual-pad";

const MOUSE_SENSITIVITY = 0.0022;
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
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private padPrev: boolean[] = [];
  private lastPoll: number | null = null;
  private readonly disposers: (() => void)[] = [];
  private readonly aimLatch = new AimLatch();

  constructor(private readonly target: HTMLElement) {
    const on = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void) => {
      window.addEventListener(type, fn);
      this.disposers.push(() => window.removeEventListener(type, fn));
    };
    on("keydown", (e) => {
      // Space jumps in play; it must not also scroll the page or press a focused button.
      if (this.active && e.code === "Space") e.preventDefault();
      if (e.repeat) return;
      this.held.add(e.code);
      this.pressed.add(e.code);
    });
    on("keyup", (e) => this.held.delete(e.code));
    on("blur", () => this.held.clear());
    const onLockError = () => {
      this.lockUnavailable = true;
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
    on("mousemove", (e) => {
      if (!this.mouseActive || this.touchEmulated()) return;
      this.yaw += e.movementX * MOUSE_SENSITIVITY;
      this.pitch += e.movementY * MOUSE_SENSITIVITY;
    });
  }

  /** "hold" (default) or "toggle" for the aim button, from the settings (ADR-0019). */
  get aimMode(): AimMode {
    return this.aimLatch.mode;
  }

  set aimMode(mode: AimMode) {
    if (mode !== this.aimLatch.mode) this.aimLatch.reset();
    this.aimLatch.mode = mode;
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
      this.aimLatch.reset();
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
      const r = this.target.requestPointerLock() as unknown;
      if (r instanceof Promise) r.catch(() => (this.lockUnavailable = true));
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
    return this.aimLatch.apply(pad ? mergeFrames(withTouch, pad) : withTouch);
  }

  dispose(): void {
    for (const d of this.disposers) d();
  }

  private touchEmulated(): boolean {
    return performance.now() - this.lastTouchAt < TOUCH_MOUSE_GUARD_MS;
  }

  private clearBuffered(): void {
    this.virtualPad.flush();
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
    return mapGamepad({ axes: pad.axes, buttons, pressed }, dt);
  }
}
