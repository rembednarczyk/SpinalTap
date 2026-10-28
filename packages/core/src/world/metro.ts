import { METRO_STATION_IDS, type MetroStationId } from "./wave2";

/**
 * The metro (ADR-0034): one line through the four districts, in the order of
 * `METRO_STATION_IDS` (Shinsekai, Kanałowa, Targ, Doki). A ticket costs a base fare plus a part
 * per stop on the way, and a ride lasts a few seconds per stop: long enough for the streamer to
 * bring the destination in while the carriage scene plays.
 */
export const METRO_BASE_FARE = 15;
export const METRO_FARE_PER_STOP = 5;
export const METRO_BASE_SECONDS = 5;
export const METRO_SECONDS_PER_STOP = 2;

/** Stops between two stations along the line (0 for the same one). */
export const metroStops = (from: MetroStationId, to: MetroStationId): number =>
  Math.abs(METRO_STATION_IDS.indexOf(from) - METRO_STATION_IDS.indexOf(to));

export const metroFare = (from: MetroStationId, to: MetroStationId): number => METRO_BASE_FARE + METRO_FARE_PER_STOP * metroStops(from, to);

/** Real seconds of the ride (simulation seconds; the clock runs on as usual). */
export const metroRideSeconds = (from: MetroStationId, to: MetroStationId): number => METRO_BASE_SECONDS + METRO_SECONDS_PER_STOP * metroStops(from, to);

export const isMetroStationId = (id: unknown): id is MetroStationId => typeof id === "string" && (METRO_STATION_IDS as readonly string[]).includes(id);

/** A ride in progress: the player is off the street until `arriveTick`. Saved with the domain. */
export interface MetroRide {
  readonly from: MetroStationId;
  readonly to: MetroStationId;
  readonly arriveTick: number;
}

export interface MetroState {
  readonly ride: MetroRide | null;
}

export const NO_METRO: MetroState = { ride: null };

/** Why the kiosk will not sell a ticket. */
export type MetroRefusal = "riding" | "not-at-kiosk" | "same-station" | "watched" | "funds";

/** What the kiosk checks besides where the player stands. */
export interface MetroTicketCheck {
  readonly from: MetroStationId | null;
  readonly to: MetroStationId;
  readonly riding: boolean;
  readonly eddies: number;
  /** A contract is running (active or cleared, not yet paid). */
  readonly contract: boolean;
  readonly heat: number;
}

/**
 * The ticket rules (ADR-0032, ADR-0034): one ride at a time, bought at a kiosk, to another
 * station, paid up front. While a contract runs with heat above 0 the security watches the
 * platforms and the kiosk refuses ("watched").
 */
export const metroRefusal = (c: MetroTicketCheck): MetroRefusal | null => {
  if (c.riding) return "riding";
  if (c.from === null) return "not-at-kiosk";
  if (c.from === c.to) return "same-station";
  if (c.contract && c.heat > 0) return "watched";
  if (c.eddies < metroFare(c.from, c.to)) return "funds";
  return null;
};
