import type { AudioListenerPose, Vec3 } from "@seki/core";
import { DISTRICT_M0_PROPS, PLAYER_SPAWN } from "@seki/sim";

export interface Emitter {
  readonly position: Vec3;
  /** Loudness at `ref` metres, 0..1. */
  readonly level: number;
}

export interface EmitterMix {
  /** Summed level after distance falloff, clamped to 1. */
  readonly gain: number;
  /** Stereo position -1 (left) .. 1 (right), weighted by each emitter's contribution. */
  readonly pan: number;
}

/** Inverse-distance falloff (WebAudio's "inverse" model) with a hard cut beyond `max`. */
export const falloff = (distance: number, ref = 2, max = 30, rolloff = 1.2): number => {
  if (distance >= max) return 0;
  const d = Math.max(distance, ref);
  const g = ref / (ref + rolloff * (d - ref));
  // Fade the last quarter to zero so crossing `max` does not click.
  const edge = Math.min(1, (max - distance) / (max * 0.25));
  return g * edge;
};

/**
 * Mixes several static emitters into one level and pan for the listener. One shared voice
 * per kind (hum, steam) is far cheaper than a PannerNode per sign.
 */
export const emitterMix = (pose: AudioListenerPose, emitters: readonly Emitter[], ref = 2, max = 30): EmitterMix => {
  // Forward is (sin yaw, cos yaw) on XZ; right is (cos yaw, -sin yaw).
  const rx = Math.cos(pose.yaw);
  const rz = -Math.sin(pose.yaw);
  let gain = 0;
  let pan = 0;
  for (const e of emitters) {
    const dx = e.position.x - pose.position.x;
    const dy = e.position.y - pose.position.y;
    const dz = e.position.z - pose.position.z;
    const dist = Math.hypot(dx, dy, dz);
    const g = e.level * falloff(dist, ref, max);
    if (g <= 0) continue;
    const flat = Math.hypot(dx, dz);
    const side = flat < 1e-6 ? 0 : (dx * rx + dz * rz) / flat;
    gain += g;
    pan += g * side;
  }
  return { gain: Math.min(1, gain), pan: gain > 0 ? Math.max(-1, Math.min(1, pan / gain)) : 0 };
};

/** Neon signs of the district buzz louder the bigger they are. */
export const neonEmitters = (props = DISTRICT_M0_PROPS): Emitter[] =>
  props.flatMap((p) => {
    if (p.view.kind !== "neon") return [];
    const s = p.view.size;
    const area = Math.max(s.x, s.z) * s.y;
    return [{ position: p.center, level: Math.min(1, 0.35 + area / 20) }];
  });

/** Steam vents, matching the renderer's steam particles (manhole and car-wash vent). */
export const DISTRICT_M0_VENTS: readonly Emitter[] = [
  { position: { x: 1.8, y: 0.05, z: 5.5 }, level: 1 },
  { position: { x: -5.2, y: 1.45, z: 44 }, level: 0.8 },
];

/** Where the player starts, so ambience sounds right before the first listener update. */
export const DEFAULT_POSE: AudioListenerPose = {
  position: { x: PLAYER_SPAWN.position.x, y: 1.6, z: PLAYER_SPAWN.position.z },
  yaw: PLAYER_SPAWN.yaw,
  speed: 0,
};
