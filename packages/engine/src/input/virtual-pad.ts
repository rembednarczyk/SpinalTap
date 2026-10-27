import type { InputFrame, WeaponSlotInput } from "@seki/core";

export type PadButton = "fire" | "aim" | "interact" | "jump" | "ability" | "useItem" | "toggleCamera" | "sprint" | "toggleWeapon" | "crouch" | "reload";

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

  poll(): InputFrame {
    const edge = (b: PadButton) => this.pressed.has(b);
    const frame: InputFrame = {
      moveX: this.stickX,
      moveZ: this.stickZ,
      lookYaw: this.yaw,
      lookPitch: this.pitch,
      sprint: this.held.has("sprint") || Math.hypot(this.stickX, this.stickZ) >= STICK_SPRINT_THRESHOLD,
      crouch: this.held.has("crouch"),
      fire: this.held.has("fire"),
      aim: this.held.has("aim"),
      interact: edge("interact"),
      jump: edge("jump"),
      toggleCamera: edge("toggleCamera"),
      ability: edge("ability"),
      useItem: edge("useItem"),
      toggleWeapon: edge("toggleWeapon"),
      reload: edge("reload"),
      weaponSlot: this.slot,
      weaponCycle: 0,
    };
    this.flush();
    return frame;
  }
}
