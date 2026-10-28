import type { AudioBus } from "@seki/core";
import type { MixState } from "./mixer";
import { LAYERS, type Layer, MOOD_CUTOFF, STEP_SECONDS, mulberry32 } from "./music";

/** The fixed WebAudio graph: master and compressor, the buses, music layers, echo, reverb and bitcrusher. */
export interface Graph {
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

export const defaultContext = (): AudioContext | null => {
  const Ctor =
    typeof AudioContext !== "undefined"
      ? AudioContext
      : (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
};

const makeNoise = (ctx: AudioContext): AudioBuffer => {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buf.getChannelData(0);
  const rnd = mulberry32(22222);
  for (let i = 0; i < data.length; i++) data[i] = rnd() * 2 - 1;
  return buf;
};

/** Narrow alley: a few hard slaps off the walls, then a 1.6 s dark tail. */
const makeAlleyImpulse = (ctx: AudioContext): AudioBuffer => {
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
};

/** Staircase transfer curve: `levels` steps per polarity. */
export const crushCurve = (levels: number, size = 1024): Float32Array<ArrayBuffer> => {
  const c = new Float32Array(new ArrayBuffer(size * 4));
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    c[i] = Math.round(x * levels) / levels;
  }
  return c;
};

/** Builds the graph at the mixer's levels; the layers start silent. */
export const buildGraph = (ctx: AudioContext, mix: MixState): Graph => {
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
  const master = gain(mix.gain("master"));
  master.connect(compressor);

  const buses = { music: gain(mix.gain("music")), sfx: gain(mix.gain("sfx")), ambience: gain(mix.gain("ambience")) };
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
  const noise = makeNoise(ctx);
  const reverb = gain(1);
  const convolver = ctx.createConvolver();
  convolver.buffer = makeAlleyImpulse(ctx);
  const wet = gain(0.55);
  reverb.connect(convolver).connect(wet).connect(buses.sfx);

  // Bitcrusher for the memory glitch: amplitude quantised to a few levels.
  const crusher = gain(1);
  const shaper = ctx.createWaveShaper();
  shaper.curve = crushCurve(6);
  crusher.connect(shaper).connect(buses.sfx);

  return { ctx, master, compressor, buses, musicFilter, layers, echo, reverb, crusher, noise };
};

/** Eases a bus to the mixer's level. */
export const applyBus = (g: Graph, mix: MixState, bus: AudioBus, now: number): void => {
  const node = bus === "master" ? g.master : g.buses[bus];
  node.gain.setTargetAtTime(mix.gain(bus), now, 0.08);
};
