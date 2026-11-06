/**
 * The player's perks in motion (ADR-0033): the dash and the guard's stamina for deflecting
 * bullets, and the Second Heart perk's wait (ADR-0059). Transient like the jump timers: a loaded
 * game starts rested, with the dash and the Second Heart ready.
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
  /**
   * A dash ran since the last step she stood on the floor: this time in the air (if any) is a
   * dash's flight, whatever its speed by now, not a step off an edge.
   */
  dashFlight: boolean;
  /** Seconds left in which shots pass the player by. */
  iframes: number;
  /** 0..1; deflecting a bullet takes some, it comes back over time. */
  stamina: number;
  /** Seconds until the Second Heart perk (ADR-0059) can save her from a lethal blow again. */
  secondHeart: number;
}
