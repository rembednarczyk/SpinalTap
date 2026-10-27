import type { InputFrame } from "@seki/core";

export type Action = "forward" | "back" | "left" | "right" | "sprint" | "fire" | "interact" | "toggleCamera" | "ability" | "useItem" | "toggleWeapon";

/** Action → physical codes (KeyboardEvent.code, or "Mouse0".."Mouse2"). Remappable at runtime. */
export type KeyMap = Readonly<Record<Action, readonly string[]>>;

export const DEFAULT_KEYMAP: KeyMap = {
  forward: ["KeyW", "ArrowUp"],
  back: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  sprint: ["ShiftLeft", "ShiftRight"],
  fire: ["Mouse0"],
  interact: ["KeyE"],
  toggleCamera: ["KeyV"],
  ability: ["KeyQ"],
  useItem: ["KeyH"],
  toggleWeapon: ["KeyX"],
};

export const remap = (map: KeyMap, action: Action, codes: readonly string[]): KeyMap => ({ ...map, [action]: codes });

const any = (held: ReadonlySet<string>, codes: readonly string[]) => codes.some((c) => held.has(c));

export interface KeyState {
  /** Codes currently held. */
  readonly held: ReadonlySet<string>;
  /** Codes that went down since the last poll. */
  readonly pressed: ReadonlySet<string>;
}

export interface LookDelta {
  readonly yaw: number;
  readonly pitch: number;
}

/** Keyboard + mouse state → InputFrame. Pure, so it is unit-tested without a browser. */
export const mapKeyboardMouse = (keys: KeyState, look: LookDelta, map: KeyMap = DEFAULT_KEYMAP): InputFrame => ({
  moveX: (any(keys.held, map.right) ? 1 : 0) - (any(keys.held, map.left) ? 1 : 0),
  moveZ: (any(keys.held, map.forward) ? 1 : 0) - (any(keys.held, map.back) ? 1 : 0),
  lookYaw: look.yaw,
  lookPitch: look.pitch,
  sprint: any(keys.held, map.sprint),
  fire: any(keys.held, map.fire),
  interact: any(keys.pressed, map.interact),
  toggleCamera: any(keys.pressed, map.toggleCamera),
  ability: any(keys.pressed, map.ability),
  useItem: any(keys.pressed, map.useItem),
  toggleWeapon: any(keys.pressed, map.toggleWeapon),
});

export interface PadState {
  readonly axes: readonly number[];
  /** Pressed state per button index (standard mapping). */
  readonly buttons: readonly boolean[];
  /** Buttons that went down since the last poll. */
  readonly pressed: readonly boolean[];
}

export const PAD_DEADZONE = 0.16;
export const PAD_LOOK_SPEED = 2.8;

const dead = (v: number | undefined): number => {
  const x = v ?? 0;
  return Math.abs(x) < PAD_DEADZONE ? 0 : (x - Math.sign(x) * PAD_DEADZONE) / (1 - PAD_DEADZONE);
};

/** Standard-mapping gamepad → InputFrame. Look speed scales with dt. */
export const mapGamepad = (pad: PadState, dt: number): InputFrame => ({
  moveX: dead(pad.axes[0]),
  moveZ: -dead(pad.axes[1]),
  lookYaw: dead(pad.axes[2]) * PAD_LOOK_SPEED * dt,
  lookPitch: dead(pad.axes[3]) * PAD_LOOK_SPEED * dt,
  sprint: pad.buttons[10] ?? false,
  fire: pad.buttons[7] ?? false,
  interact: pad.pressed[0] ?? false,
  toggleCamera: pad.pressed[3] ?? false,
  ability: pad.pressed[5] ?? false,
  useItem: pad.pressed[2] ?? false,
  toggleWeapon: pad.pressed[4] ?? false,
});

/** Combines devices: axes are summed and clamped, buttons are OR-ed. */
export const mergeFrames = (a: InputFrame, b: InputFrame): InputFrame => ({
  moveX: Math.max(-1, Math.min(1, a.moveX + b.moveX)),
  moveZ: Math.max(-1, Math.min(1, a.moveZ + b.moveZ)),
  lookYaw: a.lookYaw + b.lookYaw,
  lookPitch: a.lookPitch + b.lookPitch,
  sprint: a.sprint || b.sprint,
  fire: a.fire || b.fire,
  interact: a.interact || b.interact,
  toggleCamera: a.toggleCamera || b.toggleCamera,
  ability: a.ability || b.ability,
  useItem: a.useItem || b.useItem,
  toggleWeapon: a.toggleWeapon || b.toggleWeapon,
});
