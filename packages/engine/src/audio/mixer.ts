import type { AudioBus } from "@seki/core";

/** The radio starts at the music's level: it played on the music bus before it had its own (ADR-0060). */
export const DEFAULT_VOLUMES: Readonly<Record<AudioBus, number>> = { master: 0.8, music: 0.55, sfx: 0.9, ambience: 0.7, dialogue: 1, radio: 0.55 };

/** Music level while a dialogue is open, relative to the music volume. */
export const DUCK_LEVEL = 0.3;

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/**
 * Bus volumes and ducking, as plain numbers. The WebAudio side only reads `gain(bus)` and
 * ramps the matching GainNode towards it.
 */
export class MixState {
  private readonly volumes: Record<AudioBus, number> = { ...DEFAULT_VOLUMES };
  private ducked = false;
  private speech = 1;

  set(bus: AudioBus, value: number): void {
    this.volumes[bus] = clamp01(value);
  }

  get(bus: AudioBus): number {
    return this.volumes[bus];
  }

  setDucked(ducked: boolean): void {
    this.ducked = ducked;
  }

  get isDucked(): boolean {
    return this.ducked;
  }

  /** Linear factor of the duck under speech (`SpeechDucker`), 1 when nobody speaks. */
  setSpeechDuck(factor: number): void {
    this.speech = clamp01(factor);
  }

  get speechDuck(): number {
    return this.speech;
  }

  /**
   * Effective gain of a bus node. `master` is applied by its own node, not multiplied in. Music
   * and radio take the deeper of the two ducks, an open conversation or a spoken line, so a line
   * inside a conversation does not push the score further down.
   */
  gain(bus: AudioBus): number {
    const v = this.volumes[bus];
    if (bus !== "music" && bus !== "radio") return v;
    return v * Math.min(this.ducked ? DUCK_LEVEL : 1, this.speech);
  }
}
