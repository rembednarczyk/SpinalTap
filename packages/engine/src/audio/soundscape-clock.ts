import type { AudioListenerPose } from "@seki/core";
import type { AmbientScape } from "./ambience";
import type { Graph } from "./audio-graph";
import { FootstepClock } from "./footsteps";
import type { LayeredMusic } from "./layered-music";
import type { RadioPlayer } from "./radio";
import { DEFAULT_POSE } from "./spatial";
import type { SynthVoices } from "./synth-voices";

/** The looping parts of the mix that the scheduler drives. */
export interface SoundscapeParts {
  readonly voices: SynthVoices;
  readonly ambient: AmbientScape;
  readonly music: LayeredMusic;
  readonly radio: RadioPlayer;
}

/**
 * The scheduler steps of the soundscape (ADR-0013): score and radio, ambience and footsteps,
 * all following the listener pose. Owns the pose, the gait and the time of the last step.
 */
export class SoundscapeClock {
  private readonly steps = new FootstepClock();
  private lastTick = 0;
  private pose: AudioListenerPose = DEFAULT_POSE;

  constructor(private readonly parts: SoundscapeParts) {
    parts.radio.updateListener(this.pose);
  }

  /** New listener pose; positional ambience follows at once when the graph exists. */
  setPose(pose: AudioListenerPose, g: Graph | null): void {
    this.pose = pose;
    this.parts.radio.updateListener(pose);
    if (g) this.parts.ambient.updatePositional(pose, g.ctx.currentTime, false);
  }

  /** Starts rain, traffic, neon hum, steam and the music loop. Idempotent. */
  start(g: Graph): void {
    const { ambient, music } = this.parts;
    const now = g.ctx.currentTime;
    ambient.start(g);
    if (music.start(now)) ambient.resetSchedule(now);
    this.lastTick = now;
    music.refresh(g, now);
    ambient.updatePositional(this.pose, now, true);
  }

  /** One scheduler step. */
  tick(g: Graph): void {
    const { voices, ambient, music, radio } = this.parts;
    const now = g.ctx.currentTime;
    const dt = Math.min(0.25, Math.max(0, now - this.lastTick));
    this.lastTick = now;
    voices.prune(now);
    music.refresh(g, now);
    const mood = music.moodAt(now);
    music.setScore(g, radio.scoreLevel(mood), now);
    music.schedule(g, now);
    // Like the score, the radio plays once the soundscape runs (autoStart or startAmbience).
    if (music.running) radio.schedule(g, now, mood);
    ambient.tick(g, now);
    const n = this.steps.advance(this.pose.speed, dt);
    for (let i = 0; i < n; i++) voices.footstep(g, now + 0.01 + i * 0.05, this.pose.speed, this.steps);
  }
}
