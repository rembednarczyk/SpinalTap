import { ABILITY_CATALOG, type AudioCue, type MusicMood } from "@seki/core";

export type Layer = "pad" | "bass" | "arp" | "drums" | "lead";
export const LAYERS: readonly Layer[] = ["pad", "bass", "arp", "drums", "lead"];

/** Target gain of every layer per mood. Moods differ by which layers play, not by tempo. */
export const LAYER_MIX: Readonly<Record<MusicMood, Readonly<Record<Layer, number>>>> = {
  explore: { pad: 1, bass: 0.55, arp: 0.45, drums: 0, lead: 0 },
  combat: { pad: 0.5, bass: 1, arp: 0.8, drums: 1, lead: 0.35 },
  overdrive: { pad: 0.35, bass: 1, arp: 1, drums: 1, lead: 1 },
  dialog: { pad: 0.8, bass: 0.25, arp: 0, drums: 0, lead: 0 },
};

/** Low-pass cutoff of the music bus per mood: overdrive opens it up, dialog darkens it. */
export const MOOD_CUTOFF: Readonly<Record<MusicMood, number>> = { explore: 2600, combat: 5200, overdrive: 12000, dialog: 1400 };

/** Seconds music stays in combat after the last shot or hit. */
export const COMBAT_HOLD = 7;
const OVERDRIVE_HOLD = ABILITY_CATALOG.reflex_overdrive.duration;
const COMBAT_CUES: ReadonlySet<AudioCue> = new Set<AudioCue>(["shot", "enemy-shot", "hit", "critical", "hurt"]);

/**
 * Decides the music mood. The app sets a base mood (dialog, explore …); combat and overdrive
 * are also inferred from cues, so they need no extra wiring and fade back by themselves.
 * Priority: dialog > overdrive > combat > explore.
 */
export class MusicDirector {
  private base: MusicMood = "explore";
  private combatUntil = -Infinity;
  private overdriveUntil = -Infinity;

  setBase(mood: MusicMood): void {
    this.base = mood;
  }

  get baseMood(): MusicMood {
    return this.base;
  }

  notify(cue: AudioCue, now: number): void {
    if (COMBAT_CUES.has(cue)) this.combatUntil = Math.max(this.combatUntil, now + COMBAT_HOLD);
    else if (cue === "overdrive") {
      this.overdriveUntil = now + OVERDRIVE_HOLD;
      this.combatUntil = Math.max(this.combatUntil, now + OVERDRIVE_HOLD + COMBAT_HOLD);
    } else if (cue === "kill") this.combatUntil = Math.min(this.combatUntil, now + COMBAT_HOLD / 2);
  }

  mood(now: number): MusicMood {
    if (this.base === "dialog") return "dialog";
    if (this.base === "overdrive" || now < this.overdriveUntil) return "overdrive";
    if (this.base === "combat" || now < this.combatUntil) return "combat";
    return "explore";
  }
}

// ---------------------------------------------------------------------------------------------
// Procedural loop: A minor, i–VI–III–VII (Am F C G), one chord per bar, 16th-note grid.

export const BPM = 92;
export const STEPS_PER_BAR = 16;
export const BARS = 4;
export const LOOP_STEPS = STEPS_PER_BAR * BARS;
export const STEP_SECONDS = 60 / BPM / 4;

/** Chord tones as MIDI notes in the bass octave. */
export const PROGRESSION: readonly (readonly [number, number, number])[] = [
  [45, 48, 52], // Am
  [41, 45, 48], // F
  [48, 52, 55], // C
  [43, 47, 50], // G
];
/** A natural minor, the only pitch classes the loop may use. */
export const A_MINOR_PCS: ReadonlySet<number> = new Set([9, 11, 0, 2, 4, 5, 7]);
const PENTATONIC = [57, 60, 62, 64, 67, 69, 72, 74, 76];

export type Drum = "kick" | "snare" | "hat";

export interface NoteEvent {
  readonly layer: Layer;
  /** MIDI note; drums use it as a tuning hint. */
  readonly midi: number;
  /** Seconds. */
  readonly dur: number;
  /** 0..1. */
  readonly vel: number;
  readonly drum?: Drum;
}

export const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/** Small seeded PRNG (mulberry32) for presentation-only variation. */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Generates the loop once from a seed. `at(step)` is a lookup, so the scheduler allocates
 * nothing while playing.
 */
export class MusicSequencer {
  private readonly steps: NoteEvent[][];

  constructor(seed = 0x5e4153) {
    const rnd = mulberry32(seed);
    this.steps = Array.from({ length: LOOP_STEPS }, () => []);
    const arpShape = rnd() < 0.5 ? [0, 1, 2, 1] : [0, 2, 1, 2];
    for (let bar = 0; bar < BARS; bar++) {
      const chord = PROGRESSION[bar]!;
      const base = bar * STEPS_PER_BAR;
      const push = (step: number, e: NoteEvent) => this.steps[base + step]!.push(e);
      // Pad: the whole chord, two octaves up, held for the bar.
      for (const n of chord) push(0, { layer: "pad", midi: n + 12, dur: STEP_SECONDS * STEPS_PER_BAR, vel: 0.5 });
      // Bass: root on the beats, octave or fifth pushes in between.
      for (let s = 0; s < STEPS_PER_BAR; s += 2) {
        const onBeat = s % 4 === 0;
        if (!onBeat && rnd() < 0.45) continue;
        const midi = onBeat ? chord[0] - 12 : rnd() < 0.5 ? chord[0] : chord[2] - 12;
        push(s, { layer: "bass", midi, dur: STEP_SECONDS * (onBeat ? 1.8 : 1), vel: onBeat ? 0.9 : 0.6 });
      }
      // Arp: chord tones three octaves up on every 16th.
      for (let s = 0; s < STEPS_PER_BAR; s++) {
        const tone = chord[arpShape[s % arpShape.length]!]!;
        push(s, { layer: "arp", midi: tone + 24 + (s >= 8 && rnd() < 0.25 ? 12 : 0), dur: STEP_SECONDS * 0.9, vel: s % 4 === 0 ? 0.8 : 0.5 });
      }
      // Drums: four-on-the-floor-ish kick, backbeat snare, offbeat hats.
      push(0, { layer: "drums", midi: 36, dur: 0.35, vel: 1, drum: "kick" });
      push(8, { layer: "drums", midi: 36, dur: 0.35, vel: 0.9, drum: "kick" });
      if (rnd() < 0.6) push(rnd() < 0.5 ? 10 : 14, { layer: "drums", midi: 36, dur: 0.3, vel: 0.6, drum: "kick" });
      push(4, { layer: "drums", midi: 38, dur: 0.22, vel: 0.8, drum: "snare" });
      push(12, { layer: "drums", midi: 38, dur: 0.22, vel: 0.85, drum: "snare" });
      for (let s = 2; s < STEPS_PER_BAR; s += 4) push(s, { layer: "drums", midi: 42, dur: 0.06, vel: 0.5, drum: "hat" });
      // Lead: a sparse pentatonic phrase, landing on a chord tone at the bar start.
      push(0, { layer: "lead", midi: chord[0] + 24, dur: STEP_SECONDS * 3, vel: 0.7 });
      for (let s = 3; s < STEPS_PER_BAR; s += 1 + Math.floor(rnd() * 3)) {
        if (rnd() < 0.5) continue;
        const midi = PENTATONIC[Math.floor(rnd() * PENTATONIC.length)]!;
        push(s, { layer: "lead", midi, dur: STEP_SECONDS * (1 + Math.floor(rnd() * 2)), vel: 0.55 });
      }
    }
  }

  at(step: number): readonly NoteEvent[] {
    return this.steps[((step % LOOP_STEPS) + LOOP_STEPS) % LOOP_STEPS]!;
  }
}
