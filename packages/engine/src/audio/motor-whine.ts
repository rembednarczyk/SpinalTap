import type { EngineSound } from "@seki/core";
import type { Graph } from "./audio-graph";

/**
 * The electric motor of the hybrid over its engine (user's notes of 21.11): the whine of a traction
 * motor and its inverter, which follows the wheels (the motor is geared to them), not the engine's
 * revs, and swells under the throttle. Synthesized, as real electric cars' sounds are (the AVAS
 * warning sounds are designed tones): a sine at the motor's tone, a quieter partial a little under
 * three times higher for the inverter's edge, both through a band-pass that opens with the speed.
 */

/** The motor's tone at a standstill and at `TOP` (Hz); the inverter's partial as a multiple of it. */
export const WHINE_PITCH = { rest: 160, top: 1500 } as const;
const PARTIAL = 2.92;
/** The speed (m/s) at which the tone tops out: some 160 km/h. */
const TOP = 45;
/** Level at a standstill, coasting and pulling, at the motor's full speed. */
const LEVEL = { rest: 0.015, coast: 0.05, pull: 0.11 } as const;
const FOLLOW = 0.06;
const FADE = 0.25;

/** Pitch and level of the whine for the engine's state (pure; tests). */
export const whineVoice = (e: EngineSound): { freq: number; level: number } => {
  const s = Math.min(1, Math.max(0, Math.abs(e.speed) / TOP));
  const throttle = Math.min(1, Math.max(0, e.throttle));
  // Pitch with the speed, a curve that rises fast at first as a motor's whine does when it pulls away.
  const freq = WHINE_PITCH.rest + (WHINE_PITCH.top - WHINE_PITCH.rest) * Math.sqrt(s);
  const level = LEVEL.rest + Math.sqrt(s) * (LEVEL.coast + (LEVEL.pull - LEVEL.coast) * throttle);
  return { freq, level };
};

interface Voice {
  readonly tone: OscillatorNode;
  readonly edge: OscillatorNode;
  readonly band: BiquadFilterNode;
  readonly level: GainNode;
}

/** The whine's voice while the car runs: started with the engine, stopped with it. */
export class MotorWhine {
  private voice: Voice | null = null;

  get playing(): boolean {
    return this.voice !== null;
  }

  /** Starts it if need be and follows the engine's state. */
  follow(g: Graph, now: number, e: EngineSound): void {
    const v = this.voice ?? this.start(g, now);
    const w = whineVoice(e);
    v.tone.frequency.setTargetAtTime(w.freq, now, FOLLOW);
    v.edge.frequency.setTargetAtTime(w.freq * PARTIAL, now, FOLLOW);
    v.band.frequency.setTargetAtTime(w.freq * 1.6, now, FOLLOW);
    v.level.gain.setTargetAtTime(w.level, now, FOLLOW);
  }

  stop(now: number): void {
    const v = this.voice;
    if (!v) return;
    v.level.gain.setTargetAtTime(0, now, FADE / 3);
    v.tone.stop(now + FADE);
    v.edge.stop(now + FADE);
    this.voice = null;
  }

  private start(g: Graph, now: number): Voice {
    const { ctx } = g;
    const tone = ctx.createOscillator();
    tone.type = "sine";
    tone.frequency.value = WHINE_PITCH.rest;
    const edge = ctx.createOscillator();
    edge.type = "triangle";
    edge.frequency.value = WHINE_PITCH.rest * PARTIAL;
    const edgeLevel = ctx.createGain();
    edgeLevel.gain.value = 0.35;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 0.8;
    const level = ctx.createGain();
    level.gain.value = 0;
    tone.connect(band);
    edge.connect(edgeLevel).connect(band);
    band.connect(level).connect(g.buses.sfx);
    tone.start(now);
    edge.start(now);
    this.voice = { tone, edge, band, level };
    return this.voice;
  }
}
