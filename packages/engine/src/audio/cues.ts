import type { AudioCue } from "@seki/core";
import { PRIORITY } from "./voice-pool";

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
  // Magazine out, magazine in: two short metallic clicks.
  reload: {
    send: 0.15,
    voices: [
      { type: "noise", freq: 0, dur: 0.03, gain: 0.14, filter: 2600, filterType: "bandpass", q: 4, attack: 0.001 },
      { type: "square", freq: 820, to: 520, dur: 0.03, gain: 0.05, filter: 3000, attack: 0.001 },
      { type: "noise", freq: 0, start: 0.22, dur: 0.04, gain: 0.18, filter: 1900, filterType: "bandpass", q: 3, attack: 0.001 },
      { type: "square", freq: 640, to: 380, start: 0.22, dur: 0.04, gain: 0.06, filter: 2400, attack: 0.001 },
    ],
  },
  "weapon-switch": {
    send: 0.1,
    voices: [
      { type: "noise", freq: 0, dur: 0.12, gain: 0.06, filter: 900, filterTo: 2400, filterType: "bandpass", q: 1.5, attack: 0.01 },
      { type: "triangle", freq: 1100, to: 700, start: 0.1, dur: 0.035, gain: 0.07, attack: 0.001 },
    ],
  },
  "loot-pickup": {
    priority: PRIORITY.ui,
    voices: [
      { type: "noise", freq: 0, dur: 0.1, gain: 0.07, filter: 1500, filterType: "lowpass", attack: 0.005 },
      { type: "sine", freq: 880, to: 1320, start: 0.04, dur: 0.08, gain: 0.08 },
    ],
  },
  // Coins on a counter.
  sell: {
    priority: PRIORITY.ui,
    voices: [
      { type: "triangle", freq: 2093, dur: 0.05, gain: 0.1, attack: 0.001 },
      { type: "triangle", freq: 2637, start: 0.06, dur: 0.06, gain: 0.09, attack: 0.001 },
      { type: "triangle", freq: 3136, start: 0.11, dur: 0.12, gain: 0.07, attack: 0.001 },
    ],
  },
  // A hammer on a rivet, twice.
  repair: {
    send: 0.2,
    voices: [
      { type: "noise", freq: 0, dur: 0.05, gain: 0.16, filter: 3200, filterType: "bandpass", q: 5, attack: 0.001 },
      { type: "sine", freq: 1760, to: 1500, dur: 0.12, gain: 0.06 },
      { type: "noise", freq: 0, start: 0.18, dur: 0.05, gain: 0.14, filter: 3000, filterType: "bandpass", q: 5, attack: 0.001 },
      { type: "sine", freq: 1700, to: 1450, start: 0.18, dur: 0.12, gain: 0.05 },
    ],
  },
  // Melee (ADR-0019): an air whoosh sweeping across the stereo field, a dull clack on a guard,
  // and a bright ring for a parry.
  swing: {
    send: 0.1,
    voices: [{ type: "noise", freq: 0, dur: 0.16, gain: 0.2, attack: 0.03, filter: 700, filterTo: 2600, filterType: "bandpass", q: 1.4, pan: -0.4, panTo: 0.4 }],
  },
  block: {
    send: 0.3,
    voices: [
      { type: "noise", freq: 0, dur: 0.06, gain: 0.3, filter: 2200, filterTo: 700, attack: 0.001 },
      { type: "triangle", freq: 420, to: 300, dur: 0.12, gain: 0.18 },
    ],
  },
  parry: {
    send: 0.45,
    voices: [
      { type: "noise", freq: 0, dur: 0.05, gain: 0.3, filter: 5000, filterTo: 2000, attack: 0.001 },
      { type: "triangle", freq: 1900, dur: 0.45, gain: 0.16 },
      { type: "sine", freq: 2850, dur: 0.35, gain: 0.08 },
    ],
  },
  // Jumps and landings (ADR-0021): a short scuff on take-off, a soft thud, a heavy one with a
  // body-fall low end when it was a long drop.
  jump: {
    send: 0.05,
    voices: [{ type: "noise", freq: 0, dur: 0.07, gain: 0.12, attack: 0.005, filter: 1800, filterTo: 900, filterType: "lowpass" }],
  },
  land: {
    send: 0.1,
    voices: [
      { type: "noise", freq: 0, dur: 0.06, gain: 0.18, attack: 0.002, filter: 1400, filterTo: 500, filterType: "lowpass" },
      { type: "sine", freq: 120, to: 60, dur: 0.1, gain: 0.16 },
    ],
  },
  "land-hard": {
    send: 0.25,
    voices: [
      { type: "noise", freq: 0, dur: 0.12, gain: 0.32, attack: 0.002, filter: 1600, filterTo: 300, filterType: "lowpass" },
      { type: "sine", freq: 90, to: 38, dur: 0.24, gain: 0.34 },
      { type: "triangle", freq: 260, to: 140, dur: 0.08, gain: 0.08 },
    ],
  },
};
