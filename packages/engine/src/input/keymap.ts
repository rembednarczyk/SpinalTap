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
  | "dash";

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
    fire: any(keys.held, map.fire),
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
}

export const PAD_DEADZONE = 0.16;
export const PAD_LOOK_SPEED = 2.8;

const dead = (v: number | undefined): number => {
  const x = v ?? 0;
  return Math.abs(x) < PAD_DEADZONE
    ? 0
    : (x - Math.sign(x) * PAD_DEADZONE) / (1 - PAD_DEADZONE);
};

/** D-pad: left primary, up secondary, right melee (down reloads). */
const padSlot = (pressed: readonly boolean[]): WeaponSlotInput =>
  pressed[14] ? 1 : pressed[12] ? 2 : pressed[15] ? 3 : 0;

/** Standard-mapping gamepad → InputFrame. Look speed scales with dt. */
export const mapGamepad = (pad: PadState, dt: number): InputFrame => ({
  moveX: dead(pad.axes[0]),
  moveZ: -dead(pad.axes[1]),
  lookYaw: dead(pad.axes[2]) * PAD_LOOK_SPEED * dt,
  lookPitch: dead(pad.axes[3]) * PAD_LOOK_SPEED * dt,
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
  // The pad's dash binding comes with the wave 2 input work (ADR-0032).
  dash: false,
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
