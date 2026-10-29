import { type ActivityId, type EntityId, type GameClock, type RandomPort, SECONDS_PER_DAY, SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from "@seki/core";
import { ACTIVITY_SPOTS, SPOT_ACTIVITIES, spotWeightsAt } from "../content/activity-spots";
import { deriveRandom } from "../rng/derive-random";
import type { ActivitySpot } from "./activity-types";
import type { Entity } from "./components";
import { BODY } from "./factory";

/**
 * Routines of the background passers-by (ADR-0040). The day is cut into slots; in each slot
 * every passer-by of a chunk has its own spot, drawn from a random stream derived from the
 * seed, the chunk and the slot, with the kinds of spot weighted by the hour (bars at night,
 * vending machines in the morning). Nothing here is stored: the same seed and clock always
 * give the same plan, so a loaded game puts everyone back where the routine says.
 */

/** Game seconds a passer-by spends on one leg of its routine: the walk there and the stay. */
export const ROUTINE_SLOT_SECONDS = 45 * SECONDS_PER_MINUTE;

export interface RoutineStop {
  readonly spot: ActivitySpot;
  readonly activity: ActivityId;
}

const spotsByChunk = new Map<string, readonly ActivitySpot[]>();

/** The activity spots of a chunk, in table order. */
export const spotsOf = (chunk: string): readonly ActivitySpot[] => {
  let out = spotsByChunk.get(chunk);
  if (!out) {
    out = ACTIVITY_SPOTS.filter((s) => s.chunk === chunk);
    spotsByChunk.set(chunk, out);
  }
  return out;
};

/** Picks one entry by weight; with every weight 0, any of them. */
const pickWeighted = <T>(rng: RandomPort, items: readonly T[], weight: (t: T) => number): number => {
  const total = items.reduce((sum, t) => sum + weight(t), 0);
  if (total <= 0) return Math.min(items.length - 1, Math.floor(rng.next() * items.length));
  let roll = rng.next() * total;
  for (let i = 0; i < items.length; i++) {
    const item = items[i] as T;
    roll -= weight(item);
    if (roll < 0) return i;
  }
  return items.length - 1;
};

/**
 * Where the `count` passers-by of `chunk` spend slot `slot` and what they do there: distinct
 * spots while there are enough. A pure function of its arguments.
 */
export const routineOf = (seed: number, chunk: string, count: number, slot: number, spots: readonly ActivitySpot[] = spotsOf(chunk)): RoutineStop[] => {
  if (spots.length === 0) return [];
  const rng = deriveRandom(seed, `passersby:${chunk}:${slot}`);
  const hour = Math.floor((((slot * ROUTINE_SLOT_SECONDS) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY / SECONDS_PER_HOUR);
  const weights = spotWeightsAt(hour);
  let free = [...spots];
  const out: RoutineStop[] = [];
  for (let i = 0; i < count; i++) {
    if (free.length === 0) free = [...spots];
    const spot = free.splice(pickWeighted(rng, free, (s) => weights[s.kind]), 1)[0] as ActivitySpot;
    const choices = spot.only ?? SPOT_ACTIVITIES[spot.kind];
    const activity = choices[Math.min(choices.length - 1, Math.floor(rng.next() * choices.length))] ?? choices[0];
    out.push({ spot, activity });
  }
  return out;
};

/**
 * The routine slot at the clock's time. Everyone of a chunk changes spots at the same moment,
 * so two of them never head for one spot; they still arrive one by one (different walks, speeds).
 */
export const slotOf = (clock: GameClock): number => Math.floor(clock.seconds / ROUTINE_SLOT_SECONDS);

const memo = new Map<string, RoutineStop[]>();
const MEMO_SIZE = 64;

/** The stop of passer-by `index` of `chunk` at the clock's time. Memoised; a miss gives what a hit would. */
export const passerbyStop = (seed: number, chunk: string, index: number, count: number, clock: GameClock): RoutineStop | null => {
  const slot = slotOf(clock);
  const key = `${seed}:${chunk}:${count}:${slot}`;
  let plan = memo.get(key);
  if (!plan) {
    plan = routineOf(seed, chunk, count, slot);
    memo.set(key, plan);
    if (memo.size > MEMO_SIZE) memo.delete(memo.keys().next().value ?? key);
  }
  return plan[index] ?? null;
};

/**
 * A background passer-by standing at its stop: a bystander that reacts to the street like
 * any other, without health or a key. It neither witnesses crimes nor pushes anyone, so it
 * cannot change the saved state (ADR-0040).
 */
export const passerbyEntity = (id: EntityId, chunk: string, index: number, stop: RoutineStop): Entity => {
  const p = stop.spot.at;
  return {
    id,
    chunk,
    position: p,
    prevPosition: p,
    yaw: stop.spot.yaw,
    prevYaw: stop.spot.yaw,
    pitch: 0,
    body: BODY,
    view: { kind: "npc", preset: "civilian" },
    faction: "civilians",
    velocity: { x: 0, y: 0, z: 0 },
    civilian: { home: p },
    passerby: { chunk, index, goal: p, yaw: stop.spot.yaw, activity: stop.activity, waypoint: null, repath: 0 },
  };
};
