import type { AudioBus } from "@seki/core";

export const DEFAULT_VOLUMES: Readonly<Record<AudioBus, number>> = { master: 0.8, music: 0.55, sfx: 0.9, ambience: 0.7 };

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

  /** Effective gain of a bus node. `master` is applied by its own node, not multiplied in. */
  gain(bus: AudioBus): number {
    const v = this.volumes[bus];
    return bus === "music" && this.ducked ? v * DUCK_LEVEL : v;
  }
}
