import type { ActivityId, Vec3 } from "@seki/core";
import type { CrowdSpot } from "../crowd-spot";
import { EAST, NORTH, SOUTH, WEST, onFloor } from "./plan";
import { P1_CONSOLE, P1_BAYS } from "./parking";
import { OPEN_YAW, ALCHEMIA_UNITS, atUnit, beforeKeeper } from "./units";

/**
 * The food hall's still crowd (ADR-0060, ADR-0074 §3): customers at the counters of the open
 * units, people eating at the shared tables. Indoors (no umbrellas), on the hall's floor, out of
 * the keepers' places and the aisles. The passers-by's spots stay outside on T1 (`activity-spots.ts`):
 * nobody walks into the hall on a routine, the doors being the level graph's.
 */

const CHUNK = "krakowskie-2-1";

const at = (p: Vec3, yaw: number, does: readonly [ActivityId, ...ActivityId[]]): CrowdSpot => ({ chunk: CHUNK, at: p, yaw, does, indoor: true });

/** Facing into a unit: the way back to its counter. */
const into = (id: string): number => {
  const u = ALCHEMIA_UNITS.find((x) => x.id === id)!;
  return OPEN_YAW[u.open] + Math.PI;
};

export const FOODHALL_CROWD: readonly CrowdSpot[] = [
  at(beforeKeeper("kenta", 0.9, 1.7), NORTH, ["eat"]),
  at(beforeKeeper("kenta", 0.9, -1.7), NORTH, ["eat", "talk"]),
  at(beforeKeeper("goro", 0.9, 1.8), NORTH, ["talk", "phone"]),
  at(beforeKeeper("sachiko", 0.9, 0.9), WEST, ["phone"]),
  at(atUnit("wok", 0.9, -1.5), into("wok"), ["eat"]),
  at(atUnit("thai", 0.9, 1.2), into("thai"), ["eat"]),
  at(atUnit("greek", 0.9, -1.2), into("greek"), ["eat", "talk"]),
  at(atUnit("cafe", 0.9, 0.8), into("cafe"), ["drink"]),
  // At the tables, on their benches: two by the aisle, two at the far ends.
  at(onFloor(414, 41.35), NORTH, ["sit"]),
  at(onFloor(421.5, 43.65), SOUTH, ["sit"]),
  at(onFloor(412, 47.65), SOUTH, ["sit"]),
  at(onFloor(423.5, 45.35), NORTH, ["sit"]),
];

/**
 * The people of P-1 (ADR-0074 stage 4): the attendant at the console by the hand-over cabins, a
 * technician at a charger on the deck, a guard by the door to the hall. Residents of the crowd,
 * not keyed: nobody to talk to, as the hall's customers.
 */
/** The third bay of the deck's west row: a charger at its head and no car in it. */
const CHARGER = P1_BAYS[2]!;
export const PARKING_CROWD: readonly CrowdSpot[] = [
  at(onFloor(P1_CONSOLE.x1 + 0.45, (P1_CONSOLE.z0 + P1_CONSOLE.z1) / 2), WEST, ["terminal"]),
  at(onFloor(CHARGER.at.x - 1.6, CHARGER.at.z), WEST, ["terminal", "phone"]),
  at(onFloor(409.2, 30.2), EAST, ["guard"]),
];
