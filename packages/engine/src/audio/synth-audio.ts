import type { AudioBus, AudioCue, AudioListenerPose, AudioPort, AudioScenePort, MusicMood } from "@seki/core";
import { FootstepClock } from "./footsteps";
import { MixState } from "./mixer";
import { LAYER_MIX, LAYERS, type Layer, LOOP_STEPS, MOOD_CUTOFF, MusicDirector, MusicSequencer, type NoteEvent, STEP_SECONDS, midiToHz, mulberry32 } from "./music";
import { DEFAULT_POSE, DISTRICT_M0_VENTS, type Emitter, type EmitterMix, emitterMix, neonEmitters } from "./spatial";
import { PRIORITY, VoicePool } from "./voice-pool";

/** One synthesized partial: an oscillator or noise burst with an envelope. */
export interface Voice {
  readonly type: OscillatorType | "noise";
  readonly freq: number;
  /** Pitch at the end (exponential glide). */
  readonly to?: number;
  readonly start?: number;
  readonly dur: number;
  readonly gain: number;
  readonly attack?: number;
  readonly filter?: number;
  readonly filterTo?: number;
  readonly filterType?: BiquadFilterType;
  readonly q?: number;
  /** Detune in cents at the end of the voice (pitch bend for glitches). */
  readonly bend?: number;
  readonly pan?: number;
  readonly panTo?: number;
}

export interface Recipe {
  readonly voices: readonly Voice[];
  /** Reverb send 0..1 (alley tail). */
  readonly send?: number;
  /** Routes through the bitcrusher. */
  readonly crush?: boolean;
  readonly priority?: number;
}

export const CUES: Readonly<Record<AudioCue, Recipe>> = {
  shot: {
    send: 0.7,
    voices: [
      { type: "noise", freq: 0, dur: 0.09, gain: 0.55, filter: 5200, filterTo: 1400, attack: 0.001 },
      { type: "square", freq: 160, to: 45, dur: 0.12, gain: 0.3, filter: 1800, attack: 0.001 },
      { type: "sine", freq: 70, to: 38, dur: 0.18, gain: 0.35, attack: 0.002 },
    ],
  },
  "enemy-shot": {
    send: 0.85,
    voices: [
      { type: "noise", freq: 0, dur: 0.08, gain: 0.24, filter: 3200, filterTo: 900, attack: 0.001 },
      { type: "sine", freq: 90, to: 40, dur: 0.12, gain: 0.14 },
    ],
  },
  hit: {
    send: 0.15,
    voices: [
      { type: "triangle", freq: 1800, to: 900, dur: 0.05, gain: 0.18 },
      { type: "noise", freq: 0, dur: 0.04, gain: 0.08, filter: 3000, filterType: "bandpass", q: 2 },
    ],
  },
  critical: {
    send: 0.25,
    voices: [
      { type: "triangle", freq: 1400, dur: 0.05, gain: 0.2 },
      { type: "triangle", freq: 2400, start: 0.05, dur: 0.08, gain: 0.2 },
      { type: "square", freq: 3600, start: 0.05, dur: 0.12, gain: 0.05, filter: 6000 },
      { type: "sine", freq: 120, to: 60, dur: 0.15, gain: 0.25 },
    ],
  },
  hurt: {
    voices: [
      { type: "sawtooth", freq: 110, to: 70, dur: 0.18, gain: 0.25, filter: 900 },
      { type: "noise", freq: 0, dur: 0.12, gain: 0.12, filter: 600 },
    ],
  },
  kill: {
    send: 0.4,
    voices: [
      { type: "sine", freq: 520, to: 120, dur: 0.35, gain: 0.22 },
      { type: "noise", freq: 0, start: 0.05, dur: 0.3, gain: 0.08, filter: 1200, filterTo: 300 },
    ],
  },
  "ui-select": {
    priority: PRIORITY.ui,
    voices: [
      { type: "sine", freq: 1320, dur: 0.035, gain: 0.1, attack: 0.001 },
      { type: "square", freq: 2640, dur: 0.012, gain: 0.03, filter: 5000, attack: 0.001 },
    ],
  },
  "quest-update": {
    priority: PRIORITY.ui,
    voices: [
      { type: "sine", freq: 660, dur: 0.12, gain: 0.16 },
      { type: "sine", freq: 990, start: 0.12, dur: 0.24, gain: 0.16 },
      { type: "triangle", freq: 1320, start: 0.12, dur: 0.3, gain: 0.05 },
    ],
  },
  // Memory glitch: a chord bent down through the bitcrusher, with stuttering noise.
  memory: {
    crush: true,
    send: 0.3,
    voices: [
      { type: "sawtooth", freq: 440, dur: 1.4, gain: 0.09, filter: 2400, bend: -700, attack: 0.02 },
      { type: "sawtooth", freq: 523.25, start: 0.04, dur: 1.3, gain: 0.07, filter: 2400, bend: -1200, attack: 0.02 },
      { type: "square", freq: 659.25, start: 0.08, dur: 1.2, gain: 0.05, filter: 3000, bend: 500 },
      { type: "noise", freq: 0, dur: 0.06, gain: 0.12, filter: 6000, filterType: "highpass" },
      { type: "noise", freq: 0, start: 0.18, dur: 0.05, gain: 0.1, filter: 6000, filterType: "highpass", pan: -0.6 },
      { type: "noise", freq: 0, start: 0.31, dur: 0.07, gain: 0.1, filter: 6000, filterType: "highpass", pan: 0.6 },
      { type: "noise", freq: 0, start: 0.52, dur: 0.04, gain: 0.08, filter: 6000, filterType: "highpass" },
      { type: "sine", freq: 55, dur: 1.2, gain: 0.12, to: 41 },
    ],
  },
  save: { priority: PRIORITY.ui, voices: [{ type: "square", freq: 1200, dur: 0.04, gain: 0.06, filter: 4000 }] },
  purchase: {
    priority: PRIORITY.ui,
    voices: [
      { type: "triangle", freq: 1318.5, dur: 0.06, gain: 0.14 },
      { type: "triangle", freq: 1760, start: 0.07, dur: 0.1, gain: 0.14 },
      { type: "sine", freq: 2637, start: 0.14, dur: 0.22, gain: 0.08 },
    ],
  },
  denied: {
    priority: PRIORITY.ui,
    voices: [
      { type: "square", freq: 180, dur: 0.1, gain: 0.1, filter: 1200 },
      { type: "square", freq: 150, start: 0.12, dur: 0.16, gain: 0.1, filter: 1000 },
    ],
  },
  heal: {
    send: 0.35,
    voices: [
      { type: "sine", freq: 523.25, to: 880, dur: 0.4, gain: 0.12, attack: 0.03 },
      { type: "sine", freq: 659.25, to: 1046.5, start: 0.08, dur: 0.45, gain: 0.09, attack: 0.04 },
      { type: "noise", freq: 0, dur: 0.5, gain: 0.03, filter: 7000, filterType: "highpass", attack: 0.1 },
    ],
  },
  overdrive: {
    send: 0.3,
    voices: [
      { type: "sawtooth", freq: 220, to: 55, dur: 0.6, gain: 0.16, filter: 1600, filterTo: 300 },
      { type: "sine", freq: 110, dur: 0.9, gain: 0.12 },
      { type: "noise", freq: 0, dur: 0.5, gain: 0.06, filter: 400, filterTo: 4000, filterType: "bandpass", q: 3 },
    ],
  },
};

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
}

interface PlayingVoice {
  readonly src: AudioScheduledSourceNode;
  readonly env: GainNode;
}

/** Nodes of the looping ambience, rebuilt by `startAmbience` after `stopAll`. */
interface Ambience {
  readonly sources: AudioScheduledSourceNode[];
  readonly out: GainNode;
  readonly hum: GainNode;
  readonly humPan: StereoPannerNode | null;
  readonly steam: GainNode;
  readonly steamPan: StereoPannerNode | null;
}

interface Graph {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  readonly compressor: DynamicsCompressorNode;
  readonly buses: Record<Exclude<AudioBus, "master">, GainNode>;
  readonly musicFilter: BiquadFilterNode;
  readonly layers: Record<Layer, GainNode>;
  readonly echo: GainNode;
  readonly reverb: GainNode;
  readonly crusher: GainNode;
  readonly noise: AudioBuffer;
}

const TICK_MS = 50;
const LOOKAHEAD = 0.25;
/** Time constant of layer crossfades: ~2 s to settle, never a step. */
const LAYER_TC = 0.6;
const LISTENER_TC = 0.15;
const SILENT = 0.0001;
const CUE_RETRIGGER = 0.025;

const defaultContext = (): AudioContext | null => {
  const Ctor =
    typeof AudioContext !== "undefined"
      ? AudioContext
      : (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
};

/**
 * AudioPort and AudioScenePort on raw WebAudio (ADR-0009, ADR-0013). Everything is
 * synthesized: cues from recipes, a procedural synthwave loop with mood layers, rain, traffic,
 * neon hum and steam that follow the listener. The context is created on the first user
 * gesture; without WebAudio every method is a silent no-op.
 */
export class SynthAudio implements AudioPort, AudioScenePort {
  private g: Graph | null = null;
  private failed = false;
  private ambience: Ambience | null = null;
  private timer: unknown = null;
  private readonly pool: VoicePool<PlayingVoice>;
  private readonly mix = new MixState();
  private readonly director = new MusicDirector();
  private readonly sequencer = new MusicSequencer();
  private readonly steps = new FootstepClock();
  private readonly rnd = mulberry32(0x0a11e7);
  private readonly neon: readonly Emitter[] = neonEmitters();
  private readonly vents: readonly Emitter[] = DISTRICT_M0_VENTS;
  private pose: AudioListenerPose = DEFAULT_POSE;

  private musicOn = false;
  private step = 0;
  private nextStep = 0;
  private mood: MusicMood | null = null;
  private fadeFrom: MusicMood | null = null;
  private moodChangedAt = -Infinity;
  /** Last start of each cue; identical cues in the same instant would only phase and cost voices. */
  private readonly lastCue = new Map<AudioCue, number>();
  private nextDrop = 0;
  private nextCar = 0;
  private lastTick = 0;
  private lastHum = -1;
  private lastSteam = -1;
  private lastMix: { hum: EmitterMix; steam: EmitterMix } = { hum: { gain: 0, pan: 0 }, steam: { gain: 0, pan: 0 } };

  constructor(private readonly opts: SynthAudioOptions = {}) {
    this.pool = new VoicePool(opts.maxVoices ?? 40);
  }

  /** True once a context exists. */
  get ready(): boolean {
    return this.g !== null;
  }

  /** Voices currently held in the pool (for tests and the perf overlay). */
  get voiceCount(): number {
    return this.pool.size;
  }

  /** Last positional mix of the neon hum and steam (debug overlay, tests). */
  get positional(): { readonly hum: EmitterMix; readonly steam: EmitterMix } {
    return this.lastMix;
  }

  get currentMood(): MusicMood {
    return this.director.mood(this.g?.ctx.currentTime ?? 0);
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
        this.g = this.buildGraph(ctx);
      } catch {
        this.failed = true;
        this.g = null;
        return;
      }
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
    this.director.notify(cue, now);
    if (!g) return;
    const last = this.lastCue.get(cue);
    if (last !== undefined && now - last < CUE_RETRIGGER && now >= last) return;
    this.lastCue.set(cue, now);
    const r = CUES[cue];
    const dest = r.crush ? g.crusher : g.buses.sfx;
    for (const v of r.voices) this.voice(g, v, now + (v.start ?? 0), dest, r.priority ?? PRIORITY.sfx, 1, r.send ?? 0);
    this.refreshMood(now);
  }

  stopAll(): void {
    this.stopTimer();
    const g = this.g;
    const now = g?.ctx.currentTime ?? 0;
    for (const v of this.pool.drain()) this.kill(v, now);
    const a = this.ambience;
    if (a) {
      a.out.gain.setTargetAtTime(0, now, 0.03);
      for (const s of a.sources) s.stop(now + 0.2);
      this.ambience = null;
    }
    this.musicOn = false;
    this.mood = null;
    this.fadeFrom = null;
    if (g) for (const l of LAYERS) g.layers[l].gain.setTargetAtTime(0, now, 0.05);
  }

  // ------------------------------------------------------------------------ AudioScenePort

  setMood(mood: MusicMood): void {
    this.director.setBase(mood);
    if (this.g) this.refreshMood(this.g.ctx.currentTime);
    else this.mix.setDucked(mood === "dialog");
  }

  setListener(pose: AudioListenerPose): void {
    this.pose = pose;
    if (this.g && this.ambience) this.updatePositional(this.g.ctx.currentTime, false);
  }

  setVolume(bus: AudioBus, value: number): void {
    this.mix.set(bus, value);
    if (this.g) this.applyBus(bus, this.g.ctx.currentTime);
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
    if (!this.ambience) this.ambience = this.buildAmbience(g);
    if (!this.musicOn) {
      this.musicOn = true;
      this.step = 0;
      this.nextStep = now + 0.1;
      this.nextDrop = now + 0.2;
      this.nextCar = now + 3;
    }
    this.lastTick = now;
    this.refreshMood(now);
    this.updatePositional(now, true);
    this.startTimer();
  }

  /** One scheduler step; driven by the internal timer, public for tests. */
  tick(): void {
    const g = this.g;
    if (!g) return;
    const now = g.ctx.currentTime;
    const dt = Math.min(0.25, Math.max(0, now - this.lastTick));
    this.lastTick = now;
    this.pool.prune(now);
    this.refreshMood(now);
    if (this.musicOn) this.scheduleMusic(g, now);
    if (this.ambience) this.scheduleAmbience(g, now);
    const n = this.steps.advance(this.pose.speed, dt);
    for (let i = 0; i < n; i++) this.footstep(g, now + 0.01 + i * 0.05);
  }

  // --------------------------------------------------------------------------------- Graph

  private buildGraph(ctx: AudioContext): Graph {
    const gain = (v: number) => {
      const n = ctx.createGain();
      n.gain.value = v;
      return n;
    };
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.22;
    compressor.connect(ctx.destination);
    const master = gain(this.mix.gain("master"));
    master.connect(compressor);

    const buses = { music: gain(this.mix.gain("music")), sfx: gain(this.mix.gain("sfx")), ambience: gain(this.mix.gain("ambience")) };
    const musicFilter = ctx.createBiquadFilter();
    musicFilter.type = "lowpass";
    musicFilter.frequency.value = MOOD_CUTOFF.explore;
    buses.music.connect(musicFilter).connect(master);
    buses.sfx.connect(master);
    buses.ambience.connect(master);

    const layers = {} as Record<Layer, GainNode>;
    for (const l of LAYERS) {
      layers[l] = gain(0);
      layers[l].connect(buses.music);
    }
    // Synthwave echo on arp and lead: dotted-eighth feedback delay.
    const echo = gain(0.3);
    const delay = ctx.createDelay(1);
    delay.delayTime.value = STEP_SECONDS * 3;
    const feedback = gain(0.38);
    const echoTone = ctx.createBiquadFilter();
    echoTone.type = "lowpass";
    echoTone.frequency.value = 2200;
    echo.connect(delay).connect(echoTone).connect(feedback).connect(delay);
    echoTone.connect(buses.music);

    // Alley reverb: generated impulse response, returned into the SFX bus.
    const noise = this.makeNoise(ctx);
    const reverb = gain(1);
    const convolver = ctx.createConvolver();
    convolver.buffer = this.makeAlleyImpulse(ctx);
    const wet = gain(0.55);
    reverb.connect(convolver).connect(wet).connect(buses.sfx);

    // Bitcrusher for the memory glitch: amplitude quantised to a few levels.
    const crusher = gain(1);
    const shaper = ctx.createWaveShaper();
    shaper.curve = crushCurve(6);
    crusher.connect(shaper).connect(buses.sfx);

    return { ctx, master, compressor, buses, musicFilter, layers, echo, reverb, crusher, noise };
  }

  private buildAmbience(g: Graph): Ambience {
    const { ctx } = g;
    const sources: AudioScheduledSourceNode[] = [];
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
    out.connect(g.buses.ambience);
    const loop = (rate: number) => {
      const s = ctx.createBufferSource();
      s.buffer = g.noise;
      s.loop = true;
      s.playbackRate.value = rate;
      sources.push(s);
      return s;
    };
    const filter = (type: BiquadFilterType, freq: number, q = 0.7) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      return f;
    };
    const gain = (v: number) => {
      const n = ctx.createGain();
      n.gain.value = v;
      return n;
    };
    const lfo = (freq: number, depth: number, target: AudioParam) => {
      const o = ctx.createOscillator();
      o.frequency.value = freq;
      const d = gain(depth);
      o.connect(d).connect(target);
      sources.push(o);
    };
    const panner = (): StereoPannerNode | null => (typeof ctx.createStereoPanner === "function" ? ctx.createStereoPanner() : null);
    const chain = (nodes: (AudioNode | null)[]) => {
      let prev: AudioNode | null = null;
      for (const n of nodes) {
        if (!n) continue;
        if (prev) prev.connect(n);
        prev = n;
      }
    };

    // Rain: a hiss band plus the low wash of water on asphalt, slowly breathing.
    const rain = loop(1);
    const hiss = gain(0.26);
    chain([rain, filter("highpass", 600), filter("lowpass", 7500), hiss, out]);
    lfo(0.09, 0.06, hiss.gain);
    const wash = gain(0.2);
    chain([rain, filter("lowpass", 320), wash, out]);
    // Distant traffic: deep rumble whose cutoff swells as unseen cars pass.
    const traffic = loop(0.37);
    const rumbleTone = filter("lowpass", 140);
    chain([traffic, rumbleTone, gain(0.32), out]);
    lfo(0.045, 70, rumbleTone.frequency);
    // Neon hum: 50 Hz mains and harmonics with a nervous flicker.
    const hum = gain(0);
    const humPan = panner();
    const flicker = gain(0.85);
    const tone = filter("lowpass", 520);
    for (const [type, freq, level] of [["sawtooth", 50, 0.5], ["sine", 100, 0.6], ["square", 150, 0.08]] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const lv = gain(level);
      o.connect(lv).connect(tone);
      sources.push(o);
    }
    chain([tone, flicker, hum, humPan, out]);
    lfo(7.3, 0.12, flicker.gain);
    // Steam: band-passed noise puffing out of vents.
    const steamSrc = loop(1.31);
    const puff = gain(0.6);
    const steam = gain(0);
    const steamPan = panner();
    chain([steamSrc, filter("bandpass", 2600, 0.6), puff, steam, steamPan, out]);
    lfo(0.23, 0.4, puff.gain);

    for (const s of sources) s.start();
    return { sources, out, hum, humPan, steam, steamPan };
  }

  // ------------------------------------------------------------------------------ Schedule

  private refreshMood(now: number): void {
    const g = this.g;
    if (!g) return;
    const mood = this.director.mood(now);
    const ducked = this.director.baseMood === "dialog";
    if (ducked !== this.mix.isDucked) {
      this.mix.setDucked(ducked);
      this.applyBus("music", now);
    }
    if (mood === this.mood || !this.musicOn) return;
    this.fadeFrom = this.mood;
    this.mood = mood;
    this.moodChangedAt = now;
    for (const l of LAYERS) g.layers[l].gain.setTargetAtTime(LAYER_MIX[mood][l] * LAYER_LEVEL[l], now, LAYER_TC);
    g.musicFilter.frequency.setTargetAtTime(MOOD_CUTOFF[mood], now, LAYER_TC);
  }

  private applyBus(bus: AudioBus, now: number): void {
    const g = this.g;
    if (!g) return;
    const node = bus === "master" ? g.master : g.buses[bus];
    node.gain.setTargetAtTime(this.mix.gain(bus), now, 0.08);
  }

  private scheduleMusic(g: Graph, now: number): void {
    // After a stall (background tab) skip ahead instead of firing a burst of notes.
    if (this.nextStep < now - 0.1) this.nextStep = now + 0.05;
    const mood = this.mood ?? "explore";
    const from = now - this.moodChangedAt < LAYER_TC * 5 ? this.fadeFrom : null;
    while (this.nextStep < now + LOOKAHEAD) {
      for (const e of this.sequencer.at(this.step)) {
        // Silent layers play nothing, unless they are still fading out.
        if (LAYER_MIX[mood][e.layer] === 0 && (!from || LAYER_MIX[from][e.layer] === 0)) continue;
        this.note(g, e, this.nextStep);
      }
      this.step = (this.step + 1) % LOOP_STEPS;
      this.nextStep += STEP_SECONDS;
    }
  }

  private note(g: Graph, e: NoteEvent, at: number): void {
    const dest = g.layers[e.layer];
    const hz = midiToHz(e.midi);
    const p = PRIORITY.music;
    switch (e.layer) {
      case "pad":
        this.voice(g, { type: "sawtooth", freq: hz, dur: e.dur, gain: 0.06 * e.vel, attack: 0.9, filter: 1100 }, at, dest, p);
        break;
      case "bass":
        this.voice(g, { type: "sawtooth", freq: hz, dur: e.dur, gain: 0.22 * e.vel, attack: 0.008, filter: 420, filterTo: 160, q: 4 }, at, dest, p);
        break;
      case "arp":
        this.voice(g, { type: "square", freq: hz, dur: e.dur, gain: 0.05 * e.vel, attack: 0.004, filter: 2600, filterTo: 900 }, at, dest, p, 1, 0, 0.5);
        break;
      case "lead":
        this.voice(g, { type: "sawtooth", freq: hz, dur: e.dur, gain: 0.07 * e.vel, attack: 0.03, filter: 3200, q: 2 }, at, dest, p, 1, 0, 0.6);
        break;
      case "drums":
        if (e.drum === "kick") this.voice(g, { type: "sine", freq: 130, to: 42, dur: e.dur, gain: 0.5 * e.vel, attack: 0.002 }, at, dest, p);
        else if (e.drum === "snare") {
          this.voice(g, { type: "noise", freq: 0, dur: e.dur, gain: 0.22 * e.vel, filter: 1900, filterType: "bandpass", q: 0.8, attack: 0.001 }, at, dest, p);
          this.voice(g, { type: "triangle", freq: 190, to: 140, dur: 0.08, gain: 0.12 * e.vel, attack: 0.001 }, at, dest, p);
        } else this.voice(g, { type: "noise", freq: 0, dur: e.dur, gain: 0.07 * e.vel, filter: 8000, filterType: "highpass", attack: 0.001 }, at, dest, p);
        break;
    }
  }

  private scheduleAmbience(g: Graph, now: number): void {
    const dest = g.buses.ambience;
    if (this.nextDrop < now - 0.1) this.nextDrop = now;
    while (this.nextDrop < now + LOOKAHEAD) {
      // Single drops on puddles, awnings and metal: short pitched blips scattered in stereo.
      const metal = this.rnd() < 0.18;
      const freq = metal ? 1100 + this.rnd() * 900 : 2200 + this.rnd() * 3200;
      this.voice(
        g,
        { type: metal ? "sine" : "triangle", freq, to: freq * (metal ? 0.92 : 0.55), dur: metal ? 0.14 : 0.035 + this.rnd() * 0.03, gain: 0.008 + this.rnd() * 0.03, attack: 0.001, pan: this.rnd() * 1.8 - 0.9 },
        this.nextDrop,
        dest,
        PRIORITY.ambience,
      );
      this.nextDrop += 0.04 + -Math.log(1 - this.rnd()) * 0.12;
    }
    if (now >= this.nextCar) {
      // A car hissing past on wet asphalt, somewhere beyond the block.
      const dir = this.rnd() < 0.5 ? -1 : 1;
      this.voice(
        g,
        { type: "noise", freq: 0, dur: 4.5, gain: 0.07, attack: 2, filter: 380, filterTo: 900, filterType: "bandpass", q: 0.9, pan: -0.85 * dir, panTo: 0.85 * dir },
        now,
        dest,
        PRIORITY.ambience,
      );
      this.nextCar = now + 5 + this.rnd() * 9;
    }
  }

  private updatePositional(now: number, force: boolean): void {
    const a = this.ambience;
    if (!a) return;
    const hum = emitterMix(this.pose, this.neon, 2.5, 26);
    const steam = emitterMix(this.pose, this.vents, 1.5, 18);
    this.lastMix = { hum, steam };
    // Parameter changes only when they are audible: no automation churn every frame.
    if (force || Math.abs(hum.gain - this.lastHum) > 0.01) {
      a.hum.gain.setTargetAtTime(0.03 + hum.gain * 0.22, now, LISTENER_TC);
      a.humPan?.pan.setTargetAtTime(hum.pan * 0.8, now, LISTENER_TC);
      this.lastHum = hum.gain;
    }
    if (force || Math.abs(steam.gain - this.lastSteam) > 0.01) {
      a.steam.gain.setTargetAtTime(steam.gain * 0.25, now, LISTENER_TC);
      a.steamPan?.pan.setTargetAtTime(steam.pan * 0.8, now, LISTENER_TC);
      this.lastSteam = steam.gain;
    }
  }

  /** Wet asphalt: a dull heel, a splash and a low thud, louder and brighter when running. */
  private footstep(g: Graph, at: number): void {
    const speed = this.pose.speed;
    const k = Math.min(1, Math.max(0.4, speed / 6.5));
    const pan = this.steps.nextFoot() * 0.08;
    const p = PRIORITY.footstep;
    const dest = g.buses.sfx;
    const pitch = 0.92 + this.rnd() * 0.16;
    this.voice(g, { type: "noise", freq: 0, dur: 0.07, gain: 0.13, filter: (650 + speed * 90) * pitch, attack: 0.002, pan }, at, dest, p, k);
    this.voice(g, { type: "noise", freq: 0, dur: 0.1 + 0.03 * k, gain: 0.06, filter: 4200 * pitch, filterTo: 2400, filterType: "bandpass", q: 1.2, attack: 0.004, pan }, at + 0.012, dest, p, k);
    this.voice(g, { type: "sine", freq: 75 * pitch, to: 48, dur: 0.07, gain: 0.12, attack: 0.002 }, at, dest, p, k);
  }

  /** Builds one voice if the pool admits it; the nodes are disposable (single-use sources). */
  private voice(g: Graph, v: Voice, at: number, dest: AudioNode, priority: number, scale = 1, send = 0, echo = 0): void {
    const { ctx } = g;
    const now = ctx.currentTime;
    // Ask first, so a refused voice costs no nodes.
    if (!this.pool.canClaim(priority, now)) return;
    const attack = Math.min(v.attack ?? 0.005, v.dur * 0.5);
    const end = at + v.dur + 0.03;
    const env = ctx.createGain();
    let src: AudioScheduledSourceNode;
    let buffer: AudioBufferSourceNode | null = null;
    if (v.type === "noise") {
      buffer = ctx.createBufferSource();
      buffer.buffer = g.noise;
      buffer.loop = true;
      src = buffer;
    } else {
      const o = ctx.createOscillator();
      o.type = v.type;
      o.frequency.setValueAtTime(v.freq, at);
      if (v.to) o.frequency.exponentialRampToValueAtTime(v.to, at + v.dur);
      if (v.bend) {
        o.detune.setValueAtTime(0, at);
        o.detune.linearRampToValueAtTime(v.bend, at + v.dur);
      }
      src = o;
    }
    const claimed = this.pool.claim({ src, env }, priority, now, end);
    if (claimed.ok && claimed.evicted) this.kill(claimed.evicted, now);
    this.wire(g, v, at, attack, scale, src, env, dest, send, echo);
    // Noise starts at a random offset so repeated bursts do not sound identical.
    if (buffer) buffer.start(at, this.rnd() * 1.5);
    else src.start(at);
    src.stop(end);
  }

  private wire(g: Graph, v: Voice, at: number, attack: number, scale: number, src: AudioNode, env: GainNode, dest: AudioNode, send: number, echo: number): void {
    const { ctx } = g;
    const peak = Math.max(SILENT * 2, v.gain * scale);
    env.gain.setValueAtTime(SILENT, at);
    env.gain.linearRampToValueAtTime(peak, at + attack);
    env.gain.exponentialRampToValueAtTime(SILENT, at + v.dur);
    let node: AudioNode = src;
    if (v.filter) {
      const f = ctx.createBiquadFilter();
      f.type = v.filterType ?? "lowpass";
      f.frequency.setValueAtTime(v.filter, at);
      if (v.filterTo) f.frequency.exponentialRampToValueAtTime(v.filterTo, at + v.dur);
      if (v.q) f.Q.value = v.q;
      node = node.connect(f);
    }
    node = node.connect(env);
    if (v.pan !== undefined && typeof ctx.createStereoPanner === "function") {
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(v.pan, at);
      if (v.panTo !== undefined) p.pan.linearRampToValueAtTime(v.panTo, at + v.dur);
      node = node.connect(p);
    }
    node.connect(dest);
    if (send > 0) {
      const s = ctx.createGain();
      s.gain.value = send;
      node.connect(s).connect(g.reverb);
    }
    if (echo > 0) {
      const s = ctx.createGain();
      s.gain.value = echo;
      node.connect(s).connect(g.echo);
    }
  }

  /** Stops a voice with a short fade so stealing it does not click. */
  private kill(v: PlayingVoice, now: number): void {
    const gain = v.env.gain;
    // Hold the current envelope value instead of jumping back to an earlier event.
    if (typeof gain.cancelAndHoldAtTime === "function") gain.cancelAndHoldAtTime(now);
    else gain.cancelScheduledValues(now);
    gain.setTargetAtTime(0, now, 0.008);
    try {
      v.src.stop(now + 0.05);
    } catch {
      // Already stopped.
    }
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

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    const rnd = mulberry32(22222);
    for (let i = 0; i < data.length; i++) data[i] = rnd() * 2 - 1;
    return buf;
  }

  /** Narrow alley: a few hard slaps off the walls, then a 1.6 s dark tail. */
  private makeAlleyImpulse(ctx: AudioContext): AudioBuffer {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * 1.6);
    const buf = ctx.createBuffer(2, len, rate);
    const rnd = mulberry32(0xa11e);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / rate;
        // One-pole low-pass darkens the tail as it decays.
        const k = 0.5 - 0.42 * Math.min(1, t / 1.2);
        lp += k * (rnd() * 2 - 1 - lp);
        d[i] = lp * Math.exp(-t / 0.38) * 0.9;
      }
      for (const [ms, amp] of [[11, 0.7], [19, 0.5], [31, 0.4], [47, 0.25]] as const) {
        const i = Math.floor(((ms + ch * 3) / 1000) * rate);
        if (i < len) d[i] = (d[i] ?? 0) + amp * (ch ? -1 : 1);
      }
    }
    return buf;
  }
}

/** Per-layer trim so the mix tables can stay in 0..1. */
const LAYER_LEVEL: Readonly<Record<Layer, number>> = { pad: 0.9, bass: 0.8, arp: 0.7, drums: 0.8, lead: 0.6 };

/** Staircase transfer curve: `levels` steps per polarity. */
export const crushCurve = (levels: number, size = 1024): Float32Array<ArrayBuffer> => {
  const c = new Float32Array(new ArrayBuffer(size * 4));
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    c[i] = Math.round(x * levels) / levels;
  }
  return c;
};
