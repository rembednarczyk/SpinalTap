import type { RadioStationId } from "../world/wave2";
import type { Vec3 } from "../math/vec3";
import type { AudioCue } from "./types";

export interface AudioPort {
  play(cue: AudioCue): void;
  stopAll(): void;
}

/** Musical situation. The adapter crossfades music layers between moods. */
export type MusicMood = "explore" | "combat" | "overdrive" | "dialog";

/**
 * Mixer buses with their own volume. `master` scales all of them. `dialogue` carries spoken
 * lines and `radio` the stations (ADR-0060 stage 1); music and radio duck under speech.
 */
export type AudioBus = "master" | "music" | "sfx" | "ambience" | "dialogue" | "radio";

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
  /** Radio on its own bus (ADR-0036, ADR-0060); null switches it off. Dialogue ducks it like music. */
  setRadioStation?(id: RadioStationId | null): void;
  /**
   * Plays a voiced line by its key on the dialogue bus (ADR-0060), replacing the line still
   * speaking. A key without a recording is not an error: the subtitle stays on its own.
   */
  playLine?(key: string): void;
  /** Cuts the line being spoken (a skipped or closed conversation). */
  stopLine?(): void;
}
