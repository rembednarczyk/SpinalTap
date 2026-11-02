import type { RenderQuality } from "../../npr/quality";
import { propHash } from "../city-props";
import type { P2 } from "../mapcity/polygon";
import { DRONE_SIZE } from "./drone-flight";

/**
 * The low patrols over the pedestrian streets (ADR-0058 stage 7b): police drones that come down
 * from over the roofs, fly a street a few metres over the heads with their searchlight on the
 * paving, hang there a while and climb away again, then stay away a while. Visual only, nothing in
 * the simulation: the time is the renderer's own, frozen in the reference still. Pure.
 */

/** The patrol drone of `drone-props.glb` at this scale: a small one for the narrow streets. */
export const PATROL_SCALE = 0.6;
const BASE = DRONE_SIZE.patrol;
/** Its box (m), foot at the flight level, centred across and along. */
export const PATROL_SIZE = { width: BASE.width * PATROL_SCALE, height: BASE.height * PATROL_SCALE, length: BASE.length * PATROL_SCALE } as const;
/** Its reach round its middle: half its box's diagonal (m). */
export const PATROL_REACH = Math.hypot(PATROL_SIZE.width, PATROL_SIZE.length) / 2;
/** Its foot over the paving on a lane (m): 4.6 to 5.35 m with the box, bobbing included 4.5 to 5.45 m. */
export const PATROL_ALTITUDE = 4.6;
/** Where it comes from and climbs to over the street (m): under the canyon drones' 22 m (ADR-0058 stage 7). */
export const PATROL_CEILING = 18;
/** Bobbing up and down (m) over `BOB_PERIOD` seconds. */
export const PATROL_BOB = 0.1;
const BOB_PERIOD = 2.6;
/** Speeds (m/s): along the lane, and down and up. */
export const PATROL_SPEED = 3.5;
export const PATROL_CLIMB = 2.5;
/** The searchlight shows from this far over the paving (m) down. */
export const BEAM_FROM = 8;
/** The sway of its heading while it hangs over the street (rad), over this period (s). */
export const HOVER_SWAY = 0.35;
const SWAY_PERIOD = 7;

/** How many patrols, and how many of them over the Old Town, per quality; phones get none. */
export const PATROL_COUNT: Readonly<Record<RenderQuality, { readonly total: number; readonly quiet: number }>> = {
  high: { total: 10, quiet: 3 },
  medium: { total: 5, quiet: 2 },
  low: { total: 0, quiet: 0 },
};

/** Seconds away between two flights: long over the Old Town, short over the deptak and the squares. */
export const PATROL_PAUSE: Readonly<Record<"quiet" | "busy", readonly [number, number]>> = { quiet: [45, 180], busy: [10, 45] };
/** Seconds hanging over the street on a flight. */
export const PATROL_HOVER: readonly [number, number] = [8, 16];

/** A lane of the low patrols: its axis every few metres, the paving's height under each point, and where it may hang. */
export interface PatrolLane {
  readonly points: readonly P2[];
  readonly grounds: readonly number[];
  readonly length: number;
  readonly seed: number;
  /** Over the Old Town: long pauses. */
  readonly quiet: boolean;
}

export interface Patrol {
  readonly lane: PatrolLane;
  /** Where on the lane it hangs on the way out (m from its start; on the way back as far from its end). */
  readonly hoverAt: number;
  readonly hover: number;
  /** Seconds away after the way out and after the way back. */
  readonly pauses: readonly [number, number];
  /** Where in its cycle it starts (s). */
  readonly offset: number;
  readonly bob: number;
}

export interface PatrolPose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  /** The paving under it, for the searchlight. */
  readonly ground: number;
  /** How large it is drawn (1: its size; less while it comes into sight or goes). */
  readonly scale: number;
}

const unit = (h: number, salt: number): number => (propHash(h, salt) % 10000) / 10000;
const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;

/** A lane's patrol: where it hangs, how long, its pauses and its start in the cycle, all from the lane's seed. */
export const patrolOf = (lane: PatrolLane): Patrol => {
  const h = lane.seed;
  const pause = PATROL_PAUSE[lane.quiet ? "quiet" : "busy"];
  const p: Patrol = { lane, hoverAt: lane.length * span([0.3, 0.7], unit(h, 1)), hover: span(PATROL_HOVER, unit(h, 2)), pauses: [span(pause, unit(h, 3)), span(pause, unit(h, 4))], offset: 0, bob: unit(h, 5) };
  return { ...p, offset: patrolCycle(p) * unit(h, 6) };
};

/** Seconds of one flight: down, along with its hover, up. */
const flightTime = (p: Patrol): number => (2 * (PATROL_CEILING - PATROL_ALTITUDE)) / PATROL_CLIMB + p.lane.length / PATROL_SPEED + p.hover;

/** Seconds of a patrol's cycle: out, away, back, away. */
export const patrolCycle = (p: Patrol): number => 2 * flightTime(p) + p.pauses[0] + p.pauses[1];

/** The patrols of the lanes for a quality: the longest lanes, `PATROL_COUNT.quiet` of them over the Old Town at most. */
export const patrolFleet = (lanes: readonly PatrolLane[], quality: RenderQuality): Patrol[] => {
  const { total, quiet } = PATROL_COUNT[quality];
  const longest = (l: readonly PatrolLane[]) => [...l].sort((a, b) => b.length - a.length || a.seed - b.seed);
  const old = longest(lanes.filter((l) => l.quiet)).slice(0, quiet);
  const busy = longest(lanes.filter((l) => !l.quiet)).slice(0, total - old.length);
  return [...old, ...busy].map(patrolOf);
};

/** The point of a lane `s` metres from its start (clamped to it), its direction and the paving there. */
export const patrolLaneAt = (lane: PatrolLane, s: number): { readonly p: P2; readonly dx: number; readonly dz: number; readonly ground: number } => {
  const last = lane.points.length - 1;
  const step = lane.length / last;
  const f = Math.max(0, Math.min(last, s / step));
  const i = Math.min(last - 1, Math.floor(f));
  const t = f - i;
  const a = lane.points[i] as P2;
  const b = lane.points[i + 1] as P2;
  const d = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const ga = lane.grounds[i] as number;
  const gb = lane.grounds[i + 1] as number;
  return { p: { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, dx: (b.x - a.x) / d, dz: (b.z - a.z) / d, ground: ga + (gb - ga) * t };
};

/** Along a flight `t` seconds in: how far along the lane (m), how high over the lane's level (m) and whether it hangs. */
const flightAt = (p: Patrol, t: number): { s: number; up: number; hovering: number | null } => {
  const fall = (PATROL_CEILING - PATROL_ALTITUDE) / PATROL_CLIMB;
  const L = p.lane.length;
  if (t < fall) return { s: 0, up: (fall - t) * PATROL_CLIMB, hovering: null };
  let u = t - fall;
  const toHover = p.hoverAt / PATROL_SPEED;
  if (u < toHover) return { s: u * PATROL_SPEED, up: 0, hovering: null };
  u -= toHover;
  if (u < p.hover) return { s: p.hoverAt, up: 0, hovering: u };
  u -= p.hover;
  const rest = (L - p.hoverAt) / PATROL_SPEED;
  if (u < rest) return { s: p.hoverAt + u * PATROL_SPEED, up: 0, hovering: null };
  return { s: L, up: Math.min(PATROL_CEILING - PATROL_ALTITUDE, (u - rest) * PATROL_CLIMB), hovering: null };
};

/** Where a patrol is at `time` seconds, or null while it is away. */
export const patrolPose = (p: Patrol, time: number): PatrolPose | null => {
  const cycle = patrolCycle(p);
  const flight = flightTime(p);
  let t = (((time + p.offset) % cycle) + cycle) % cycle;
  let back = false;
  if (t >= flight + p.pauses[0]) {
    t -= flight + p.pauses[0];
    back = true;
  }
  if (t >= flight) return null;
  const f = flightAt(p, t);
  const s = back ? p.lane.length - f.s : f.s;
  const at = patrolLaneAt(p.lane, s);
  const sway = f.hovering === null ? 0 : HOVER_SWAY * Math.sin((f.hovering / SWAY_PERIOD) * 2 * Math.PI);
  const heading = Math.atan2(at.dx, at.dz) + (back ? Math.PI : 0) + sway;
  const bob = PATROL_BOB * Math.sin(((time / BOB_PERIOD + p.bob) * 2 * Math.PI) % (2 * Math.PI));
  return { x: at.p.x, y: at.ground + PATROL_ALTITUDE + f.up + bob, z: at.p.z, yaw: heading, ground: at.ground, scale: 1 };
};
