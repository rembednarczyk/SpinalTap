import type { ActivityId } from "@seki/core";
import type { ActivitySpot, SpotKind } from "../world/activity-types";
import { type StaticProp, v } from "./builders";
import { TARG_NORTH_PROPS, TARG_SOUTH_PROPS } from "./district-targ";

/**
 * Activity spots (smart spots) of the districts (ADR-0040): a bench to sit on, a wall to lean
 * against, a vending machine, a food stall, a bar counter. Background passers-by walk between
 * them on a routine; each spot says where the feet stand and which way the character faces.
 * Kept apart from the district tables, so the districts' own content and ids stay as they were.
 * Every spot stands on the ground floor, clear of solids and of the named characters' places.
 */

/** What a character does at each kind of spot (a spot may narrow it with `only`). */
export const SPOT_ACTIVITIES: Readonly<Record<SpotKind, readonly [ActivityId, ...ActivityId[]]>> = {
  bench: ["sit"],
  wall: ["lean", "smoke", "phone"],
  vending: ["drink"],
  stall: ["eat"],
  bar: ["drink", "talk"],
};

/**
 * How much a passer-by wants each kind of spot by the hour: bars at night, vending machines in
 * the morning, the stalls at lunch and in the evening. Weights, not probabilities.
 */
export const SPOT_WEIGHTS: readonly { readonly from: number; readonly weights: Readonly<Record<SpotKind, number>> }[] = [
  { from: 0, weights: { bar: 5, stall: 1, wall: 2, bench: 1, vending: 1 } },
  { from: 5, weights: { bar: 0, stall: 1, wall: 2, bench: 2, vending: 5 } },
  { from: 11, weights: { bar: 0, stall: 4, wall: 2, bench: 2, vending: 2 } },
  { from: 17, weights: { bar: 2, stall: 4, wall: 2, bench: 1, vending: 1 } },
  { from: 20, weights: { bar: 5, stall: 1, wall: 2, bench: 1, vending: 1 } },
];

/** Weights in force at `hour` (0..23). */
export const spotWeightsAt = (hour: number): Readonly<Record<SpotKind, number>> => {
  let out = SPOT_WEIGHTS[0]?.weights ?? { bar: 1, stall: 1, wall: 1, bench: 1, vending: 1 };
  for (const w of SPOT_WEIGHTS) if (w.from <= hour) out = w.weights;
  return out;
};

/** X of the food stalls' counters in a row at `z` (the market's generator placed them). */
const stallsAt = (props: readonly StaticProp[], z: number): number[] =>
  props.flatMap((p) => (p.view.kind === "block" && p.solid && p.center.z === z && p.view.size.x === 2.6 && p.view.size.z === 1.3 ? [p.center.x] : []));

const spot = (id: string, chunk: string, kind: SpotKind, x: number, z: number, yaw: number, only?: readonly [ActivityId, ...ActivityId[]]): ActivitySpot =>
  only ? { id, chunk, kind, at: v(x, 0, z), yaw, only } : { id, chunk, kind, at: v(x, 0, z), yaw };

/** On the open quay there is nothing to lean on. */
const STANDING: readonly [ActivityId, ...ActivityId[]] = ["smoke", "phone"];

const EAST = Math.PI / 2;
const WEST = -Math.PI / 2;
const NORTH = 0;
const SOUTH = Math.PI;

/** Shinsekai 7: the main street, X ∈ [-7, 7]. Kept off Kaito's corner, the clinic door and the alley. */
const SHINSEKAI: readonly ActivitySpot[] = [
  spot("s7-koi-wall", "shinsekai-7", "wall", 6.5, -4.5, WEST),
  spot("s7-tower-wall", "shinsekai-7", "wall", 6.5, -19.5, WEST),
  spot("s7-hotel-wall", "shinsekai-7", "wall", -6.5, -5, EAST),
  spot("s7-ramen", "shinsekai-7", "stall", -6.5, 9.5, WEST),
  spot("s7-ramen-bar", "shinsekai-7", "bar", -6.5, 12.8, WEST),
  spot("s7-pachinko-vending", "shinsekai-7", "vending", -6.5, 21, WEST),
  spot("s7-kusuri-bench", "shinsekai-7", "bench", 6.5, 22, WEST),
  spot("s7-kusuri-vending", "shinsekai-7", "vending", 6.5, 17, EAST),
];

/** Ulica Kanałowa: the bend by SAKE, both kerbs of segment B. Clear of the footbridge stairs and the van. */
const KANAL: readonly ActivitySpot[] = [
  spot("kanal-sake-bar", "kanal", "bar", 9.45, 61.2, EAST),
  spot("kanal-karaoke-bar", "kanal", "bar", 18, 81.5, NORTH),
  spot("kanal-south-wall", "kanal", "wall", 22, 74.5, NORTH),
  spot("kanal-north-wall", "kanal", "wall", 36, 81.5, SOUTH),
  spot("kanal-vending", "kanal", "vending", 38, 74.5, SOUTH),
  spot("kanal-bench", "kanal", "bench", 64, 74.5, NORTH),
];

const SOUTH_STALLS = stallsAt(TARG_SOUTH_PROPS, 68);
const NORTH_STALLS = stallsAt(TARG_NORTH_PROPS, 102);

/**
 * The market: in front of the stalls of both rows (the south row's customers face south, the
 * north row's north), the TAKO and PACHI facades on the east side, a pillar under the deck.
 */
const TARG: readonly ActivitySpot[] = [
  ...SOUTH_STALLS.slice(1, 3).map((x, i) => spot(`targ-south-stall-${i}`, "targ-south", "stall", x, 69.1, SOUTH)),
  spot("targ-tako-bar", "targ-south", "bar", 113.5, 66.5, EAST),
  spot("targ-tako-vending", "targ-south", "vending", 113.5, 71, EAST),
  spot("targ-pachi-wall", "targ-south", "wall", 113.5, 81, WEST),
  ...NORTH_STALLS.slice(0, 1).map((x) => spot("targ-north-stall", "targ-north", "stall", x, 100.9, NORTH)),
  ...NORTH_STALLS.slice(2, 3).map((x) => spot("targ-yatai-bar", "targ-north", "bar", x, 100.9, NORTH)),
  spot("targ-pillar-wall", "targ-north", "wall", 96, 94.3, SOUTH),
  spot("targ-north-vending", "targ-north", "vending", 110, 105.55, NORTH),
  spot("targ-north-bench", "targ-north", "bench", 84, 105.55, SOUTH),
];

/** The docks: the vending machine by the office, the open quay. Tessen's yard has no idlers. */
const DOKI: readonly ActivitySpot[] = [
  spot("doki-vending", "doki-quay", "vending", -24, 126.75, NORTH),
  spot("doki-quay-wall", "doki-quay", "wall", 2, 128.5, SOUTH, STANDING),
  spot("doki-fence-wall", "doki-quay", "wall", -10, 141, NORTH, STANDING),
];

export const ACTIVITY_SPOTS: readonly ActivitySpot[] = [...SHINSEKAI, ...KANAL, ...TARG, ...DOKI];

/** Most background passers-by a chunk ever holds (ADR-0040's budget). */
export const MAX_PASSERSBY_PER_CHUNK = 3;

/** Background passers-by per chunk, in the chunk table's order. Capped by MAX_PASSERSBY_PER_CHUNK. */
export const PASSERSBY: Readonly<Record<string, number>> = {
  "shinsekai-7": 3,
  kanal: 3,
  "targ-south": 2,
  "targ-north": 2,
  "doki-quay": 1,
};
