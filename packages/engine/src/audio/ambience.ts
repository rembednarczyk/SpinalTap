import type { AudioListenerPose } from "@seki/core";
import type { Graph } from "./audio-graph";
import type { AudioSampleManifest, SampleBank } from "./samples";
import { DISTRICT_M0_VENTS, type Emitter, type EmitterMix, emitterMix, neonEmitters } from "./spatial";
import type { SynthVoices } from "./synth-voices";
import { PRIORITY } from "./voice-pool";

const LOOKAHEAD = 0.25;
const LISTENER_TC = 0.15;

/** Nodes of the looping ambience, rebuilt by `start` after `stop`. */
interface Ambience {
  readonly sources: AudioScheduledSourceNode[];
  readonly out: GainNode;
  readonly hum: GainNode;
  readonly humPan: StereoPannerNode | null;
  readonly steam: GainNode;
  readonly steamPan: StereoPannerNode | null;
  /** Level of the synthesized rain (hiss and wash), lowered once the recorded loop runs. */
  readonly rainSynth: GainNode;
  /** The recorded rain loop, once its buffer is decoded. */
  rainLoop: AudioBufferSourceNode | null;
}

/** Small node factories over one context; every source made here is collected in `sources`. */
const nodeKit = (g: Graph, sources: AudioScheduledSourceNode[]) => {
  const { ctx } = g;
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
  return { ctx, sources, loop, filter, gain, lfo, panner, chain };
};

type NodeKit = ReturnType<typeof nodeKit>;

/** Rain: a hiss band plus the low wash of water on asphalt, slowly breathing. */
const buildRain = (k: NodeKit, out: GainNode): GainNode => {
  const rainSynth = k.gain(1);
  rainSynth.connect(out);
  const rain = k.loop(1);
  const hiss = k.gain(0.26);
  k.chain([rain, k.filter("highpass", 600), k.filter("lowpass", 7500), hiss, rainSynth]);
  k.lfo(0.09, 0.06, hiss.gain);
  const wash = k.gain(0.2);
  k.chain([rain, k.filter("lowpass", 320), wash, rainSynth]);
  return rainSynth;
};

/** Distant traffic: deep rumble whose cutoff swells as unseen cars pass. */
const buildTraffic = (k: NodeKit, out: GainNode): void => {
  const traffic = k.loop(0.37);
  const rumbleTone = k.filter("lowpass", 140);
  k.chain([traffic, rumbleTone, k.gain(0.32), out]);
  k.lfo(0.045, 70, rumbleTone.frequency);
};

/** Neon hum: 50 Hz mains and harmonics with a nervous flicker. */
const buildHum = (k: NodeKit, out: GainNode): { hum: GainNode; humPan: StereoPannerNode | null } => {
  const hum = k.gain(0);
  const humPan = k.panner();
  const flicker = k.gain(0.85);
  const tone = k.filter("lowpass", 520);
  for (const [type, freq, level] of [["sawtooth", 50, 0.5], ["sine", 100, 0.6], ["square", 150, 0.08]] as const) {
    const o = k.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const lv = k.gain(level);
    o.connect(lv).connect(tone);
    k.sources.push(o);
  }
  k.chain([tone, flicker, hum, humPan, out]);
  k.lfo(7.3, 0.12, flicker.gain);
  return { hum, humPan };
};

/** Steam: band-passed noise puffing out of vents. */
const buildSteam = (k: NodeKit, out: GainNode): { steam: GainNode; steamPan: StereoPannerNode | null } => {
  const steamSrc = k.loop(1.31);
  const puff = k.gain(0.6);
  const steam = k.gain(0);
  const steamPan = k.panner();
  k.chain([steamSrc, k.filter("bandpass", 2600, 0.6), puff, steam, steamPan, out]);
  k.lfo(0.23, 0.4, puff.gain);
  return { steam, steamPan };
};

/**
 * The street soundscape: looping rain, traffic, neon hum and steam that follow the listener,
 * single raindrops and passing cars scheduled ahead, and the recorded rain loop once decoded.
 */
export class AmbientScape {
  private ambience: Ambience | null = null;
  private readonly neon: readonly Emitter[] = neonEmitters();
  private readonly vents: readonly Emitter[] = DISTRICT_M0_VENTS;
  private nextDrop = 0;
  private nextCar = 0;
  private lastHum = -1;
  private lastSteam = -1;
  private lastMix: { hum: EmitterMix; steam: EmitterMix } = { hum: { gain: 0, pan: 0 }, steam: { gain: 0, pan: 0 } };

  constructor(
    private readonly voices: SynthVoices,
    private readonly bank: SampleBank,
    private readonly samples: AudioSampleManifest,
    private readonly rnd: () => number,
  ) {}

  /** True while the recorded rain loop plays instead of the synthesized hiss alone. */
  get recordedRain(): boolean {
    return !!this.ambience?.rainLoop;
  }

  /** Last positional mix of the neon hum and steam. */
  get positional(): { readonly hum: EmitterMix; readonly steam: EmitterMix } {
    return this.lastMix;
  }

  /** Builds the loops if they are not running. */
  start(g: Graph): void {
    if (!this.ambience) this.ambience = this.build(g);
  }

  /** The first drop and the first car after the soundscape starts. */
  resetSchedule(now: number): void {
    this.nextDrop = now + 0.2;
    this.nextCar = now + 3;
  }

  stop(now: number): void {
    const a = this.ambience;
    if (!a) return;
    a.out.gain.setTargetAtTime(0, now, 0.03);
    for (const s of a.sources) s.stop(now + 0.2);
    this.ambience = null;
  }

  /** One scheduler step: drops and cars ahead, and the recorded rain once it is decoded. */
  tick(g: Graph, now: number): void {
    if (!this.ambience) return;
    this.schedule(g, now);
    this.startRecordedRain(g, this.ambience, now);
  }

  private build(g: Graph): Ambience {
    const { ctx } = g;
    const sources: AudioScheduledSourceNode[] = [];
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
    out.connect(g.buses.ambience);
    const k = nodeKit(g, sources);
    const rainSynth = buildRain(k, out);
    buildTraffic(k, out);
    const { hum, humPan } = buildHum(k, out);
    const { steam, steamPan } = buildSteam(k, out);
    for (const s of sources) s.start();
    const a: Ambience = { sources, out, hum, humPan, steam, steamPan, rainSynth, rainLoop: null };
    this.startRecordedRain(g, a, ctx.currentTime);
    return a;
  }

  /** Swaps in the recorded rain loop as soon as it is decoded; the synth stays underneath. */
  private startRecordedRain(g: Graph, a: Ambience, now: number): void {
    const spec = this.samples.rain;
    if (a.rainLoop || !spec) return;
    const buffer = this.bank.get(spec.url);
    if (!buffer) return;
    const { ctx } = g;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const level = ctx.createGain();
    level.gain.value = 0;
    level.gain.setTargetAtTime(spec.gain ?? 1, now, 1.2);
    src.connect(level).connect(a.out);
    // Start inside the loop so a restart never begins on the same drop.
    src.start(now, this.rnd() * buffer.duration * 0.9);
    a.sources.push(src);
    a.rainLoop = src;
    a.rainSynth.gain.setTargetAtTime(Math.min(1, Math.max(0, spec.synthLevel ?? 0.3)), now, 1.2);
  }

  private schedule(g: Graph, now: number): void {
    const dest = g.buses.ambience;
    if (this.nextDrop < now - 0.1) this.nextDrop = now;
    while (this.nextDrop < now + LOOKAHEAD) {
      // Single drops on puddles, awnings and metal: short pitched blips scattered in stereo.
      const metal = this.rnd() < 0.18;
      const freq = metal ? 1100 + this.rnd() * 900 : 2200 + this.rnd() * 3200;
      this.voices.voice(
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
      this.voices.voice(
        g,
        { type: "noise", freq: 0, dur: 4.5, gain: 0.07, attack: 2, filter: 380, filterTo: 900, filterType: "bandpass", q: 0.9, pan: -0.85 * dir, panTo: 0.85 * dir },
        now,
        dest,
        PRIORITY.ambience,
      );
      this.nextCar = now + 5 + this.rnd() * 9;
    }
  }

  /** Neon hum and steam level and pan from the listener's pose; `force` applies them even when unchanged. */
  updatePositional(pose: AudioListenerPose, now: number, force: boolean): void {
    const a = this.ambience;
    if (!a) return;
    const hum = emitterMix(pose, this.neon, 2.5, 26);
    const steam = emitterMix(pose, this.vents, 1.5, 18);
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
}
