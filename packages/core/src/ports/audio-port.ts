import type { AudioCue } from "./types";

export interface AudioPort {
  play(cue: AudioCue): void;
  stopAll(): void;
}
