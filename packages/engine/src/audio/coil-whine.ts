import type { EngineSound } from "@seki/core";
import type { Graph } from "./audio-graph";

/**
 * A coil under load in the background of the engine (user's notes of 21.11, in place of the hybrid's
 * motor): the whine of an inductor's windings as the current through them changes (coil whine, the
 * magnetostriction of a loaded choke or transformer), quiet, under the engine. A narrow high tone
 * whose pitch and level follow the load, the throttle more than the revs, with the buzz of the
 * mains-like ripple on it: a tone through a narrow band-pass, its level shaken by a 120 Hz ripple.
 */

/** The tone at no load and at full load (Hz). */
export const COIL_PITCH = { idle: 2600, full: 6000 } as const;
/** Its level at no load and at full load: in the background, well under the engine. */
export const COIL_LEVEL = { idle: 0.004, full: 0.03 } as const;
/** The ripple's rate (Hz) and how deep it shakes the level (0..1). */
const RIPPLE = { rate: 120, depth: 0.45 } as const;
const FOLLOW = 0.08;
const FADE = 0.25;

/** The load on the coil: the throttle more than the revs (pure; tests). */
export const coilLoad = (e: EngineSound): number => {
  const rpm = Math.min(1, Math.max(0, e.rpm));
  const throttle = Math.min(1, Math.max(0, e.throttle));
  return 0.7 * throttle + 0.3 * rpm;
};

/** Pitch and level of the coil for the engine's state (pure; tests). */
export const coilVoice = (e: EngineSound): { freq: number; level: number } => {
  const load = coilLoad(e);
  return { freq: COIL_PITCH.idle + (COIL_PITCH.full - COIL_PITCH.idle) * load, level: COIL_LEVEL.idle + (COIL_LEVEL.full - COIL_LEVEL.idle) * load };
};

interface Voice {
  readonly tone: OscillatorNode;
  readonly ripple: OscillatorNode;
  readonly band: BiquadFilterNode;
  readonly level: GainNode;
}

/** The coil's voice while the car runs: started with the engine, stopped with it. */
export class CoilWhine {
  private voice: Voice | null = null;

  get playing(): boolean {
    return this.voice !== null;
  }

  /** Starts it if need be and follows the engine's load. */
  follow(g: Graph, now: number, e: EngineSound): void {
    const v = this.voice ?? this.start(g, now);
    const c = coilVoice(e);
    v.tone.frequency.setTargetAtTime(c.freq, now, FOLLOW);
    v.band.frequency.setTargetAtTime(c.freq, now, FOLLOW);
    v.level.gain.setTargetAtTime(c.level, now, FOLLOW);
  }

  stop(now: number): void {
    const v = this.voice;
    if (!v) return;
    v.level.gain.setTargetAtTime(0, now, FADE / 3);
    v.tone.stop(now + FADE);
    v.ripple.stop(now + FADE);
    this.voice = null;
  }

  private start(g: Graph, now: number): Voice {
    const { ctx } = g;
    const tone = ctx.createOscillator();
    tone.type = "triangle";
    tone.frequency.value = COIL_PITCH.idle;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = COIL_PITCH.idle;
    band.Q.value = 8;
    // The ripple shakes a gain around 1 - depth/2 by ± depth/2.
    const shaken = ctx.createGain();
    shaken.gain.value = 1 - RIPPLE.depth / 2;
    const ripple = ctx.createOscillator();
    ripple.type = "sawtooth";
    ripple.frequency.value = RIPPLE.rate;
    const depth = ctx.createGain();
    depth.gain.value = RIPPLE.depth / 2;
    ripple.connect(depth).connect(shaken.gain);
    const level = ctx.createGain();
    level.gain.value = 0;
    tone.connect(band).connect(shaken).connect(level).connect(g.buses.sfx);
    tone.start(now);
    ripple.start(now);
    this.voice = { tone, ripple, band, level };
    return this.voice;
  }
}
