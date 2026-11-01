import type { AudioBus, AudioCue, AudioListenerPose, AudioPort, AudioScenePort, MusicMood } from "@seki/core";
import { AmbientScape } from "./ambience";
import { applyBus } from "./audio-graph";
import { AudioContextHost } from "./audio-context-host";
import { LayeredMusic } from "./layered-music";
import { MixState } from "./mixer";
import { mulberry32 } from "./music";
import { RadioPlayer } from "./radio";
import type { RadioStationId } from "./radio-stations";
import type { EmitterMix } from "./spatial";
import { type AudioSampleManifest, type FetchBytes, SampleBank, manifestUrls } from "./samples";
import { SoundscapeClock } from "./soundscape-clock";
import { SynthVoices } from "./synth-voices";
import { TickTimer } from "./tick-timer";

export { CUES, type Recipe, type Voice } from "./cues";
export { RADIO_STATIONS, RADIO_STATION_IDS, type RadioStationId } from "./radio-stations";
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
 * `AmbientScape`, the music in `LayeredMusic`, the radio in `RadioPlayer`, bus levels in `MixState`,
 * the context in `AudioContextHost`, the scheduler step and the listener pose in `SoundscapeClock`,
 * its timer in `TickTimer`; this class routes the ports to them.
 */
export class SynthAudio implements AudioPort, AudioScenePort {
  private readonly host: AudioContextHost;
  private readonly timer: TickTimer;
  private readonly mix = new MixState();
  /** One seeded stream for sample variants, noise offsets, drops, cars and footsteps. */
  private readonly rnd = mulberry32(0x0a11e7);
  private readonly samples: AudioSampleManifest;
  /** Loaded recordings (tests, debug overlay). */
  readonly sampleBank: SampleBank;
  private readonly voices: SynthVoices;
  private readonly ambient: AmbientScape;
  private readonly music: LayeredMusic;
  private readonly radio: RadioPlayer;
  private readonly clock: SoundscapeClock;
  /** Last start of each cue; identical cues in the same instant would only phase and cost voices. */
  private readonly lastCue = new Map<AudioCue, number>();

  constructor(private readonly opts: SynthAudioOptions = {}) {
    this.host = new AudioContextHost(opts.createContext);
    this.timer = new TickTimer(opts.setInterval, opts.clearInterval);
    this.samples = opts.samples ?? {};
    this.sampleBank = new SampleBank(opts.fetchBytes);
    this.voices = new SynthVoices(opts.maxVoices ?? 40, this.sampleBank, this.samples, this.rnd);
    this.ambient = new AmbientScape(this.voices, this.sampleBank, this.samples, this.rnd);
    this.music = new LayeredMusic(this.voices, this.mix);
    this.radio = new RadioPlayer(this.voices);
    this.clock = new SoundscapeClock({ voices: this.voices, ambient: this.ambient, music: this.music, radio: this.radio });
  }
  /** True while the recorded rain loop plays instead of the synthesized hiss alone. */
  get recordedRain(): boolean {
    return this.ambient.recordedRain;
  }

  /** True once a context exists. */
  get ready(): boolean {
    return this.host.graph !== null;
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
    return this.music.moodAt(this.host.graph?.ctx.currentTime ?? 0);
  }

  /** The player's own station, null while her radio is off. */
  get radioStation(): RadioStationId | null {
    return this.radio.station;
  }

  /** The station heard right now: her own, a speaker's nearby, or none (debug, tests). */
  get radioAudible(): RadioStationId | null {
    return this.radio.audible;
  }

  /** Level of the score under the radio, 0..1 (debug, tests). */
  get scoreLevel(): number {
    return this.music.scoreLevel;
  }

  /**
   * The player's radio (ADR-0036): one of three stations, or off with null. While exploring it
   * replaces the score, in a fight the score comes back over it; dialogue ducks it like music.
   */
  setRadioStation(id: RadioStationId | null): void {
    this.radio.setStation(id);
    if (this.host.graph) this.tick();
  }

  // ----------------------------------------------------------------------------- AudioPort

  /** Creates and resumes the context. Call from a user gesture (autoplay policy). Never throws. */
  unlock(): void {
    const fresh = this.host.open(this.mix);
    const g = this.host.graph;
    if (!g) return;
    if (fresh) {
      // Lazy: nothing is downloaded before the first gesture, and only once.
      this.sampleBank.load(g.ctx, manifestUrls(this.samples));
      if (this.opts.autoStart !== false) this.startAmbience();
    }
    this.host.resume();
  }

  play(cue: AudioCue): void {
    const g = this.host.graph;
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
    this.timer.stop();
    const g = this.host.graph;
    const now = g?.ctx.currentTime ?? 0;
    this.voices.stopAll(now);
    this.ambient.stop(now);
    this.music.stop(g, now);
    this.radio.stop(now);
  }

  // ------------------------------------------------------------------------ AudioScenePort

  setMood(mood: MusicMood): void {
    this.music.setBase(mood);
    const g = this.host.graph;
    if (g) this.music.refresh(g, g.ctx.currentTime);
    else this.mix.setDucked(mood === "dialog");
  }

  setListener(pose: AudioListenerPose): void {
    this.clock.setPose(pose, this.host.graph);
  }

  setVolume(bus: AudioBus, value: number): void {
    this.mix.set(bus, value);
    const g = this.host.graph;
    if (g) applyBus(g, this.mix, bus, g.ctx.currentTime);
  }

  getVolume(bus: AudioBus): number {
    return this.mix.get(bus);
  }

  // ---------------------------------------------------------------------------- Soundscape

  /** Rain, traffic, neon hum, steam and the music loop. Idempotent. */
  startAmbience(): void {
    const g = this.host.graph;
    if (!g) return;
    this.clock.start(g);
    this.timer.start(() => this.tick(), TICK_MS);
  }

  /** One scheduler step; driven by the internal timer, public for tests. */
  tick(): void {
    const g = this.host.graph;
    if (g) this.clock.tick(g);
  }
}
