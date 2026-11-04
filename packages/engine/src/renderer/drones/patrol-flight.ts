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
/**
 * The least height over the paving of its column over a lane's end (m). The planner sets two heights
 * there (`patrol-lanes.ts`): its roofs (`roofs`, over the roofs round the end and this much over the
 * paving at least), under which it climbs slowly, and its ceiling (`ceilings`, `PATROL_POP` over the
 * paving), where it comes into sight and goes. It climbs fast between them.
 */
export const PATROL_CEILING = 18;
/**
 * How high over the paving under its column a patrol comes into sight and goes, growing from nothing
 * and shrinking to it (m): so high that it takes under 2 px from anywhere on any street, whatever
 * way the camera looks. Its model is 2.3 m across its box's diagonal; on the reference screen
 * (1920 px across at 80 degrees, 16:9) that takes 2 px only 1.3 km off in the frame's middle and
 * 2.6 km off in its corner, where a small thing is drawn largest. The views draw it at no size past
 * its quality's draw distance, though (`PATROL_LOD`: 220 m at most, shrinking from 140 m on,
 * `patrolFade`): 400 m keeps it past that from every eye on the streets round it with some 180 m to
 * spare (more than the terrain round a column rises, or a wider draw distance would take), so it
 * comes and goes at no size at all and only its climb and its descent are seen. The glitch scan
 * (`drone-low-pop`) measures it from the model, from every street and square.
 */
export const PATROL_POP = 400;
/** Seconds it takes to come into sight at its ceiling (growing from nothing) and to go (shrinking). */
export const PATROL_APPEAR = 1.5;
/** Bobbing up and down (m) over `BOB_PERIOD` seconds. */
export const PATROL_BOB = 0.1;
const BOB_PERIOD = 2.6;
/** Speeds (m/s): along the lane, down and up under the roofs' height, and fast over it. */
export const PATROL_SPEED = 3.5;
export const PATROL_CLIMB = 4;
export const PATROL_SOAR = 10;
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

/**
 * The low patrols' (ADR-0058 stage 7b): where the far version takes over, how far they are drawn
 * and how many near and far at once. They fly over the heads: the near model shows further than a
 * canyon drone's.
 */
export const PATROL_LOD: Readonly<Record<RenderQuality, { readonly near: number; readonly draw: number; readonly nearSlots: number; readonly farSlots: number }>> = {
  high: { near: 70, draw: 220, nearSlots: 3, farSlots: 3 },
  medium: { near: 50, draw: 200, nearSlots: 2, farSlots: 2 },
  low: { near: 0, draw: 0, nearSlots: 0, farSlots: 0 },
};

/** Over this many metres short of its quality's draw distance a patrol shrinks to nothing, so it never pops out of sight. */
export const PATROL_FADE = 80;

/** How large a patrol is drawn at a distance (1 its size, 0 not drawn); `high` is the reference of `patrol-sight.ts`. */
export const patrolFade = (d: number, quality: RenderQuality = "high"): number => {
  const draw = PATROL_LOD[quality].draw;
  return Math.max(0, Math.min(1, (draw - d) / PATROL_FADE));
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
  /** Its share over a square's paving (0..1): over the Old Town the squares come first (the Rynek). */
  readonly square: number;
  /** Where its foot comes into sight and goes over its start and its end (y, m). */
  readonly ceilings: readonly [number, number];
  /** Up to where over its start and its end it climbs slowly, over the roofs round them (y, m). */
  readonly roofs: readonly [number, number];
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

/** A column over a lane's end: how far it comes down or climbs there (m), the slow part of it under the roofs' height. */
interface Rise {
  readonly all: number;
  readonly slow: number;
}

/** The columns over the lane's start and end. */
const rises = (lane: PatrolLane): readonly [Rise, Rise] => {
  const at = (k: 0 | 1): Rise => {
    const foot = (lane.grounds[k === 0 ? 0 : lane.grounds.length - 1] as number) + PATROL_ALTITUDE;
    const all = Math.max(0, lane.ceilings[k] - foot);
    return { all, slow: Math.min(all, Math.max(0, lane.roofs[k] - foot)) };
  };
  return [at(0), at(1)];
};

/** Seconds to come down or climb a column. */
const riseTime = (r: Rise): number => (r.all - r.slow) / PATROL_SOAR + r.slow / PATROL_CLIMB;

/** Height over the lane's level `t` seconds into climbing a column (from its foot). */
const climbed = (r: Rise, t: number): number => (t < r.slow / PATROL_CLIMB ? t * PATROL_CLIMB : Math.min(r.all, r.slow + (t - r.slow / PATROL_CLIMB) * PATROL_SOAR));

/** Seconds of one flight: coming into sight, down, along with its hover, up, going. */
const flightTime = (p: Patrol): number => {
  const [a, b] = rises(p.lane);
  return 2 * PATROL_APPEAR + riseTime(a) + riseTime(b) + p.lane.length / PATROL_SPEED + p.hover;
};

/** Seconds of a patrol's cycle: out, away, back, away. */
export const patrolCycle = (p: Patrol): number => 2 * flightTime(p) + p.pauses[0] + p.pauses[1];

/**
 * The patrols of the lanes for a quality: the longest lanes, `PATROL_COUNT.quiet` of them over the
 * Old Town at most, there those mostly over a square first (the Rynek before the side streets).
 */
export const patrolFleet = (lanes: readonly PatrolLane[], quality: RenderQuality): Patrol[] => {
  const { total, quiet } = PATROL_COUNT[quality];
  const longest = (l: readonly PatrolLane[]) => [...l].sort((a, b) => b.length - a.length || a.seed - b.seed);
  const squaresFirst = (l: readonly PatrolLane[]) => [...longest(l)].sort((a, b) => Number(b.square > 0.5) - Number(a.square > 0.5));
  const old = squaresFirst(lanes.filter((l) => l.quiet)).slice(0, quiet);
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

/** A smooth step from 0 to 1. */
const ease = (t: number): number => {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
};

/**
 * Along a flight `t` seconds in (the way back when `back`): how far along its way (m), how high over
 * the lane's level (m), whether it hangs, and how large it is drawn.
 */
const flightAt = (p: Patrol, t: number, back: boolean): { s: number; up: number; hovering: number | null; scale: number } => {
  const [a, b] = rises(p.lane);
  const [first, last] = back ? [b, a] : [a, b];
  const L = p.lane.length;
  if (t < PATROL_APPEAR) return { s: 0, up: first.all, hovering: null, scale: ease(t / PATROL_APPEAR) };
  let u = t - PATROL_APPEAR;
  const fall = riseTime(first);
  if (u < fall) return { s: 0, up: climbed(first, fall - u), hovering: null, scale: 1 };
  u -= fall;
  const hoverAt = p.hoverAt;
  const toHover = hoverAt / PATROL_SPEED;
  if (u < toHover) return { s: u * PATROL_SPEED, up: 0, hovering: null, scale: 1 };
  u -= toHover;
  if (u < p.hover) return { s: hoverAt, up: 0, hovering: u, scale: 1 };
  u -= p.hover;
  const rest = (L - hoverAt) / PATROL_SPEED;
  if (u < rest) return { s: hoverAt + u * PATROL_SPEED, up: 0, hovering: null, scale: 1 };
  u -= rest;
  const climb = riseTime(last);
  if (u < climb) return { s: L, up: climbed(last, u), hovering: null, scale: 1 };
  return { s: L, up: last.all, hovering: null, scale: ease(1 - (u - climb) / PATROL_APPEAR) };
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
  const f = flightAt(p, t, back);
  const s = back ? p.lane.length - f.s : f.s;
  const at = patrolLaneAt(p.lane, s);
  const sway = f.hovering === null ? 0 : HOVER_SWAY * Math.sin((f.hovering / SWAY_PERIOD) * 2 * Math.PI);
  const heading = Math.atan2(at.dx, at.dz) + (back ? Math.PI : 0) + sway;
  const bob = PATROL_BOB * Math.sin(((time / BOB_PERIOD + p.bob) * 2 * Math.PI) % (2 * Math.PI));
  return { x: at.p.x, y: at.ground + PATROL_ALTITUDE + f.up + bob, z: at.p.z, yaw: heading, ground: at.ground, scale: f.scale };
};
