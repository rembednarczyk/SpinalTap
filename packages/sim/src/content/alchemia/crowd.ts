import type { ActivityId, Vec3 } from "@seki/core";
import type { CrowdSpot } from "../crowd-spot";
import { EAST, NORTH, SOUTH, WEST, onFloor } from "./plan";
import { P1_CONSOLE, P1_BAYS } from "./parking";
import { OPEN_YAW, ALCHEMIA_UNITS, atUnit, beforeKeeper, onP3 } from "./units";
import { FUMIKO_STOOLS, TABLE_GROUPS, groupParts } from "./foodhall-seating";

/**
 * The food hall's still crowd (ADR-0060, ADR-0074 §3), on P3 with its units since ADR-0093 O3:
 * customers at the counters of the open units, people eating at the shared tables and on Fumiko's
 * stools. Indoors (no umbrellas), out of the keepers' places, the aisles and the escalators' landing.
 * The passers-by's spots stay outside on T1 (`activity-spots.ts`): nobody walks into the hall on a
 * routine, the doors being the level graph's.
 */

const CHUNK = "krakowskie-2-1";

const at = (p: Vec3, yaw: number, does: readonly [ActivityId, ...ActivityId[]]): CrowdSpot => ({ chunk: CHUNK, at: p, yaw, does, indoor: true });

/** Facing into a unit: the way back to its counter. */
const into = (id: string): number => {
  const u = ALCHEMIA_UNITS.find((x) => x.id === id)!;
  return OPEN_YAW[u.open] + Math.PI;
};

/** On a group's bench, `a` (its low side) or `b`, `along` from its start, facing the table. */
const onBench = (g: number, side: "a" | "b", along: number): CrowdSpot => {
  const group = TABLE_GROUPS[g]!;
  const b = groupParts(group)[side];
  const alongZ = group.along === "z";
  const p = alongZ ? onP3((b.x0 + b.x1) / 2, b.z0 + along) : onP3(b.x0 + along, (b.z0 + b.z1) / 2);
  const yaw = alongZ ? (side === "a" ? EAST : WEST) : side === "a" ? NORTH : SOUTH;
  return at(p, yaw, ["sit"]);
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
  // At the tables, on their benches: the west strip's, the east one's, the south seating's, the corner before Fumiko's bar.
  onBench(0, "a", 0.9),
  onBench(1, "b", 2.0),
  onBench(2, "a", 1.0),
  onBench(3, "b", 0.7),
  // On the bench by the door into L3 (ADR-0093 O5: the lift's lobby's side is a wall's breadth off), and at the pair moved into L3.
  onBench(5, "b", 0.9),
  onBench(6, "a", 2.2),
  onBench(7, "a", 1.0),
  // On a stool at Fumiko's bar.
  at(onP3(404.75, FUMIKO_STOOLS[1]!), WEST, ["sit"]),
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
