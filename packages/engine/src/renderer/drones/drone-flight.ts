import type { RenderQuality } from "../../npr/quality";
import { propHash } from "../city-props";
import type { P2 } from "../mapcity/polygon";
import { type DroneLane, LEG, STEP } from "./drone-lanes";

/**
 * The drones on their lanes (ADR-0058 stage 7): who flies where, and where each is at a time.
 * Visual only, nothing in the simulation: the time is the renderer's own, frozen in the reference
 * still. Each drone loops its lane: out along the right-hand leg, a half turn round the end, back
 * along the other leg, a half turn round the start. Pure.
 */

export type DroneKind = "patrol" | "delivery" | "ad";
export const DRONE_KINDS: readonly DroneKind[] = ["patrol", "delivery", "ad"];

/**
 * Each kind's box (m), its foot at the flight level, centred across and along, and the span of its
 * airframe's fans (`frame`; the rest is its gear): tools/city_drones.py fits the models into it.
 */
export const DRONE_SIZE: Readonly<Record<DroneKind, { readonly width: number; readonly height: number; readonly length: number; readonly frame: number }>> = {
  patrol: { width: 3.4, height: 1.25, length: 1.65, frame: 3.4 },
  delivery: { width: 3.0, height: 1.85, length: 1.45, frame: 3.0 },
  ad: { width: 3.4, height: 3.1, length: 1.45, frame: 3.0 },
};

/**
 * Speed (m/s) and height over the lane's level (m): the patrols fly fast and high, the ads slowly and
 * low. The layers, bobbing included, never overlap, so two kinds on one leg pass over each other;
 * one kind keeps one speed, so it never catches up with itself, and the two legs lie further apart
 * than the widest drone (`LEG`), so the ways out and back never touch.
 */
export const DRONE_LAYER: Readonly<Record<DroneKind, { readonly speed: number; readonly above: number }>> = {
  patrol: { speed: 14, above: 7.5 },
  delivery: { speed: 10, above: 4 },
  ad: { speed: 4, above: 0 },
};

/** Metres of lane per drone, per quality; phones get none (ADR-0058: their draw calls stay as they were). */
export const DRONE_SPACING: Readonly<Record<RenderQuality, number | null>> = { high: 70, medium: 140, low: null };

/** How the bobbing goes: up and down this much (m) over this many seconds. */
export const BOB = 0.35;
const BOB_PERIOD = 3.2;

export interface Drone {
  readonly kind: DroneKind;
  readonly lane: DroneLane;
  /** Where on its loop it starts (m). */
  readonly phase: number;
  readonly bob: number;
}

export interface DronePose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Heading: its front (+z of the model) towards (sin yaw, cos yaw). */
  readonly yaw: number;
}

/** Length of a lane's loop (m): two legs and two half turns. */
export const loopLength = (lane: DroneLane): number => 2 * lane.length + 2 * Math.PI * LEG;

/** The drones of the lanes for a quality: one per `DRONE_SPACING` metres, at least one a lane, kinds by the seed. */
export const droneFleet = (lanes: readonly DroneLane[], quality: RenderQuality): Drone[] => {
  const spacing = DRONE_SPACING[quality];
  if (spacing === null) return [];
  const out: Drone[] = [];
  for (const lane of lanes) {
    const n = Math.max(1, Math.round(lane.length / spacing));
    const loop = loopLength(lane);
    for (let k = 0; k < n; k++) {
      const h = propHash(lane.seed, k);
      const pick = h % 8;
      const kind: DroneKind = pick < 2 ? "patrol" : pick < 6 ? "delivery" : "ad";
      out.push({ kind, lane, phase: (loop * (k + (propHash(h, 1) % 100) / 200)) / n, bob: (propHash(h, 2) % 1000) / 1000 });
    }
  }
  return out;
};

/**
 * The point of the lane's axis `s` metres from its start (carried on straight past its ends, where
 * the turns bulge), the axis's direction there and the flight level (the nearer end's past them).
 */
export const laneAt = (lane: DroneLane, s: number): { readonly p: P2; readonly dx: number; readonly dz: number; readonly level: number } => {
  const last = lane.points.length - 1;
  const f = s / STEP;
  const i = Math.max(0, Math.min(last - 1, Math.floor(f)));
  const t = f - i;
  const a = lane.points[i] as P2;
  const b = lane.points[i + 1] as P2;
  const d = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const la = lane.levels[i] as number;
  const lb = lane.levels[i + 1] as number;
  const k = Math.max(0, Math.min(1, t));
  return { p: { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, dx: (b.x - a.x) / d, dz: (b.z - a.z) / d, level: la + (lb - la) * k };
};

/** Where on the lane a point of the loop `u` metres from its start is: (along, side of the axis, heading turned back). */
const onLoop = (lane: DroneLane, u: number): { readonly s: number; readonly side: number; readonly turn: number } => {
  const L = lane.length;
  const half = Math.PI * LEG;
  if (u < L) return { s: u, side: 1, turn: 0 };
  if (u < L + half) {
    const a = (u - L) / LEG;
    return { s: L + Math.sin(a) * LEG, side: Math.cos(a), turn: a };
  }
  if (u < 2 * L + half) return { s: L - (u - L - half), side: -1, turn: Math.PI };
  const a = (u - 2 * L - half) / LEG;
  return { s: -Math.sin(a) * LEG, side: -Math.cos(a), turn: Math.PI + a };
};

/** Where a drone is at `time` seconds. */
export const dronePose = (d: Drone, time: number): DronePose => {
  const loop = loopLength(d.lane);
  const kind = DRONE_LAYER[d.kind];
  const u = (((d.phase + kind.speed * time) % loop) + loop) % loop;
  const { s, side, turn } = onLoop(d.lane, u);
  const at = laneAt(d.lane, s);
  // The right-hand side of the way out: the axis's normal turned clockwise.
  const nx = at.dz;
  const nz = -at.dx;
  const heading = Math.atan2(at.dx, at.dz) - turn;
  const bob = BOB * Math.sin(((time / BOB_PERIOD + d.bob) * 2 * Math.PI) % (2 * Math.PI));
  return { x: at.p.x + nx * side * LEG, y: at.level + kind.above + BOB + bob, z: at.p.z + nz * side * LEG, yaw: heading };
};
