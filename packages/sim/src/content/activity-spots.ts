import type { ActivityId, Vec3 } from "@seki/core";
import type { ActivitySpot, SpotKind } from "../world/activity-types";
import { type StaticProp, placeAt, v } from "./builders";
import { TARG_NORTH_PROPS, TARG_SOUTH_PROPS } from "./district-targ";
import { againstWall, spotNear } from "./lublin/places";
import { DOCKS_PLACE, MAP_CHUNKS, MARKET_PLACE } from "./lublin/sites";
import { seatGroups } from "./lublin/seats";
import { groundY } from "./lublin/terrain";
import { WORLD_STREET_PROPS } from "./world-map";

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

/** X of the food stalls' counters in a row at local `z` (the market's generator placed them), in the world. */
const stallsAt = (props: readonly StaticProp[], z: number): number[] =>
  props.flatMap((p) => (p.view.kind === "block" && p.solid && p.center.z === z + MARKET_PLACE.z && p.view.size.x === 2.6 && p.view.size.z === 1.3 ? [p.center.x] : []));

/** The chunk of Lublin a spot stands in (the first holding it, as streaming does). */
const chunkOf = (x: number, z: number): string =>
  MAP_CHUNKS.find((c) => x >= c.bounds.minX && x <= c.bounds.maxX && z >= c.bounds.minZ && z <= c.bounds.maxZ)?.id ?? "";

const spotAt = (id: string, kind: SpotKind, at: Vec3, yaw: number, only?: readonly [ActivityId, ...ActivityId[]]): ActivitySpot => {
  const chunk = chunkOf(at.x, at.z);
  return only ? { id, chunk, kind, at, yaw, only } : { id, chunk, kind, at, yaw };
};

/** Benches of the map's furniture are this close to a hand-placed bench spot to take it over (m). */
const BENCH_SNAP = 12;

/**
 * A bench spot on the map's nearest real bench (ADR-0050): its middle seat, facing its front,
 * or the hand-placed point when there is no bench near.
 */
const benchSpot = (id: string, x: number, z: number, yaw: number): ActivitySpot => {
  let best: { x: number; z: number; yaw: number } | null = null;
  let bestD = BENCH_SNAP;
  for (const items of Object.values(WORLD_STREET_PROPS)) {
    for (const i of items) {
      if (i.prop !== "bench") continue;
      const d = Math.hypot(i.x - x, i.z - z);
      if (d >= bestD) continue;
      const seats = seatGroups(i)[0] ?? [];
      const seat = seats[Math.floor(seats.length / 2)];
      if (!seat) continue;
      bestD = d;
      best = seat;
    }
  }
  return best ? spotAt(id, "bench", { x: best.x, y: groundY(best.x, best.z), z: best.z }, best.yaw) : spotAt(id, "bench", spotNear(x, z), yaw);
};

/** A spot against the facade nearest to (x, z), facing away from it. */
const wallSpot = (id: string, kind: SpotKind, x: number, z: number, only?: readonly [ActivityId, ...ActivityId[]], off = 0.55): ActivitySpot => {
  const w = againstWall(x, z, off);
  return spotAt(id, kind, w.at, w.yaw, only);
};

/** A spot of the market or the docks, in their own coordinates. */
const marketSpot = (id: string, kind: SpotKind, x: number, z: number, yaw: number): ActivitySpot => spotAt(id, kind, placeAt(MARKET_PLACE, v(x, 0, z)), yaw);
const docksSpot = (id: string, kind: SpotKind, x: number, z: number, yaw: number, only?: readonly [ActivityId, ...ActivityId[]]): ActivitySpot =>
  spotAt(id, kind, placeAt(DOCKS_PLACE, v(x, 0, z)), yaw, only);

/** On the open quay there is nothing to lean on. */
const STANDING: readonly [ActivityId, ...ActivityId[]] = ["smoke", "phone"];

const EAST = Math.PI / 2;
const WEST = -Math.PI / 2;
const NORTH = 0;
const SOUTH = Math.PI;

/**
 * Krakowskie Przedmieście: the shop fronts of the deptak round the clinic and Neon Koi, kept
 * off Kaito's counter, the doors and Ume; the benches of Plac Litewski.
 */
const KRAKOWSKIE: readonly ActivitySpot[] = [
  wallSpot("s7-koi-wall", "wall", 309, -93),
  // Neon Koi's doorway shell stands a little proud of the facade.
  wallSpot("s7-tower-wall", "wall", 323, -93, undefined, 0.85),
  wallSpot("s7-hotel-wall", "wall", 336, -76),
  wallSpot("s7-ramen", "stall", 314, -73.5),
  wallSpot("s7-ramen-bar", "bar", 316.6, -73.5),
  wallSpot("s7-pachinko-vending", "vending", 304, -72.4),
  wallSpot("s7-kusuri-vending", "vending", 300.5, -93),
  benchSpot("pl-bench-1", 62, -31, NORTH),
  benchSpot("pl-bench-2", 80, -33, NORTH),
  benchSpot("pl-bench-3", 100, -37, NORTH),
  benchSpot("pl-bench-4", 118, -41, WEST),
];

/** Stare Miasto: the Rynek round the Trybunał, the corner of Grodzka. */
const KANAL: readonly ActivitySpot[] = [
  wallSpot("kanal-sake-bar", "bar", 541, -68),
  wallSpot("kanal-karaoke-bar", "bar", 560, -36),
  wallSpot("kanal-south-wall", "wall", 600, -95),
  wallSpot("kanal-north-wall", "wall", 530, -53),
  wallSpot("kanal-vending", "vending", 594, -17),
  benchSpot("kanal-bench", 585, -88, WEST),
];

const SOUTH_STALLS = stallsAt(TARG_SOUTH_PROPS, 68);
const NORTH_STALLS = stallsAt(TARG_NORTH_PROPS, 102);

/**
 * The market: in front of the stalls of both rows (the south row's customers face south, the
 * north row's north), the TAKO and PACHI facades on the east side, a pillar under the viaduct.
 */
const TARG: readonly ActivitySpot[] = [
  ...SOUTH_STALLS.slice(1, 3).map((x, i) => spotAt(`targ-south-stall-${i}`, "stall", placeAt(MARKET_PLACE, v(x - MARKET_PLACE.x, 0, 69.1)), SOUTH)),
  marketSpot("targ-tako-bar", "bar", 113.5, 66.5, EAST),
  marketSpot("targ-tako-vending", "vending", 113.5, 71, EAST),
  marketSpot("targ-pachi-wall", "wall", 113.5, 81, WEST),
  ...NORTH_STALLS.slice(0, 1).map((x) => spotAt("targ-north-stall", "stall", placeAt(MARKET_PLACE, v(x - MARKET_PLACE.x, 0, 100.9)), NORTH)),
  ...NORTH_STALLS.slice(2, 3).map((x) => spotAt("targ-yatai-bar", "bar", placeAt(MARKET_PLACE, v(x - MARKET_PLACE.x, 0, 100.9)), NORTH)),
  marketSpot("targ-pillar-wall", "wall", 96, 94.3, SOUTH),
  marketSpot("targ-north-vending", "vending", 110, 105.55, NORTH),
  marketSpot("targ-north-bench", "bench", 84, 105.55, SOUTH),
];

/** The docks: the vending machine by the office, the open quay. Tessen's yard has no idlers. */
const DOKI: readonly ActivitySpot[] = [
  docksSpot("doki-vending", "vending", -24, 126.75, NORTH),
  docksSpot("doki-quay-wall", "wall", 2, 128.5, SOUTH, STANDING),
  docksSpot("doki-fence-wall", "wall", -10, 141, NORTH, STANDING),
];

export const ACTIVITY_SPOTS: readonly ActivitySpot[] = [...KRAKOWSKIE, ...KANAL, ...TARG, ...DOKI];

/** Most background passers-by a chunk ever holds (ADR-0040's budget). */
export const MAX_PASSERSBY_PER_CHUNK = 3;

/** Background passers-by per chunk, in the chunk table's order. Capped by MAX_PASSERSBY_PER_CHUNK. */
export const PASSERSBY: Readonly<Record<string, number>> = {
  "krakowskie-1-0": 2,
  "krakowskie-2-0": 3,
  "stare-miasto-0-0": 3,
  "stare-miasto-0-1": 1,
  "podzamcze-1-0": 3,
  "nabrzeze-1-1": 1,
};
