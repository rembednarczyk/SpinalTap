import type { Vec3, W3StationId } from "@seki/core";
import { STATIONS } from "./layout";
import { w3 } from "./site";

/**
 * W-3's loud way in the hall (ADR-0082 §1 "Droga głośna", stage 3b): the charges' case in armoury
 * S, the four stations of the line a charge goes on, the two waves of the alarm and the line's two
 * technicians. Pure numbers; the sabotage's templates spawn them.
 */

/** The charges' case on its stand in armoury S (the block at x 2554.4..2555.6, z 400.4..401.2), its top. */
export const W3_CHARGES_CASE: Vec3 = w3(2555, 0.9, 400.8);

/** Where Seki stands to plant on a station: the station's aisle side, on the floor. */
export const W3_STATION_SPOTS: Readonly<Record<W3StationId, Vec3>> = {
  S1: w3(STATIONS.S1.x, 0, STATIONS.S1.z),
  S2: w3(STATIONS.S2.x, 0, STATIONS.S2.z),
  S3: w3(STATIONS.S3.x, 0, STATIONS.S3.z),
  S4: w3(STATIONS.S4.x, 0, STATIONS.S4.z),
};

/** The charge on the station's top (the stations are 1.1 m high, half a metre deep at the belt). */
export const stationChargeAt = (s: W3StationId): Vec3 => {
  const p = W3_STATION_SPOTS[s];
  const belt = s === "S1" || s === "S2" ? -0.55 : 0.55;
  return { x: p.x, y: p.y + 1.1, z: p.z + belt };
};

/**
 * The alarm's waves (ADR-0082 §1 p. 4): three men in from the personnel airlocks at once, three
 * from the pickup yard a minute later. Each faces the hall.
 */
export const W3_WAVE_AIRLOCKS: readonly { readonly at: Vec3; readonly yaw: number }[] = [
  { at: w3(2506, 0, 409.5), yaw: Math.PI / 2 },
  { at: w3(2506, 0, 426), yaw: Math.PI / 2 },
  { at: w3(2507, 0, 416), yaw: Math.PI / 2 },
];
export const W3_WAVE_PICKUP: readonly { readonly at: Vec3; readonly yaw: number }[] = [
  { at: w3(2520, 0, 446), yaw: Math.PI },
  { at: w3(2530, 0, 446), yaw: Math.PI },
  { at: w3(2540, 0, 446), yaw: Math.PI },
];

/**
 * The line's technicians (ADR-0082 §3.6): at S2 looking over belt L1 and at S3 over L2, on the
 * production aisle. They see Seki with a weapon, in a no-go zone or without a disguise and report
 * her to the job's alarm.
 */
export const W3_TECHNICIANS: readonly { readonly at: Vec3; readonly yaw: number }[] = [
  { at: w3(2537, 0, 414.2), yaw: Math.PI },
  { at: w3(2519, 0, 421.8), yaw: 0 },
];
