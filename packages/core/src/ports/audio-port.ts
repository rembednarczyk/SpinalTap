import type { RadioStationId } from "../world/wave2";
import type { Vec3 } from "../math/vec3";
import type { AudioCue } from "./types";

export interface AudioPort {
  play(cue: AudioCue): void;
  stopAll(): void;
}

/** Musical situation. The adapter crossfades music layers between moods. */
export type MusicMood = "explore" | "combat" | "overdrive" | "dialog";

/** Mixer buses with their own volume. `master` scales all of them. */
export type AudioBus = "master" | "music" | "sfx" | "ambience";

/** Where the player hears the world from. Sent once per rendered frame. */
export interface AudioListenerPose {
  readonly position: Vec3;
  /** Rotation around Y in radians, same convention as `Transform.yaw`. */
  readonly yaw: number;
  /** Horizontal speed of the player in m/s; drives footsteps. */
  readonly speed: number;
}

/**
 * Continuous audio state (ADR-0013): music mood, listener for positional ambience and
 * footsteps, bus volumes for the settings screen. Separate from `AudioPort` so one-shot cues
 * stay a one-method contract and fakes in tests stay trivial.
 */
export interface AudioScenePort {
  setMood(mood: MusicMood): void;
  setListener(pose: AudioListenerPose): void;
  /** Linear volume 0..1; values outside are clamped. */
  setVolume(bus: AudioBus, value: number): void;
  getVolume(bus: AudioBus): number;
  /** Radio on the music bus (ADR-0036); null switches it off. Dialogue ducks it like music. */
  setRadioStation?(id: RadioStationId | null): void;
}
