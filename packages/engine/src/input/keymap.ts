import type {
  InputFrame,
  QuickhackSlotInput,
  WeaponCycleInput,
  WeaponSlotInput,
} from "@seki/core";

export type Action =
  | "forward"
  | "back"
  | "left"
  | "right"
  | "sprint"
  | "crouch"
  | "fire"
  | "aim"
  | "interact"
  | "jump"
  | "toggleCamera"
  | "ability"
  | "useItem"
  | "toggleWeapon"
  | "reload"
  | "slot1"
  | "slot2"
  | "slot3"
  | "nextWeapon"
  | "prevWeapon"
  | "scan"
  | "dash"
  | "swapShoulder";

/**
 * Action → physical codes (KeyboardEvent.code, "Mouse0".."Mouse4", or "WheelUp"/"WheelDown").
 * Remappable at runtime (the settings' key bindings).
 */
export type KeyMap = Readonly<Record<Action, readonly string[]>>;

export const DEFAULT_KEYMAP: KeyMap = {
  forward: ["KeyW", "ArrowUp"],
  back: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  sprint: ["ShiftLeft", "ShiftRight"],
  // C only: Ctrl would turn Ctrl+W (crouch while walking) into "close the tab".
  crouch: ["KeyC"],
  fire: ["Mouse0"],
  // Right mouse button: aim down sights, or guard with a melee weapon (ADR-0019).
  aim: ["Mouse2"],
  // E, with F as the second key many PC games use for "use".
  interact: ["KeyE", "KeyF"],
  jump: ["Space"],
  toggleCamera: ["KeyV"],
  ability: ["KeyQ"],
  useItem: ["KeyH"],
  toggleWeapon: ["KeyX"],
  reload: ["KeyR"],
  slot1: ["Digit1", "Numpad1"],
  slot2: ["Digit2", "Numpad2"],
  slot3: ["Digit3", "Numpad3"],
  // The wheel walks through the weapons that are there: down to the next, up to the previous.
  nextWeapon: ["WheelDown"],
  prevWeapon: ["WheelUp"],
  // Scanner (ADR-0028), held. Tab, Cyberpunk's key, opens the character menu here.
  scan: ["KeyZ", "Mouse1"],
  // Dash (ADR-0032). Alt as in many PC action games; the browser's own Alt menu is suppressed.
  dash: ["AltLeft"],
  // Over the other shoulder in TPP (G-275); G sits next to V, which switches the view.
  swapShoulder: ["KeyG"],
};

export const remap = (
  map: KeyMap,
  action: Action,
  codes: readonly string[],
): KeyMap => ({ ...map, [action]: codes });

const any = (held: ReadonlySet<string>, codes: readonly string[]) =>
  codes.some((c) => held.has(c));

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

/** First slot key pressed this poll: 1 primary, 2 secondary, 3 melee, 0 none. */
const slotPressed = (
  pressed: ReadonlySet<string>,
  map: KeyMap,
): WeaponSlotInput =>
  any(pressed, map.slot1)
    ? 1
    : any(pressed, map.slot2)
      ? 2
      : any(pressed, map.slot3)
        ? 3
        : 0;

/** While scanning, the number keys pick a quickhack instead of a weapon (ADR-0028). */
const QUICKHACK_KEYS: readonly (readonly string[])[] = [
  ["Digit1", "Numpad1"],
  ["Digit2", "Numpad2"],
  ["Digit3", "Numpad3"],
  ["Digit4", "Numpad4"],
  ["Digit5", "Numpad5"],
];

const quickhackPressed = (pressed: ReadonlySet<string>): QuickhackSlotInput => {
  const i = QUICKHACK_KEYS.findIndex((codes) => any(pressed, codes));
  return (i + 1) as QuickhackSlotInput;
};

const cyclePressed = (
  pressed: ReadonlySet<string>,
  map: KeyMap,
): WeaponCycleInput =>
  any(pressed, map.nextWeapon) ? 1 : any(pressed, map.prevWeapon) ? -1 : 0;

/** Keyboard + mouse state → InputFrame. Pure, so it is unit-tested without a browser. */
export const mapKeyboardMouse = (
  keys: KeyState,
  look: LookDelta,
  map: KeyMap = DEFAULT_KEYMAP,
): InputFrame => {
  const scan = any(keys.held, map.scan);
  return {
    moveX:
      (any(keys.held, map.right) ? 1 : 0) - (any(keys.held, map.left) ? 1 : 0),
    moveZ:
      (any(keys.held, map.forward) ? 1 : 0) -
      (any(keys.held, map.back) ? 1 : 0),
    lookYaw: look.yaw,
    lookPitch: look.pitch,
    sprint: any(keys.held, map.sprint),
    crouch: any(keys.held, map.crouch),
    // A click shorter than a poll still fires once, and chooses the kill in a grab (ADR-0075).
    fire: any(keys.held, map.fire) || any(keys.pressed, map.fire),
    aim: any(keys.held, map.aim),
    interact: any(keys.pressed, map.interact),
    jump: any(keys.pressed, map.jump),
    toggleCamera: any(keys.pressed, map.toggleCamera),
    ability: any(keys.pressed, map.ability),
    useItem: any(keys.pressed, map.useItem),
    toggleWeapon: any(keys.pressed, map.toggleWeapon),
    reload: any(keys.pressed, map.reload),
    weaponSlot: scan ? 0 : slotPressed(keys.pressed, map),
    weaponCycle: cyclePressed(keys.pressed, map),
    scan,
    quickhack: scan ? quickhackPressed(keys.pressed) : 0,
    dash: any(keys.pressed, map.dash),
  };
};

export interface PadState {
  readonly axes: readonly number[];
  /** Pressed state per button index (standard mapping). */
  readonly buttons: readonly boolean[];
  /** Buttons that went down since the last poll. */
  readonly pressed: readonly boolean[];
  /** B was tapped twice within `DOUBLE_TAP_SECONDS` (see `DoubleTap`): the dash. */
  readonly dash?: boolean;
}

/** Longest gap between the two taps of a double tap. */
export const DOUBLE_TAP_SECONDS = 0.3;

/**
 * Double-tap detector for one button, fed with its press edges and the time between polls.
 * The pad dashes on a double tap of B (ADR-0036): B already crouches while held, every face
 * button and shoulder is taken, and a double tap of the crouch button is the dodge of
 * Cyberpunk 2077, so players bring the habit with them. A third tap starts a new pair.
 */
export class DoubleTap {
  private sinceTap = Infinity;

  constructor(private readonly window = DOUBLE_TAP_SECONDS) {}

  /** True on the second press within the window. */
  update(pressed: boolean, dt: number): boolean {
    this.sinceTap += Math.max(0, dt);
    if (!pressed) return false;
    if (this.sinceTap <= this.window) {
      this.sinceTap = Infinity;
      return true;
    }
    this.sinceTap = 0;
    return false;
  }

  reset(): void {
    this.sinceTap = Infinity;
  }
}

/** Inner dead zone of both sticks, radial (ADR-0072): a deflection shorter than this is rest. */
export const PAD_DEADZONE = 0.12;
/** Range of the dead zone setting. */
export const PAD_DEADZONE_RANGE: readonly [number, number] = [0.05, 0.3];
/** Outer dead zone: a deflection past this is full travel, as worn sticks seldom reach 1. */
export const PAD_OUTER_DEADZONE = 0.95;
/** Full right stick turns the view this fast, radians per second, before the sensitivity. */
export const PAD_LOOK_SPEED = 2.8;

/** Look response of the right stick (ADR-0072): the stick's travel to the power of the exponent. */
export type PadCurve = "linear" | "classic" | "precise";
export const PAD_CURVE_EXPONENT: Readonly<Record<PadCurve, number>> = { linear: 1, classic: 1.8, precise: 2.6 };

/** The pad's own look settings (ADR-0072): dead zone, response curve and sensitivity. */
export interface PadTuning {
  readonly deadzone: number;
  readonly curve: PadCurve;
  /** Look speed multiplier; 1 turns at `PAD_LOOK_SPEED`. */
  readonly sensitivity: number;
}

export const DEFAULT_PAD_TUNING: PadTuning = { deadzone: PAD_DEADZONE, curve: "classic", sensitivity: 1 };

export interface Stick {
  readonly x: number;
  readonly y: number;
}

/**
 * Radial dead zone (ADR-0072): the length of the deflection decides rest, not each axis alone,
 * so a small diagonal stays diagonal instead of snapping to an axis. Travel between the inner
 * and the outer zone rescales to 0..1 and keeps its direction; `exponent` bends that travel.
 */
export const shapeStick = (x: number | undefined, y: number | undefined, deadzone: number, exponent = 1): Stick => {
  const sx = x ?? 0;
  const sy = y ?? 0;
  const length = Math.hypot(sx, sy);
  if (length <= deadzone) return { x: 0, y: 0 };
  const travel = Math.min(1, (length - deadzone) / (PAD_OUTER_DEADZONE - deadzone)) ** exponent;
  return { x: (sx / length) * travel, y: (sy / length) * travel };
};

/** D-pad: left primary, up secondary, right melee (down reloads). */
const padSlot = (pressed: readonly boolean[]): WeaponSlotInput =>
  pressed[14] ? 1 : pressed[12] ? 2 : pressed[15] ? 3 : 0;

/**
 * Standard-mapping gamepad → InputFrame. Both sticks have the radial dead zone; the right one
 * also the response curve and the pad's own sensitivity, and its look speed scales with dt.
 */
export const mapGamepad = (pad: PadState, dt: number, tuning: PadTuning = DEFAULT_PAD_TUNING): InputFrame => {
  const move = shapeStick(pad.axes[0], pad.axes[1], tuning.deadzone);
  const look = shapeStick(pad.axes[2], pad.axes[3], tuning.deadzone, PAD_CURVE_EXPONENT[tuning.curve]);
  const speed = PAD_LOOK_SPEED * tuning.sensitivity * dt;
  return { ...padButtons(pad), moveX: move.x, moveZ: -move.y, lookYaw: look.x * speed, lookPitch: look.y * speed };
};

/** Everything but the sticks of a standard-mapping pad. */
const padButtons = (pad: PadState): Omit<InputFrame, "moveX" | "moveZ" | "lookYaw" | "lookPitch"> => ({
  sprint: pad.buttons[10] ?? false,
  // B (east face button), held.
  crouch: pad.buttons[1] ?? false,
  fire: pad.buttons[7] ?? false,
  // Left trigger.
  aim: pad.buttons[6] ?? false,
  // Face buttons (ADR-0021): A jumps, X uses, Y heals; the View button switches the camera.
  jump: pad.pressed[0] ?? false,
  interact: pad.pressed[2] ?? false,
  toggleCamera: pad.pressed[8] ?? false,
  ability: pad.pressed[5] ?? false,
  useItem: pad.pressed[3] ?? false,
  toggleWeapon: pad.pressed[4] ?? false,
  reload: pad.pressed[13] ?? false,
  weaponSlot: padSlot(pad.pressed),
  // Weapons are picked on the d-pad, so the pad never cycles.
  weaponCycle: 0,
  // Scanner on the right stick click (ADR-0028); quickhacks are picked in the touch/HUD list.
  scan: pad.buttons[11] ?? false,
  quickhack: 0,
  // Double tap of B (ADR-0036), detected by `DoubleTap` while polling.
  dash: pad.dash ?? false,
});

/** Combines devices: axes are summed and clamped, buttons are OR-ed. */
export const mergeFrames = (a: InputFrame, b: InputFrame): InputFrame => ({
  moveX: Math.max(-1, Math.min(1, a.moveX + b.moveX)),
  moveZ: Math.max(-1, Math.min(1, a.moveZ + b.moveZ)),
  lookYaw: a.lookYaw + b.lookYaw,
  lookPitch: a.lookPitch + b.lookPitch,
  sprint: a.sprint || b.sprint,
  crouch: a.crouch || b.crouch,
  fire: a.fire || b.fire,
  aim: a.aim || b.aim,
  interact: a.interact || b.interact,
  jump: a.jump || b.jump,
  toggleCamera: a.toggleCamera || b.toggleCamera,
  ability: a.ability || b.ability,
  useItem: a.useItem || b.useItem,
  toggleWeapon: a.toggleWeapon || b.toggleWeapon,
  reload: a.reload || b.reload,
  weaponSlot: a.weaponSlot || b.weaponSlot,
  weaponCycle: a.weaponCycle || b.weaponCycle,
  scan: a.scan || b.scan,
  quickhack: a.quickhack || b.quickhack,
  dash: a.dash || b.dash,
});

/** How a button behaves: held down, or pressed once to start and again to stop. */
export type ButtonMode = "hold" | "toggle";
export type AimMode = ButtonMode;

/**
 * Turns the raw aim button into "wants to aim" (ADR-0019). In "hold" mode it passes the button
 * through; in "toggle" mode each press flips the aim. `reset` drops a latched aim, e.g. when
 * the game loses focus, so a menu never leaves the player aiming.
 */
export class AimLatch {
  mode: AimMode = "hold";
  private latched = false;
  private wasDown = false;

  apply(frame: InputFrame): InputFrame {
    const down = frame.aim;
    const pressed = down && !this.wasDown;
    this.wasDown = down;
    if (this.mode === "hold") {
      this.latched = false;
      return frame;
    }
    if (pressed) this.latched = !this.latched;
    return frame.aim === this.latched ? frame : { ...frame, aim: this.latched };
  }

  reset(): void {
    this.latched = false;
    this.wasDown = false;
  }
}

/** One hold-or-toggle button. */
class Latch {
  mode: ButtonMode = "hold";
  latched = false;
  private wasDown = false;

  apply(down: boolean): boolean {
    const pressed = down && !this.wasDown;
    this.wasDown = down;
    if (this.mode === "hold") {
      this.latched = false;
      return down;
    }
    if (pressed) this.latched = !this.latched;
    return this.latched;
  }

  reset(): void {
    this.latched = false;
    this.wasDown = false;
  }
}

/**
 * Hold or toggle for aim, crouch and sprint, as PC games offer in their control settings.
 * A toggled sprint ends when the player stops moving forward, aims, or crouches; a toggled
 * crouch ends on a sprint or a jump. The frame then says what the player wants this tick.
 */
export class InputLatches {
  private readonly aim = new Latch();
  private readonly crouch = new Latch();
  private readonly sprint = new Latch();

  setModes(modes: {
    aim: ButtonMode;
    crouch: ButtonMode;
    sprint: ButtonMode;
  }): void {
    for (const key of ["aim", "crouch", "sprint"] as const) {
      if (this[key].mode !== modes[key]) this[key].reset();
      this[key].mode = modes[key];
    }
  }

  apply(frame: InputFrame): InputFrame {
    const aim = this.aim.apply(frame.aim);
    let sprint = this.sprint.apply(frame.sprint);
    if (
      this.sprint.mode === "toggle" &&
      sprint &&
      (frame.moveZ <= 0.1 || aim)
    ) {
      this.sprint.latched = false;
      sprint = false;
    }
    let crouch = this.crouch.apply(frame.crouch);
    if (this.crouch.mode === "toggle" && crouch && (sprint || frame.jump)) {
      this.crouch.latched = false;
      crouch = false;
    }
    return aim === frame.aim &&
      sprint === frame.sprint &&
      crouch === frame.crouch
      ? frame
      : { ...frame, aim, sprint, crouch };
  }

  reset(): void {
    this.aim.reset();
    this.crouch.reset();
    this.sprint.reset();
  }
}
