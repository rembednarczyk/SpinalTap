import type { AudioCue, AudioPort } from "@seki/core";

/** Recipe for one synthesized cue: a list of oscillator/noise voices with simple envelopes. */
interface Voice {
  readonly type: OscillatorType | "noise";
  readonly freq: number;
  readonly to?: number;
  readonly start?: number;
  readonly dur: number;
  readonly gain: number;
  readonly filter?: number;
}

export const CUES: Readonly<Record<AudioCue, readonly Voice[]>> = {
  shot: [
    { type: "noise", freq: 0, dur: 0.12, gain: 0.5, filter: 2600 },
    { type: "square", freq: 140, to: 50, dur: 0.1, gain: 0.25 },
  ],
  "enemy-shot": [{ type: "noise", freq: 0, dur: 0.08, gain: 0.22, filter: 4200 }],
  hit: [{ type: "triangle", freq: 1800, to: 900, dur: 0.05, gain: 0.18 }],
  critical: [
    { type: "triangle", freq: 1400, dur: 0.05, gain: 0.2 },
    { type: "triangle", freq: 2400, start: 0.05, dur: 0.07, gain: 0.2 },
  ],
  hurt: [{ type: "sawtooth", freq: 110, to: 70, dur: 0.18, gain: 0.25, filter: 900 }],
  kill: [{ type: "sine", freq: 520, to: 120, dur: 0.35, gain: 0.25 }],
  "ui-select": [{ type: "sine", freq: 880, dur: 0.05, gain: 0.12 }],
  "quest-update": [
    { type: "sine", freq: 660, dur: 0.12, gain: 0.16 },
    { type: "sine", freq: 990, start: 0.12, dur: 0.2, gain: 0.16 },
  ],
  memory: [
    { type: "sine", freq: 440, dur: 1.4, gain: 0.12 },
    { type: "sine", freq: 554, start: 0.05, dur: 1.3, gain: 0.1 },
    { type: "sine", freq: 659, start: 0.1, dur: 1.2, gain: 0.1 },
    { type: "noise", freq: 0, dur: 0.6, gain: 0.08, filter: 6000 },
  ],
  save: [{ type: "square", freq: 1200, dur: 0.04, gain: 0.06 }],
  purchase: [
    { type: "triangle", freq: 1320, dur: 0.06, gain: 0.14 },
    { type: "triangle", freq: 1760, start: 0.07, dur: 0.1, gain: 0.14 },
  ],
  denied: [{ type: "square", freq: 180, dur: 0.16, gain: 0.1, filter: 1200 }],
  heal: [{ type: "sine", freq: 520, to: 880, dur: 0.35, gain: 0.14 }],
  overdrive: [
    { type: "sawtooth", freq: 220, to: 55, dur: 0.6, gain: 0.16, filter: 1600 },
    { type: "sine", freq: 110, dur: 0.9, gain: 0.12 },
  ],
};

/**
 * AudioPort on raw WebAudio. Every cue is synthesized, so M0 ships without audio assets.
 * The context is created lazily and resumed on the first user gesture (autoplay policy).
 */
export class SynthAudio implements AudioPort {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private ambience: AudioBufferSourceNode | null = null;
  private readonly active = new Set<AudioScheduledSourceNode>();

  volume = 0.6;

  unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise(this.ctx);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  play(cue: AudioCue): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    for (const v of CUES[cue]) this.voice(ctx, v, t0 + (v.start ?? 0));
  }

  /** Rain and distant city hum: low-passed looping noise. */
  startAmbience(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise || this.ambience) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.value = 0.07;
    src.connect(lp).connect(g).connect(this.master);
    src.start();
    this.ambience = src;
  }

  stopAll(): void {
    for (const s of this.active) s.stop();
    this.active.clear();
    this.ambience?.stop();
    this.ambience = null;
  }

  private voice(ctx: AudioContext, v: Voice, at: number): void {
    if (!this.master) return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(v.gain, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + v.dur);
    let src: AudioScheduledSourceNode;
    if (v.type === "noise") {
      const b = ctx.createBufferSource();
      b.buffer = this.noise;
      src = b;
    } else {
      const o = ctx.createOscillator();
      o.type = v.type;
      o.frequency.setValueAtTime(v.freq, at);
      if (v.to) o.frequency.exponentialRampToValueAtTime(v.to, at + v.dur);
      src = o;
    }
    let node: AudioNode = src;
    if (v.filter) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = v.filter;
      node = node.connect(f);
    }
    node.connect(g).connect(this.master);
    src.start(at);
    src.stop(at + v.dur + 0.02);
    this.active.add(src);
    src.onended = () => this.active.delete(src);
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // Presentation-only noise; deliberately outside the deterministic RNG.
    let seed = 22222;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 2147483647) * 2 - 1;
    }
    return buf;
  }
}
