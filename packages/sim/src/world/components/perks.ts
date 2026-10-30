/**
 * The player's perks in motion (ADR-0033): the dash and the guard's stamina for deflecting
 * bullets. Transient like the jump timers: a loaded game starts rested, with the dash ready.
 */
export interface PerkState {
  /** Seconds left of the dash burst. */
  dash: number;
  /** Direction of the burst on the ground plane (unit). */
  dashDir: { x: number; z: number };
  /** Seconds until the next dash. */
  dashCooldown: number;
  /** The one dash of this time in the air is used; resets on the ground. */
  airDash: boolean;
  /** Seconds left in which shots pass the player by. */
  iframes: number;
  /** 0..1; deflecting a bullet takes some, it comes back over time. */
  stamina: number;
}
