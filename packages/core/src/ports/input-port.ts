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
  readonly fire: boolean;
  /** Edge-triggered: true only on the tick the button went down. */
  readonly interact: boolean;
  /** Edge-triggered. */
  readonly toggleCamera: boolean;
}

export const EMPTY_INPUT: InputFrame = Object.freeze({
  moveX: 0,
  moveZ: 0,
  lookYaw: 0,
  lookPitch: 0,
  sprint: false,
  fire: false,
  interact: false,
  toggleCamera: false,
});

export interface InputPort {
  poll(): InputFrame;
}
