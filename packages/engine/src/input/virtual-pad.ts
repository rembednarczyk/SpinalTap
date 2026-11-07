import type { InputFrame, WeaponSlotInput } from "@seki/core";

/**
 * On-screen buttons. `dash` (ADR-0036) is an edge like jump; the HUD places its button next to
 * the jump button under the action name `dash`.
 */
export type PadButton = "fire" | "aim" | "interact" | "jump" | "ability" | "useItem" | "toggleCamera" | "sprint" | "toggleWeapon" | "crouch" | "reload" | "dash";

/**
 * What the touch fire button does (ADR-0072): "aims" fires and aims down sights at once, so one
 * thumb shoots from the sights and steers by dragging; "separate" only fires, and the aim
 * button aims on its own.
 */
export type TouchFire = "aims" | "separate";

/** Stick deflection above which the on-screen stick also sprints. */
export const STICK_SPRINT_THRESHOLD = 0.92;

/**
 * Touch gamepad state, fed by the on-screen controls and polled like any other device.
 * Look deltas and button edges accumulate between polls, exactly like the mouse.
 */
export class VirtualPad {
  private stickX = 0;
  private stickZ = 0;
  private yaw = 0;
  private pitch = 0;
  private readonly held = new Set<PadButton>();
  private readonly pressed = new Set<PadButton>();
  /** Slot tapped on the HUD weapon strip since the last poll. */
  private slot: WeaponSlotInput = 0;
  /** The fire button's mode, from the settings. */
  touchFire: TouchFire = "aims";
  /**
   * The weapon in hand aims down sights; the app sets it every step. Without it (a melee weapon,
   * bare hands) the fire button only strikes, never raising the guard that `aim` means then.
   */
  adsWeapon = false;

  /** x: right, z: forward, both in [-1, 1]; the vector is clamped to the unit circle. */
  setStick(x: number, z: number): void {
    const len = Math.hypot(x, z);
    const k = len > 1 ? 1 / len : 1;
    this.stickX = x * k;
    this.stickZ = z * k;
  }

  /** Adds look rotation in radians (positive pitch looks down). */
  look(yaw: number, pitch: number): void {
    this.yaw += yaw;
    this.pitch += pitch;
  }

  press(button: PadButton): void {
    if (!this.held.has(button)) this.pressed.add(button);
    this.held.add(button);
  }

  /** A tap on a weapon slot in the HUD strip; edge-triggered like a button. */
  selectWeaponSlot(slot: 1 | 2 | 3): void {
    this.slot = slot;
  }

  release(button: PadButton): void {
    this.held.delete(button);
  }

  /** Lifts every finger: stick centred, buttons released, buffered input dropped. */
  reset(): void {
    this.setStick(0, 0);
    this.held.clear();
    this.flush();
  }

  /** Drops buffered edges and look deltas but keeps what is held. */
  flush(): void {
    this.pressed.clear();
    this.slot = 0;
    this.yaw = 0;
    this.pitch = 0;
  }

  /** The fire button is held in "aims" mode with a firearm in hand: the frame aims as well. */
  get fireAims(): boolean {
    return this.touchFire === "aims" && this.adsWeapon && this.held.has("fire");
  }

  /**
   * Adds the fire button's aim to a frame whose aim button the latches already resolved: the
   * fire button never flips a toggled aim, and letting go of it keeps an aim latched by the aim
   * button (ADR-0072).
   */
  withFireAim(latched: InputFrame): InputFrame {
    return this.fireAims && !latched.aim ? { ...latched, aim: true } : latched;
  }

  poll(): InputFrame {
    const edge = (b: PadButton) => this.pressed.has(b);
    const frame: InputFrame = {
      moveX: this.stickX,
      moveZ: this.stickZ,
      lookYaw: this.yaw,
      lookPitch: this.pitch,
      sprint: this.held.has("sprint") || Math.hypot(this.stickX, this.stickZ) >= STICK_SPRINT_THRESHOLD,
      crouch: this.held.has("crouch"),
      // A tap shorter than a step fires once, and chooses the kill in a grab (ADR-0075).
      fire: this.held.has("fire") || edge("fire"),
      // A tap shorter than a step still reaches the frame: in toggle mode it is what latches (ADR-0072).
      aim: this.held.has("aim") || edge("aim"),
      interact: edge("interact"),
      jump: edge("jump"),
      toggleCamera: edge("toggleCamera"),
      ability: edge("ability"),
      useItem: edge("useItem"),
      toggleWeapon: edge("toggleWeapon"),
      reload: edge("reload"),
      weaponSlot: this.slot,
      weaponCycle: 0,
      // The scanner and quickhacks come to touch with the HUD of ADR-0028.
      scan: false,
      quickhack: 0,
      dash: edge("dash"),
    };
    this.flush();
    return frame;
  }
}
