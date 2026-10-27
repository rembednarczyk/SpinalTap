/** One simulation tick worth of player intent. Device-agnostic and serializable (replays). */
export interface InputFrame {
  /** Strafe axis, -1 (left) .. 1 (right). */
  readonly moveX: number;
  /** Forward axis, -1 (back) .. 1 (forward). */
  readonly moveZ: number;
  /** Yaw change in radians accumulated since the previous frame. */
  readonly lookYaw: number;
  /** Pitch change in radians accumulated since the previous frame. */
  readonly lookPitch: number;
  readonly sprint: boolean;
  /** Held: crouch while true (touch controls latch it). */
  readonly crouch: boolean;
  readonly fire: boolean;
  /**
   * Held: aim down sights with a firearm, guard with a melee weapon (ADR-0019). A "toggle"
   * setting is resolved by the input adapter, so the frame always says "wants to aim now".
   */
  readonly aim: boolean;
  /** Edge-triggered: true only on the tick the button went down. */
  readonly interact: boolean;
  /** Edge-triggered: jump (ADR-0021). The simulation buffers it briefly, so an early press still counts. */
  readonly jump: boolean;
  /** Edge-triggered. */
  readonly toggleCamera: boolean;
  /** Edge-triggered: use the installed active cyberware ability. */
  readonly ability: boolean;
  /** Edge-triggered: use a medkit. */
  readonly useItem: boolean;
  /** Edge-triggered: holster or draw the weapon. */
  readonly toggleWeapon: boolean;
  /** Edge-triggered: reload the active weapon. */
  readonly reload: boolean;
  /** Edge-triggered weapon slot choice: 1 primary, 2 secondary, 3 melee, 0 no change. */
  readonly weaponSlot: WeaponSlotInput;
}

export type WeaponSlotInput = 0 | 1 | 2 | 3;

export const EMPTY_INPUT: InputFrame = Object.freeze({
  moveX: 0,
  moveZ: 0,
  lookYaw: 0,
  lookPitch: 0,
  sprint: false,
  crouch: false,
  fire: false,
  aim: false,
  interact: false,
  jump: false,
  toggleCamera: false,
  ability: false,
  useItem: false,
  toggleWeapon: false,
  reload: false,
  weaponSlot: 0,
});

export interface InputPort {
  poll(): InputFrame;
}
