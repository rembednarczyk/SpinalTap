import { EMPTY_INPUT, type InputFrame, type InputPort } from "@seki/core";
import { DEFAULT_KEYMAP, type KeyMap, mapGamepad, mapKeyboardMouse, mergeFrames } from "./keymap";

const MOUSE_SENSITIVITY = 0.0022;

/**
 * InputPort for the browser: keyboard, mouse (pointer lock) and the first standard gamepad.
 * Mouse deltas and button edges accumulate between polls and are consumed by poll().
 */
export class BrowserInput implements InputPort {
  keymap: KeyMap = DEFAULT_KEYMAP;
  private active = false;
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private padPrev: boolean[] = [];
  private lastPoll: number | null = null;
  private readonly disposers: (() => void)[] = [];

  constructor(private readonly target: HTMLElement) {
    const on = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void) => {
      window.addEventListener(type, fn);
      this.disposers.push(() => window.removeEventListener(type, fn));
    };
    on("keydown", (e) => {
      if (e.repeat) return;
      this.held.add(e.code);
      this.pressed.add(e.code);
    });
    on("keyup", (e) => this.held.delete(e.code));
    on("blur", () => this.held.clear());
    on("mousedown", (e) => {
      if (!this.locked) return;
      this.held.add(`Mouse${e.button}`);
      this.pressed.add(`Mouse${e.button}`);
    });
    on("mouseup", (e) => this.held.delete(`Mouse${e.button}`));
    on("mousemove", (e) => {
      if (!this.locked) return;
      this.yaw += e.movementX * MOUSE_SENSITIVITY;
      this.pitch += e.movementY * MOUSE_SENSITIVITY;
    });
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
    if (value !== this.active) this.clearBuffered();
    this.active = value;
  }

  get locked(): boolean {
    return document.pointerLockElement === this.target;
  }

  requestPointerLock(): void {
    if (this.locked) return;
    // Some browsers return a promise that rejects when the request is not user-initiated.
    const r = this.target.requestPointerLock() as unknown;
    if (r instanceof Promise) r.catch(() => {});
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
    this.clearBuffered();
    const pad = this.pollPad(dt);
    return pad ? mergeFrames(km, pad) : km;
  }

  dispose(): void {
    for (const d of this.disposers) d();
  }

  private clearBuffered(): void {
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
