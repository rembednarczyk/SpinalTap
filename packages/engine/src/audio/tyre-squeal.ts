import type { EngineSound } from "@seki/core";
import type { Graph } from "./audio-graph";

/*
 * The tyres' squeal (ADR-0097 §3, "pisk opon z poślizgu"), synthesized: a rubber tread sliding on
 * asphalt sings as a stick-slip oscillator, a harsh tone of a few hundred Hz rich in harmonics with
 * a hiss over it. Two detuned sawtooths through a band-pass with a slow wobble of pitch, and noise
 * through a higher band: the usual recipe of synthesized tyre screeches (procedural audio, A. Farnell,
 * *Designing Sound*, 2010). Silent with the tyres gripping; from the slide `SQUEAL_FROM` on it rises
 * with the square of the slide and its pitch with it.
 */

/** The slide (0..1, `EngineSound.skid`) from which the tyres squeal: past the grip's peak, not in an ordinary bend. */
export const SQUEAL_FROM = 0.35;
/** Level at a full slide; the tone's pitch from the squeal's start to a full slide (Hz). */
export const SQUEAL_LEVEL = 0.14;
export const SQUEAL_PITCH = { from: 620, full: 900 } as const;
const DETUNE = 1.06;
const WOBBLE = { rate: 6, depth: 18 } as const;
const HISS = { freq: 2400, share: 0.6 } as const;
const FOLLOW = 0.04;
const FADE = 0.15;

/** How hard the tyres squeal (0 none .. 1 a full slide) for the car's slide (pure; tests). */
export const squealOf = (e: EngineSound): number => {
  const s = Math.min(1, Math.max(0, ((e.skid ?? 0) - SQUEAL_FROM) / (1 - SQUEAL_FROM)));
  return s * s;
};

/** Level and pitch of the squeal for the car's slide (pure; tests). */
export const squealVoice = (e: EngineSound): { level: number; freq: number } => {
  const s = squealOf(e);
  return { level: SQUEAL_LEVEL * s, freq: SQUEAL_PITCH.from + (SQUEAL_PITCH.full - SQUEAL_PITCH.from) * Math.sqrt(s) };
};

interface Voice {
  readonly sources: readonly AudioScheduledSourceNode[];
  readonly tones: readonly OscillatorNode[];
  readonly band: BiquadFilterNode;
  readonly level: GainNode;
}

/** The squeal while the car runs: started with the engine, stopped with it; silent while the tyres grip. */
export class TyreSqueal {
  private voice: Voice | null = null;

  get playing(): boolean {
    return this.voice !== null;
  }

  /** Starts it if need be and follows the slide. */
  follow(g: Graph, now: number, e: EngineSound): void {
    const v = this.voice ?? this.start(g, now);
    const s = squealVoice(e);
    v.tones[0]!.frequency.setTargetAtTime(s.freq, now, FOLLOW);
    v.tones[1]!.frequency.setTargetAtTime(s.freq * DETUNE, now, FOLLOW);
    v.band.frequency.setTargetAtTime(s.freq * 2, now, FOLLOW);
    v.level.gain.setTargetAtTime(s.level, now, FOLLOW);
  }

  stop(now: number): void {
    const v = this.voice;
    if (!v) return;
    v.level.gain.setTargetAtTime(0, now, FADE / 3);
    for (const s of v.sources) s.stop(now + FADE);
    this.voice = null;
  }

  private start(g: Graph, now: number): Voice {
    const { ctx } = g;
    const level = ctx.createGain();
    level.gain.value = 0;
    level.connect(g.buses.sfx);
    // The tread's tone: two detuned sawtooths, their pitch wobbling, through a band an octave up.
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = SQUEAL_PITCH.from * 2;
    band.Q.value = 2;
    band.connect(level);
    const wobble = ctx.createOscillator();
    wobble.frequency.value = WOBBLE.rate;
    const depth = ctx.createGain();
    depth.gain.value = WOBBLE.depth;
    wobble.connect(depth);
    const tones = [SQUEAL_PITCH.from, SQUEAL_PITCH.from * DETUNE].map((f) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      depth.connect(o.frequency);
      o.connect(band);
      return o;
    });
    // The hiss of the rubber over it.
    const hiss = ctx.createBufferSource();
    hiss.buffer = g.noise;
    hiss.loop = true;
    const hissBand = ctx.createBiquadFilter();
    hissBand.type = "bandpass";
    hissBand.frequency.value = HISS.freq;
    hissBand.Q.value = 1.5;
    const hissLevel = ctx.createGain();
    hissLevel.gain.value = HISS.share;
    hiss.connect(hissBand).connect(hissLevel).connect(level);
    const sources = [wobble, ...tones, hiss];
    for (const s of sources) s.start(now);
    this.voice = { sources, tones, band, level };
    return this.voice;
  }
}
