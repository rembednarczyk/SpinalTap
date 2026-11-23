/** A vehicle driving its lane (ADR-0050). Transient: a load puts it back on its timetable. */
export interface VehicleState {
  /** Index of its lane in `TRAFFIC_ROUTES` (another one's once it drives on as a guest), and its own index on its first lane. */
  route: number;
  readonly index: number;
  /**
   * Driven on from its own lane's end onto the next one in the player's view (`TrafficRoute.then`, G-966): no timetable
   * there (the lane's are its own vehicles'), it cruises behind the one ahead and goes out of sight at the next end it
   * reaches unseen, and its own lane puts it back on its timetable from then.
   */
  guest: boolean;
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
