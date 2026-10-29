import { type ActivityId, type EntityId, GAME_SECONDS_PER_REAL_SECOND, type GameClock, type Vec3, hourOf } from "@seki/core";
import { CROWD_BY_HOUR, CROWD_CHUNKS, CROWD_LANES, CROWD_SPOTS, type CrowdLane, type CrowdSpot } from "../content/crowd";
import { deriveRandom } from "../rng/derive-random";
import type { LaneWalk } from "./activity-types";
import type { Entity } from "./components";
import { type LanePoint, laneGeom, lanePoint } from "./crowd-lanes";
import { BODY } from "./factory";
import { ROUTINE_SLOT_SECONDS } from "./passersby";

/**
 * The residents of the city (ADR-0041). How many a chunk holds is a function of the hour, the
 * district and the cap of the crowd density; who each one is (a walker on a route or someone
 * standing at a spot, its look) is a function of the seed, the chunk and its index alone, so
 * the crowd thins and fills by the hour without anyone changing roles. Nothing here is saved.
 */

/** Residents' ids live far above the content's, so reserving them shifts no id of the world. */
export const CROWD_ID_BASE = 1_000_000;
/** Ids per chunk; more than any cap. */
const IDS_PER_CHUNK = 1_000;

/** Walkers keep left: each way round a lane walks this far to its own left of the line (m). */
export const LANE_HALF_GAP = 0.28;

export type ResidentRole =
  | { readonly kind: "walker"; readonly lane: CrowdLane; readonly phase: number; readonly speed: number; readonly dir: 1 | -1 }
  | { readonly kind: "stander"; readonly spot: CrowdSpot };

export interface ResidentPlan {
  readonly chunk: string;
  readonly index: number;
  readonly look: number;
  readonly umbrella: boolean;
  readonly role: ResidentRole;
}

/** Id of resident `index` of the chunk at position `chunkOrder` in the chunk table. */
export const residentId = (chunkOrder: number, index: number): EntityId => CROWD_ID_BASE + chunkOrder * IDS_PER_CHUNK + index;

/** Residents of `chunk` at the clock's hour with at most `cap` per chunk. */
export const crowdCount = (chunk: string, cap: number, clock: GameClock): number => {
  const c = CROWD_CHUNKS[chunk];
  if (!c || cap <= 0) return 0;
  const level = CROWD_BY_HOUR[c.profile]?.[hourOf(clock)] ?? 0;
  return Math.min(cap, Math.round(cap * c.share * level));
};

const lanesOf = (chunk: string): CrowdLane[] => CROWD_LANES.filter((l) => l.chunk === chunk);
const spotsOf = (chunk: string): CrowdSpot[] => CROWD_SPOTS.filter((s) => s.chunk === chunk);

/**
 * Which spot a stander takes: two of every five residents stand while there are spots (ADR-0050,
 * the second and the fourth), the rest walk; without a route all stand. -1 for a walker.
 */
const standerRank = (index: number, lanes: number, spots: number): number => {
  if (lanes === 0) return index < spots ? index : -1;
  const k = index % 5;
  if (k !== 1 && k !== 3) return -1;
  const rank = Math.floor(index / 5) * 2 + (k === 3 ? 1 : 0);
  return rank < spots ? rank : -1;
};

const isStander = (index: number, lanes: number, spots: number): boolean => standerRank(index, lanes, spots) >= 0;

const orders = new Map<string, CrowdSpot[]>();

/** The spots of a chunk in an order of the seed's, so each game has its own corners taken. */
const spotOrder = (seed: number, chunk: string, spots: readonly CrowdSpot[]): CrowdSpot[] => {
  const known = orders.get(`${seed}:${chunk}`);
  if (known) return known;
  const rng = deriveRandom(seed, `crowd-spots:${chunk}`);
  // Groups (a bench's seats, a kiosk's queue) move as one, so standers fill them together.
  const groups: CrowdSpot[][] = [];
  const byKey = new Map<string, CrowdSpot[]>();
  for (const s of spots) {
    const g = s.group === undefined ? undefined : byKey.get(s.group);
    if (g) g.push(s);
    else {
      const fresh = [s];
      groups.push(fresh);
      if (s.group !== undefined) byKey.set(s.group, fresh);
    }
  }
  for (let i = groups.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [groups[i], groups[j]] = [groups[j] as CrowdSpot[], groups[i] as CrowdSpot[]];
  }
  const out = groups.flat();
  orders.set(`${seed}:${chunk}`, out);
  return out;
};

/** Golden ratio's fractional part: walkers of one way round a lane spread evenly for any count. */
const SPREAD = 0.618034;

const walkerRole = (seed: number, lanes: readonly CrowdLane[], ordinal: number): ResidentRole => {
  const lane = lanes[ordinal % lanes.length] as CrowdLane;
  const dir: 1 | -1 = Math.floor(ordinal / lanes.length) % 2 === 0 ? 1 : -1;
  const rank = Math.floor(ordinal / (2 * lanes.length));
  // One speed per way round a lane: nobody catches up with the one ahead.
  const group = deriveRandom(seed, `crowd-lane:${lane.id}:${dir}`);
  const start = group.next();
  const speed = 1.05 + group.next() * 0.3;
  const phase = laneGeom(lane).length * ((start + rank * SPREAD) % 1);
  return { kind: "walker", lane, phase, speed, dir };
};

const plans = new Map<string, ResidentPlan | null>();

/** Who resident `index` of `chunk` is in the game of `seed`: role, look, umbrella. Memoised. */
export const residentOf = (seed: number, chunk: string, index: number): ResidentPlan | null => {
  const key = `${seed}:${chunk}:${index}`;
  const known = plans.get(key);
  if (known !== undefined) return known;
  const lanes = lanesOf(chunk);
  const spots = spotsOf(chunk);
  let role: ResidentRole | null = null;
  if (isStander(index, lanes.length, spots.length)) {
    const spot = spotOrder(seed, chunk, spots)[standerRank(index, lanes.length, spots.length)];
    if (spot) role = { kind: "stander", spot };
  } else if (lanes.length > 0) {
    let standers = 0;
    for (let i = 0; i < index; i++) if (isStander(i, lanes.length, spots.length)) standers++;
    role = walkerRole(seed, lanes, index - standers);
  }
  const rng = deriveRandom(seed, `crowd-look:${chunk}:${index}`);
  const look = Math.floor(rng.next() * 0x7fffffff);
  const indoor = role?.kind === "stander" && role.spot.indoor === true;
  const plan = role ? { chunk, index, look, umbrella: !indoor && rng.next() < 0.35, role } : null;
  plans.set(key, plan);
  return plan;
};

/** Real seconds since clock zero: walkers move in real time, as everyone else does. */
export const realSeconds = (clock: GameClock): number => clock.seconds / GAME_SECONDS_PER_REAL_SECOND;

/** Where on its lane a walker should be now: the lane point, its own side of the line, the way it goes. */
export const laneTarget = (lane: CrowdLane, walk: Pick<LaneWalk, "phase" | "speed" | "dir" | "shift">, clock: GameClock, aside = 0): LanePoint => {
  const g = laneGeom(lane);
  const p = lanePoint(g, walk.phase + walk.dir * walk.speed * realSeconds(clock) + walk.shift);
  const tx = p.tx * walk.dir;
  const tz = p.tz * walk.dir;
  // Left of the way it walks (+Z north, +X east): heading north, left is west.
  const off = LANE_HALF_GAP + aside;
  return { x: p.x - tz * off, z: p.z + tx * off, tx, tz };
};

/** What a stander does in the routine slot of the clock: one of its spot's activities. */
export const standerActivity = (seed: number, plan: ResidentPlan, clock: GameClock): ActivityId => {
  if (plan.role.kind !== "stander") return "talk";
  const does = plan.role.spot.does;
  const slot = Math.floor(clock.seconds / ROUTINE_SLOT_SECONDS);
  const rng = deriveRandom(seed, `crowd-do:${plan.chunk}:${plan.index}:${slot}`);
  return does[Math.min(does.length - 1, Math.floor(rng.next() * does.length))] ?? does[0];
};

/** A resident where its plan puts it at the clock's time: unkeyed, unsaved, a bystander like the passers-by. */
export const residentEntity = (id: EntityId, seed: number, plan: ResidentPlan, clock: GameClock, groundY: (x: number, z: number) => number = () => 0): Entity => {
  const role = plan.role;
  let at: Vec3;
  let yaw: number;
  let lane: LaneWalk | undefined;
  if (role.kind === "walker") {
    lane = { lane: role.lane.id, phase: role.phase, speed: role.speed, dir: role.dir, shift: 0, avoid: 0, rejoin: null };
    const t = laneTarget(role.lane, lane, clock);
    // On the ground of the route's point (the terrain of ADR-0043; 0 on the old flat street).
    at = { x: t.x, y: groundY(t.x, t.z), z: t.z };
    yaw = Math.atan2(t.tx, t.tz);
  } else {
    at = { ...role.spot.at };
    yaw = role.spot.yaw;
  }
  const activity = standerActivity(seed, plan, clock);
  return {
    id,
    chunk: plan.chunk,
    position: at,
    prevPosition: at,
    yaw,
    prevYaw: yaw,
    pitch: 0,
    body: BODY,
    view: { kind: "crowd", look: plan.look, umbrella: plan.umbrella },
    faction: "civilians",
    velocity: { x: 0, y: 0, z: 0 },
    civilian: { home: at },
    passerby: { chunk: plan.chunk, index: plan.index, goal: at, yaw, activity, waypoint: null, repath: 0, ...(lane ? { lane } : {}) },
  };
};

/** The lane of a walker, by id. */
export const crowdLane = (id: string): CrowdLane | undefined => CROWD_LANES.find((l) => l.id === id);
