import type { ActivityId, Vec3 } from "@seki/core";
import type { CrowdSpot } from "../crowd-spot";
import { NORTH, SOUTH, onFloor } from "./plan";
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
  at(beforeKeeper("sachiko", 0.9, 0.9), SOUTH, ["phone"]),
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
