import type { AudioListenerPose } from "@seki/core";
import type { AmbientScape } from "./ambience";
import type { Graph } from "./audio-graph";
import { FootstepClock } from "./footsteps";
import type { LayeredMusic } from "./layered-music";
import type { RadioPlayer } from "./radio";
import type { RoomScape } from "./room-scape";
import { DEFAULT_POSE } from "./spatial";
import type { SynthVoices } from "./synth-voices";
import type { W3Scape } from "./w3-scape";
import { W3_STREET_LEVEL } from "./w3-sound-map";

/** The looping parts of the mix that the scheduler drives. */
export interface SoundscapeParts {
  readonly voices: SynthVoices;
  readonly ambient: AmbientScape;
  readonly music: LayeredMusic;
  readonly radio: RadioPlayer;
  readonly w3: W3Scape;
  /** The rooms' steady sounds from their things (§17). */
  readonly rooms: RoomScape;
}

/**
 * The scheduler steps of the soundscape (ADR-0013): score and radio, ambience and footsteps,
 * W-3's sectors (ADR-0082 stage 4), all following the listener pose. Owns the pose, the gait and
 * the time of the last step.
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
    if (pose.footfalls !== undefined) this.steps.feel(pose.footfalls);
    this.parts.radio.updateListener(pose);
    if (!g) return;
    const now = g.ctx.currentTime;
    this.parts.ambient.updatePositional(pose, now, false);
    this.parts.w3.update(pose, now);
    this.parts.rooms.update(pose, now);
    // Under W-3's roof the street's rain and traffic come through dull.
    this.parts.ambient.setStreetLevel(W3_STREET_LEVEL[this.parts.w3.place], now);
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
    this.parts.w3.update(this.pose, now, true);
    this.parts.rooms.update(this.pose, now);
    ambient.setStreetLevel(W3_STREET_LEVEL[this.parts.w3.place], now);
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
    if (music.running) {
      this.parts.w3.tick(g, now);
      this.parts.rooms.tick(g, now);
    }
    const n = this.steps.take(this.pose.speed, dt, now);
    for (let i = 0; i < n; i++) voices.footstep(g, now + 0.01 + i * 0.05, this.pose.speed, this.steps);
  }
}
