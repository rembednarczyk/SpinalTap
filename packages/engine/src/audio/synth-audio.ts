import type { AudioBus, AudioCue, AudioListenerPose, AudioPort, AudioScenePort, MusicMood } from "@seki/core";
import { AmbientScape } from "./ambience";
import { type Graph, applyBus, buildGraph, defaultContext } from "./audio-graph";
import { FootstepClock } from "./footsteps";
import { LayeredMusic } from "./layered-music";
import { MixState } from "./mixer";
import { mulberry32 } from "./music";
import { DEFAULT_POSE, type EmitterMix } from "./spatial";
import { type AudioSampleManifest, type FetchBytes, SampleBank, manifestUrls } from "./samples";
import { SynthVoices } from "./synth-voices";

export { CUES, type Recipe, type Voice } from "./cues";
export { crushCurve } from "./audio-graph";

export interface SynthAudioOptions {
  /** Context factory; return null when audio is unavailable. Defaults to `new AudioContext()`. */
  readonly createContext?: () => AudioContext | null;
  /** Scheduler timer, injectable for tests. */
  readonly setInterval?: (fn: () => void, ms: number) => unknown;
  readonly clearInterval?: (id: unknown) => void;
  /** Maximum simultaneous one-shot voices (music, SFX, drops, steps). */
  readonly maxVoices?: number;
  /** Start ambience and music on the first unlock (default true). */
  readonly autoStart?: boolean;
  /**
   * Recorded sounds (CC0 packs) supplied by the application. They load lazily after `unlock()`;
   * until a recording is decoded, or when it is missing or undecodable, the synth plays instead.
   */
  readonly samples?: AudioSampleManifest;
  /** Byte loader for the samples, injectable for tests. Defaults to `fetch`. */
  readonly fetchBytes?: FetchBytes;
}

const TICK_MS = 50;
const CUE_RETRIGGER = 0.025;

/**
 * AudioPort and AudioScenePort on raw WebAudio (ADR-0009, ADR-0013). Everything is
 * synthesized: cues from recipes, a procedural synthwave loop with mood layers, rain, traffic,
 * neon hum and steam that follow the listener. The context is created on the first user
 * gesture; without WebAudio every method is a silent no-op.
 *
 * A facade (ADR-0031): voices and effects live in `SynthVoices`, the soundscape in
 * `AmbientScape`, the music in `LayeredMusic`, bus levels in `MixState`; this class owns the
 * context, the scheduler timer and the listener pose.
 */
export class SynthAudio implements AudioPort, AudioScenePort {
  private g: Graph | null = null;
  private failed = false;
  private timer: unknown = null;
  private readonly mix = new MixState();
  private readonly steps = new FootstepClock();
  /** One seeded stream for sample variants, noise offsets, drops, cars and footsteps. */
  private readonly rnd = mulberry32(0x0a11e7);
  private pose: AudioListenerPose = DEFAULT_POSE;
  private readonly samples: AudioSampleManifest;
  private readonly bank: SampleBank;
  private readonly voices: SynthVoices;
  private readonly ambient: AmbientScape;
  private readonly music: LayeredMusic;
  /** Last start of each cue; identical cues in the same instant would only phase and cost voices. */
  private readonly lastCue = new Map<AudioCue, number>();
  private lastTick = 0;

  constructor(private readonly opts: SynthAudioOptions = {}) {
    this.samples = opts.samples ?? {};
    this.bank = new SampleBank(opts.fetchBytes);
    this.voices = new SynthVoices(opts.maxVoices ?? 40, this.bank, this.samples, this.rnd);
    this.ambient = new AmbientScape(this.voices, this.bank, this.samples, this.rnd);
    this.music = new LayeredMusic(this.voices, this.mix);
  }

  /** Loaded recordings (tests, debug overlay). */
  get sampleBank(): SampleBank {
    return this.bank;
  }

  /** True while the recorded rain loop plays instead of the synthesized hiss alone. */
  get recordedRain(): boolean {
    return this.ambient.recordedRain;
  }

  /** True once a context exists. */
  get ready(): boolean {
    return this.g !== null;
  }

  /** Voices currently held in the pool (for tests and the perf overlay). */
  get voiceCount(): number {
    return this.voices.size;
  }

  /** Last positional mix of the neon hum and steam (debug overlay, tests). */
  get positional(): { readonly hum: EmitterMix; readonly steam: EmitterMix } {
    return this.ambient.positional;
  }

  get currentMood(): MusicMood {
    return this.music.moodAt(this.g?.ctx.currentTime ?? 0);
  }

  // ----------------------------------------------------------------------------- AudioPort

  /** Creates and resumes the context. Call from a user gesture (autoplay policy). Never throws. */
  unlock(): void {
    if (this.failed) return;
    if (!this.g) {
      try {
        const ctx = (this.opts.createContext ?? defaultContext)();
        if (!ctx) {
          this.failed = true;
          return;
        }
        this.g = buildGraph(ctx, this.mix);
      } catch {
        this.failed = true;
        this.g = null;
        return;
      }
      // Lazy: nothing is downloaded before the first gesture, and only once.
      this.bank.load(this.g.ctx, manifestUrls(this.samples));
      if (this.opts.autoStart !== false) this.startAmbience();
    }
    const ctx = this.g.ctx;
    if (ctx.state === "suspended") {
      try {
        void ctx.resume().catch(() => undefined);
      } catch {
        // Some browsers throw synchronously outside a gesture; the next gesture retries.
      }
    }
  }

  play(cue: AudioCue): void {
    const g = this.g;
    const now = g?.ctx.currentTime ?? 0;
    this.music.notify(cue, now);
    if (!g) return;
    const last = this.lastCue.get(cue);
    if (last !== undefined && now - last < CUE_RETRIGGER && now >= last) return;
    this.lastCue.set(cue, now);
    this.voices.cue(g, cue, now);
    this.music.refresh(g, now);
  }

  stopAll(): void {
    this.stopTimer();
    const g = this.g;
    const now = g?.ctx.currentTime ?? 0;
    this.voices.stopAll(now);
    this.ambient.stop(now);
    this.music.stop(g, now);
  }

  // ------------------------------------------------------------------------ AudioScenePort

  setMood(mood: MusicMood): void {
    this.music.setBase(mood);
    if (this.g) this.music.refresh(this.g, this.g.ctx.currentTime);
    else this.mix.setDucked(mood === "dialog");
  }

  setListener(pose: AudioListenerPose): void {
    this.pose = pose;
    if (this.g) this.ambient.updatePositional(pose, this.g.ctx.currentTime, false);
  }

  setVolume(bus: AudioBus, value: number): void {
    this.mix.set(bus, value);
    if (this.g) applyBus(this.g, this.mix, bus, this.g.ctx.currentTime);
  }

  getVolume(bus: AudioBus): number {
    return this.mix.get(bus);
  }

  // ---------------------------------------------------------------------------- Soundscape

  /** Rain, traffic, neon hum, steam and the music loop. Idempotent. */
  startAmbience(): void {
    const g = this.g;
    if (!g) return;
    const now = g.ctx.currentTime;
    this.ambient.start(g);
    if (this.music.start(now)) this.ambient.resetSchedule(now);
    this.lastTick = now;
    this.music.refresh(g, now);
    this.ambient.updatePositional(this.pose, now, true);
    this.startTimer();
  }

  /** One scheduler step; driven by the internal timer, public for tests. */
  tick(): void {
    const g = this.g;
    if (!g) return;
    const now = g.ctx.currentTime;
    const dt = Math.min(0.25, Math.max(0, now - this.lastTick));
    this.lastTick = now;
    this.voices.prune(now);
    this.music.refresh(g, now);
    this.music.schedule(g, now);
    this.ambient.tick(g, now);
    const n = this.steps.advance(this.pose.speed, dt);
    for (let i = 0; i < n; i++) this.voices.footstep(g, now + 0.01 + i * 0.05, this.pose.speed, this.steps);
  }

  private startTimer(): void {
    if (this.timer !== null) return;
    const set = this.opts.setInterval ?? ((fn: () => void, ms: number) => globalThis.setInterval(fn, ms));
    this.timer = set(() => this.tick(), TICK_MS);
  }

  private stopTimer(): void {
    if (this.timer === null) return;
    const clear = this.opts.clearInterval ?? ((id: unknown) => globalThis.clearInterval(id as ReturnType<typeof setInterval>));
    clear(this.timer);
    this.timer = null;
  }
}
