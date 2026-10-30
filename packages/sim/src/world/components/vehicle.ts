/** A vehicle driving its lane (ADR-0050). Transient: a load puts it back on its timetable. */
export interface VehicleState {
  /** Index of its lane in `TRAFFIC_ROUTES`, and its own index on it. */
  readonly route: number;
  readonly index: number;
  /** Half its footprint: across, along (m). */
  readonly half: { readonly w: number; readonly l: number };
  /** Arc length along the lane, and the speed it drives at (m, m/s). */
  s: number;
  v: number;
  /** How far it has stepped right of its lane to pass someone standing in the road (m; negative: left). */
  aside: number;
  /** Seconds the player has kept it stopped. */
  blocked: number;
  /** Seconds before it may sound its horn again. */
  horn: number;
  /** Frightened by a shot: stopping dead or speeding away, for `left` seconds. */
  panic: { readonly kind: "stop" | "flee"; left: number } | null;
}
