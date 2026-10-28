import { mulberry32 } from "./music";

/**
 * Radio of wave 2 (ADR-0036): three stations as parameter sets of the procedural sequencer of
 * ADR-0013. Each has its own tempo, scale, chord loop, timbre and drum pattern; the corporate
 * news station also has a reader (formant bursts that pass for speech) over a quiet bed.
 * Pure data and a pure generator, so the stations are tested without WebAudio.
 */

export type RadioStationId = "drift" | "yoru" | "tessen";

export const RADIO_STATION_IDS: readonly RadioStationId[] = ["drift", "yoru", "tessen"];

export type RadioLayer = "pad" | "bass" | "keys" | "lead" | "drums" | "voice";

export type RadioDrum = "kick" | "snare" | "hat" | "clap";

/** The sound of one layer: an oscillator through an enveloped filter. */
export interface Timbre {
  readonly type: OscillatorType;
  readonly gain: number;
  readonly attack: number;
  readonly filter: number;
  readonly filterTo?: number;
  readonly q?: number;
}

/** Sixteen steps per pattern, `x` hits and `.` rests. */
export interface DrumPattern {
  readonly kick: string;
  readonly snare: string;
  readonly hat: string;
  /** 0..0.5 of a step: every second 16th comes this much late. */
  readonly swing: number;
  /** Snare length: a long gated noise (synthwave, above 0.4) or a short dry clap (city pop). */
  readonly snareTail: number;
}

export interface StationParams {
  readonly id: RadioStationId;
  /** Dial label for the HUD. */
  readonly name: string;
  readonly frequency: string;
  readonly bpm: number;
  /** MIDI note of the tonic in the bass octave. */
  readonly root: number;
  /** Semitones of the scale from the tonic. */
  readonly scale: readonly number[];
  /** One chord per bar, as scale degrees (0 = tonic) of its root. */
  readonly progression: readonly number[];
  /** Four-note chords (maj7, m7) instead of triads. */
  readonly sevenths: boolean;
  readonly bass: "pulse" | "slap" | "drone";
  readonly keys: "arp" | "comp" | "bell";
  readonly lead: "phrase" | "melody" | null;
  readonly timbre: Readonly<Record<Exclude<RadioLayer, "drums" | "voice">, Timbre>>;
  readonly drums: DrumPattern | null;
  /** A news reader: formant bursts in phrases over the bed. */
  readonly voice: boolean;
}

export const RADIO_STATIONS: Readonly<Record<RadioStationId, StationParams>> = {
  // Night drive: D minor, i–VI–VII–i on saws, a sixteenth arpeggio, gated snare.
  drift: {
    id: "drift",
    name: "Neon Drift",
    frequency: "88.1",
    bpm: 100,
    root: 38,
    scale: [0, 2, 3, 5, 7, 8, 10],
    progression: [0, 5, 6, 0],
    sevenths: false,
    bass: "pulse",
    keys: "arp",
    lead: "phrase",
    timbre: {
      pad: { type: "sawtooth", gain: 0.055, attack: 0.6, filter: 1300 },
      bass: { type: "sawtooth", gain: 0.2, attack: 0.006, filter: 520, filterTo: 180, q: 5 },
      keys: { type: "square", gain: 0.045, attack: 0.004, filter: 3000, filterTo: 1000 },
      lead: { type: "sawtooth", gain: 0.06, attack: 0.04, filter: 3600, q: 2 },
    },
    drums: { kick: "x...x...x...x...", snare: "....x.......x...", hat: "..x...x...x...x.", swing: 0, snareTail: 0.6 },
    voice: false,
  },
  // Japanese city pop: F major, IVmaj7–iii7–vi7–Vsus over a slap bass, electric piano stabs, swing.
  yoru: {
    id: "yoru",
    name: "Yoru FM",
    frequency: "76.5",
    bpm: 112,
    root: 41,
    scale: [0, 2, 4, 5, 7, 9, 11],
    progression: [3, 2, 5, 4],
    sevenths: true,
    bass: "slap",
    keys: "comp",
    lead: "melody",
    timbre: {
      pad: { type: "triangle", gain: 0.04, attack: 0.25, filter: 2400 },
      bass: { type: "square", gain: 0.13, attack: 0.003, filter: 900, filterTo: 260, q: 3 },
      keys: { type: "triangle", gain: 0.07, attack: 0.003, filter: 4200, filterTo: 1600 },
      lead: { type: "sine", gain: 0.08, attack: 0.02, filter: 5000 },
    },
    drums: { kick: "x.....x...x.....", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.", swing: 0.22, snareTail: 0.15 },
    voice: false,
  },
  // Tessen News: a calm C major bed, a bell on the chords, a ticking pulse and the reader.
  tessen: {
    id: "tessen",
    name: "Tessen Info 24",
    frequency: "102.4",
    bpm: 84,
    root: 36,
    scale: [0, 2, 4, 5, 7, 9, 11],
    progression: [0, 4, 5, 3],
    sevenths: false,
    bass: "drone",
    keys: "bell",
    lead: null,
    timbre: {
      pad: { type: "sine", gain: 0.045, attack: 1.2, filter: 900 },
      bass: { type: "sine", gain: 0.1, attack: 0.4, filter: 300 },
      keys: { type: "sine", gain: 0.05, attack: 0.002, filter: 6000 },
      lead: { type: "sine", gain: 0, attack: 0.01, filter: 1000 },
    },
    drums: { kick: "................", snare: "................", hat: "x...x...x...x...", swing: 0, snareTail: 0 },
    voice: true,
  },
};

export const STEPS_PER_BAR = 16;

export const stepSeconds = (p: StationParams): number => 60 / p.bpm / 4;

export interface RadioNote {
  readonly layer: RadioLayer;
  /** MIDI note; for the voice the formant centre as a note, for drums a tuning hint. */
  readonly midi: number;
  /** Seconds. */
  readonly dur: number;
  /** 0..1. */
  readonly vel: number;
  /** Late by this many seconds (swing). */
  readonly delay: number;
  readonly drum?: RadioDrum;
}

/** MIDI note of scale degree `d` (may run past the octave) above the station's root. */
export const degreeToMidi = (p: StationParams, d: number): number => {
  const n = p.scale.length;
  const oct = Math.floor(d / n);
  return p.root + 12 * oct + p.scale[((d % n) + n) % n]!;
};

/** The chord on degree `d`: stacked thirds within the scale. */
export const chordOn = (p: StationParams, d: number): number[] => (p.sevenths ? [0, 2, 4, 6] : [0, 2, 4]).map((k) => degreeToMidi(p, d + k));

type Push = (step: number, e: Omit<RadioNote, "delay">) => void;

const bassLine = (p: StationParams, chord: readonly number[], push: Push, rnd: () => number, sec: number): void => {
  const root = chord[0]!;
  if (p.bass === "drone") return push(0, { layer: "bass", midi: root, dur: sec * STEPS_PER_BAR, vel: 0.7 });
  if (p.bass === "pulse") {
    for (let s = 0; s < STEPS_PER_BAR; s += 2) push(s, { layer: "bass", midi: s % 8 === 6 && rnd() < 0.5 ? root + 12 : root, dur: sec * 1.6, vel: s % 4 === 0 ? 0.95 : 0.7 });
    return;
  }
  // Slap: root, octave pops and a fifth on the syncopations.
  const fifth = chord[2]!;
  for (const [s, midi, vel] of [[0, root, 1], [3, root + 12, 0.8], [6, root, 0.85], [8, fifth, 0.75], [10, root + 12, 0.8], [11, root, 0.6], [14, fifth + 12, 0.7]] as const) {
    if (s === 11 && rnd() < 0.4) continue;
    push(s, { layer: "bass", midi, dur: sec * (midi > root + 6 ? 0.7 : 1.5), vel });
  }
};

const keysPart = (p: StationParams, chord: readonly number[], push: Push, rnd: () => number, sec: number): void => {
  if (p.keys === "arp") {
    const shape = rnd() < 0.5 ? [0, 1, 2, 1] : [0, 2, 1, 2];
    for (let s = 0; s < STEPS_PER_BAR; s++) push(s, { layer: "keys", midi: chord[shape[s % 4]!]! + 24, dur: sec * 0.9, vel: s % 4 === 0 ? 0.8 : 0.5 });
    return;
  }
  if (p.keys === "comp") {
    // Electric piano stabs on the off-beats, the whole chord voiced an octave up.
    for (const s of [2, 6, 7, 11, 14]) for (const n of chord) push(s, { layer: "keys", midi: n + 12, dur: sec * (s === 6 ? 0.6 : 1.4), vel: 0.6 });
    return;
  }
  // Bell: the chord broken upwards twice a bar, high and soft.
  for (const [i, n] of chord.entries()) {
    push(i, { layer: "keys", midi: n + 36, dur: sec * 6, vel: 0.5 - i * 0.08 });
    push(8 + i, { layer: "keys", midi: n + 36, dur: sec * 6, vel: 0.35 - i * 0.06 });
  }
};

const leadPart = (p: StationParams, chord: readonly number[], push: Push, rnd: () => number, sec: number): void => {
  if (!p.lead) return;
  push(0, { layer: "lead", midi: chord[0]! + 24, dur: sec * 3, vel: 0.7 });
  const stride = p.lead === "melody" ? 2 : 1;
  for (let s = 3; s < STEPS_PER_BAR; s += stride + Math.floor(rnd() * 2)) {
    if (rnd() < (p.lead === "melody" ? 0.35 : 0.5)) continue;
    // Melody walks the scale two octaves up; the synthwave phrase sticks to its chord's tones.
    const midi = p.lead === "melody" ? degreeToMidi(p, 14 + Math.floor(rnd() * 8)) : chord[Math.floor(rnd() * chord.length)]! + 24;
    push(s, { layer: "lead", midi, dur: sec * (1 + Math.floor(rnd() * 2)), vel: 0.55 });
  }
};

const drumPart = (d: DrumPattern, push: Push): void => {
  for (let s = 0; s < STEPS_PER_BAR; s++) {
    if (d.kick[s] === "x") push(s, { layer: "drums", midi: 36, dur: 0.32, vel: 1, drum: "kick" });
    if (d.snare[s] === "x") push(s, { layer: "drums", midi: 38, dur: 0.18 + d.snareTail * 0.3, vel: 0.85, drum: d.snareTail > 0.4 ? "snare" : "clap" });
    if (d.hat[s] === "x") push(s, { layer: "drums", midi: 42, dur: 0.05, vel: s % 4 === 0 ? 0.55 : 0.4, drum: "hat" });
  }
};

/**
 * The reader: syllables on the sixteenths in phrases of a bar, a breath of a few steps between
 * them, every fourth bar a pause. The formant centre wanders like a speaking voice.
 */
const voicePart = (bar: number, push: Push, rnd: () => number, sec: number): void => {
  if (bar % 4 === 3) return;
  let pitch = 62 + Math.floor(rnd() * 4);
  for (let s = 0; s < STEPS_PER_BAR - 2; s++) {
    if (rnd() < 0.18) {
      s += 1;
      continue;
    }
    pitch = Math.max(56, Math.min(70, pitch + Math.floor(rnd() * 5) - 2));
    push(s, { layer: "voice", midi: pitch, dur: sec * (0.6 + rnd() * 0.5), vel: 0.5 + rnd() * 0.4 });
  }
};

/** A station's loop: one list of notes per sixteenth over all bars of its progression. */
export interface StationLoop {
  readonly params: StationParams;
  readonly stepSeconds: number;
  readonly length: number;
  at(step: number): readonly RadioNote[];
}

/** Generates a station's loop once from a seed; `at(step)` is a lookup with no allocation. */
export const buildStationLoop = (params: StationParams, seed = 0x7ad10): StationLoop => {
  const rnd = mulberry32(seed + params.bpm);
  const sec = stepSeconds(params);
  const length = params.progression.length * STEPS_PER_BAR;
  const steps: RadioNote[][] = Array.from({ length }, () => []);
  params.progression.forEach((degree, bar) => {
    const chord = chordOn(params, degree);
    const push: Push = (step, e) => {
      const delay = step % 2 === 1 ? (params.drums?.swing ?? 0) * sec : 0;
      steps[bar * STEPS_PER_BAR + step]!.push({ ...e, delay });
    };
    // Pad: the chord an octave up, held for the bar.
    for (const n of chord) push(0, { layer: "pad", midi: n + 12, dur: sec * STEPS_PER_BAR, vel: 0.5 });
    bassLine(params, chord, push, rnd, sec);
    keysPart(params, chord, push, rnd, sec);
    leadPart(params, chord, push, rnd, sec);
    if (params.drums) drumPart(params.drums, push);
    if (params.voice) voicePart(bar, push, rnd, sec);
  });
  return {
    params,
    stepSeconds: sec,
    length,
    at: (step) => steps[((step % length) + length) % length]!,
  };
};
