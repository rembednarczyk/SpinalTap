import type { MetroStationId } from "@seki/core";
import type { MessageKey } from "../i18n/en";
import type { MapPolygon } from "./map-vm";

/**
 * The metro on the map (ADR-0071 stage 1): the line as a layer over the city map, the minimap and
 * the ticket kiosk, and the kiosk itself with the planned route, the preview of the destination and
 * the ticket bought in two steps. The app builds these from the simulation's content; the UI only
 * draws them. Names of stations and entrances are Lublin's, the same in every language (ADR-0056).
 */

// ---- the layer, sent once with `MapVm` ----

/** A way down to a station: today the kiosk, later a pavilion (stage 2). */
export interface MapMetroEntranceVm {
  /** "A", "B": the letter on the map. */
  readonly label: string;
  readonly name: string;
  readonly x: number;
  readonly z: number;
}

export interface MapMetroStationVm {
  readonly id: MetroStationId;
  readonly name: string;
  /** The district the station serves. */
  readonly district: string;
  /** Where the station's ring sits on the map. */
  readonly x: number;
  readonly z: number;
  readonly entrances: readonly MapMetroEntranceVm[];
}

/** A station the city may get: dashed on the map, no ticket, "under construction". */
export interface MapMetroPlannedVm {
  readonly id: string;
  readonly name: string;
  /** The working station the extension starts from. */
  readonly from: MetroStationId;
  readonly x: number;
  readonly z: number;
  /** The dashed line from `from`, flat `[x0, z0, …]`. */
  readonly path: MapPolygon;
  /** Metres from `from` along `path`. */
  readonly distance: number;
}

export interface MapMetroVm {
  /** Stations in the order of the line. */
  readonly stations: readonly MapMetroStationVm[];
  /** The tunnel: `legs[i]` runs from `stations[i]` to `stations[i + 1]`, flat `[x0, z0, …]`. */
  readonly legs: readonly MapPolygon[];
  readonly planned: readonly MapMetroPlannedVm[];
}

// ---- the kiosk ----

export interface MetroStopVm {
  readonly id: MetroStationId;
  readonly name: string;
  /** Ticket price from the platform the player stands on; 0 for that platform. */
  readonly fare: number;
  /** Stops of the ride from here; 0 for this platform. */
  readonly stops: number;
  /** Seconds of the ride from here; 0 for this platform. */
  readonly seconds: number;
  /** The platform the player stands on. */
  readonly here: boolean;
}

/** What is worth finding near a station: a shop, someone with contracts, the player's hideout. */
export type MetroNearKind = "shop" | "contract" | "hideout";

export interface MetroNearVm {
  readonly kind: MetroNearKind;
  /** What the card says: a shop's own name, "contracts · {name}", "your capsule room". */
  readonly label: MessageKey;
  /** The person's name for `{name}`, when the label has one. */
  readonly name?: string;
  readonly x: number;
  readonly z: number;
  /** Metres from the station, rounded to 10. */
  readonly distance: number;
}

/** The card of the chosen destination. */
export interface MetroPreviewVm {
  readonly id: MetroStationId;
  readonly name: string;
  readonly district: string;
  readonly entrances: readonly MapMetroEntranceVm[];
  /** Where the card's close-up map is centred. */
  readonly x: number;
  readonly z: number;
  /** Up to four things within `NEAR_RADIUS`, the nearest first. */
  readonly near: readonly MetroNearVm[];
  /** The stations of the ride in order, both ends included: the map lights these legs. */
  readonly route: readonly MetroStationId[];
  readonly fare: number;
  readonly stops: number;
  readonly seconds: number;
}

/** The line map at the ticket kiosk. */
export interface MetroMapVm {
  readonly line: string;
  readonly from: MetroStationId;
  /** Every stop of the line in order. */
  readonly stops: readonly MetroStopVm[];
  /** The destination chosen in the first step; the ticket is the second. */
  readonly selected: MetroStationId | null;
  readonly preview: MetroPreviewVm | null;
  /** Why the platform does not take the player now (security during a contract), null when it does. */
  readonly refusal: string | null;
}

/** Radius of the preview's neighbourhood, metres (ADR-0071). */
export const NEAR_RADIUS = 150;
/** At most this many things on the card. */
export const NEAR_MAX = 4;
