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
  /** Edge-triggered: next (1) or previous (-1) weapon slot that holds a weapon, 0 none (mouse wheel). */
  readonly weaponCycle: WeaponCycleInput;
  /** Held: scanner mode (ADR-0028). Time slows a little and quickhacks target what is in focus. */
  readonly scan: boolean;
  /** Edge-triggered quickhack choice while scanning: the n-th hack of the list, 0 none. */
  readonly quickhack: QuickhackSlotInput;
  /** Edge-triggered: dash (ADR-0032), on the ground or in the air with the right legs cyberware. */
  readonly dash: boolean;
  /**
   * The TPP camera looks over the left shoulder, and the shots start there (G-275). A side, not
   * a press: the input adapter keeps it, the settings remember it. Absent (older frames and
   * replays): the right shoulder.
   */
  readonly leftShoulder?: boolean;
  /**
   * Driving (ADR-0097 §1), when the device gives its own axes (a pad's triggers, a wheel's pedals):
   * the simulation drives from them while the player sits in a car. Absent (a keyboard, touch, older
   * frames): the car reads the movement axes, `moveZ` as throttle and brake and `moveX` as steer,
   * eased in the simulation, and `jump` as the handbrake.
   */
  readonly drive?: DriveInput;
  /** The car's horn held (ADR-0097): H on the keyboard, the left stick pressed on a pad. Absent: not held. */
  readonly horn?: boolean;
}

/** A driver's controls (ADR-0097 §1). */
export interface DriveInput {
  /** 0..1. */
  readonly throttle: number;
  /** 0..1. */
  readonly brake: number;
  /** -1..1, positive to the left. */
  readonly steer: number;
  readonly handbrake: boolean;
  /** Edge-triggered: a gear up or down (sequential box). */
  readonly shiftUp?: boolean;
  readonly shiftDown?: boolean;
  /** 0..1, a wheel's clutch pedal (absent: the clutch works itself). */
  readonly clutch?: number;
}

export type QuickhackSlotInput = 0 | 1 | 2 | 3 | 4 | 5;

export type WeaponCycleInput = -1 | 0 | 1;

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
  weaponCycle: 0,
  scan: false,
  quickhack: 0,
  dash: false,
});

export interface InputPort {
  poll(): InputFrame;
}
