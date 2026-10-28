import type { BuffId, DisguiseRole, MetroStationId } from "@seki/core";

/**
 * View models of wave 2 (ADR-0032, ADR-0035): the metro, the radio, cyberware capacity, buffs,
 * the dash, disguises and contract hooks. The app fills them from domain events; the UI only
 * reads them.
 */

// ---- metro ----

export interface MetroStopVm {
  readonly id: MetroStationId;
  readonly name: string;
  /** Ticket price from the platform the player stands on; 0 for that platform. */
  readonly fare: number;
  /** The platform the player stands on. */
  readonly here: boolean;
}

/** The line map at the ticket kiosk. */
export interface MetroMapVm {
  readonly line: string;
  readonly from: MetroStationId;
  /** Every stop of the line in order. */
  readonly stops: readonly MetroStopVm[];
  /** Why the platform does not take the player now (security during a contract), null when it does. */
  readonly refusal: string | null;
}

/** The ride screen between `MetroDeparted` and `MetroArrived`. */
export interface MetroRideVm {
  readonly line: string;
  readonly fromName: string;
  readonly toName: string;
  /** 0..1, quantised by the app. */
  readonly progress: number;
  /** The ink line shown as a subtitle now, null when the ride is quiet. */
  readonly caption: { readonly speaker: string | null; readonly text: string } | null;
}

// ---- radio ----

/** Stations of the radio (ADR-0035). Ink inserts live in knots `radio_<id>_<n>`. */
export type RadioStationId = "drift" | "yoru" | "tessen";

export interface RadioStationInfo {
  readonly id: RadioStationId;
  readonly name: string;
  readonly genre: string;
}

export const RADIO_STATIONS: readonly RadioStationInfo[] = [
  { id: "drift", name: "Neon Drift 88.1", genre: "synthwave" },
  { id: "yoru", name: "Yoru FM 76.5", genre: "city pop" },
  { id: "tessen", name: "Tessen Info 24", genre: "wiadomości korporacji" },
];

export const isRadioStationId = (v: unknown): v is RadioStationId => RADIO_STATIONS.some((s) => s.id === v);

export const radioStationName = (id: RadioStationId | null): string => RADIO_STATIONS.find((s) => s.id === id)?.name ?? "Radio wyłączone";

// ---- body: cyberware capacity, buffs, the dash, disguises ----

export interface CapacityVm {
  readonly used: number;
  readonly max: number;
}

export interface BuffVm {
  readonly id: BuffId;
  readonly name: string;
  /** Whole seconds left. */
  readonly left: number;
  readonly total: number;
}

export interface DashVm {
  /** Seconds of cooldown left, 0 when ready (tenths). */
  readonly cooldown: number;
  readonly total: number;
}

export interface DisguiseVm {
  readonly role: DisguiseRole;
  readonly label: string;
  /** An enforcer saw through it or a forbidden act gave it away. */
  readonly blown: boolean;
}

// ---- contract hooks and variations ----

/** Something the player found out that opens another way through the running contract. */
export interface ContractHookVm {
  readonly id: string;
  readonly text: string;
}

/** The plan-changing parts of a contract as the debrief card lists them. */
export interface ContractVariationVm {
  readonly labels: readonly string[];
  readonly twist: string | null;
}
