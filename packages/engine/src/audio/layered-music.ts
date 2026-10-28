import type { AudioCue, MusicMood } from "@seki/core";
import { type Graph, applyBus } from "./audio-graph";
import type { MixState } from "./mixer";
import { LAYER_MIX, LAYERS, type Layer, LOOP_STEPS, MOOD_CUTOFF, MusicDirector, MusicSequencer, type NoteEvent, STEP_SECONDS, midiToHz } from "./music";
import type { SynthVoices } from "./synth-voices";
import { PRIORITY } from "./voice-pool";

const LOOKAHEAD = 0.25;
/** Time constant of layer crossfades: ~2 s to settle, never a step. */
const LAYER_TC = 0.6;

/** Per-layer trim so the mix tables can stay in 0..1. */
const LAYER_LEVEL: Readonly<Record<Layer, number>> = { pad: 0.9, bass: 0.8, arp: 0.7, drums: 0.8, lead: 0.6 };

/**
 * The procedural synthwave loop in mood layers (ADR-0013): the director picks the mood from the
 * base mood and recent cues, the layers crossfade to it, and the notes are scheduled ahead.
 */
export class LayeredMusic {
  private readonly director = new MusicDirector();
  private readonly sequencer = new MusicSequencer();
  private on = false;
  private step = 0;
  private nextStep = 0;
  private mood: MusicMood | null = null;
  private fadeFrom: MusicMood | null = null;
  private moodChangedAt = -Infinity;

  constructor(
    private readonly voices: SynthVoices,
    private readonly mix: MixState,
  ) {}

  /** The mood the director picks at `now`. */
  moodAt(now: number): MusicMood {
    return this.director.mood(now);
  }

  setBase(mood: MusicMood): void {
    this.director.setBase(mood);
  }

  notify(cue: AudioCue, now: number): void {
    this.director.notify(cue, now);
  }

  /** Starts the loop from its first step; false when it was already playing. */
  start(now: number): boolean {
    if (this.on) return false;
    this.on = true;
    this.step = 0;
    this.nextStep = now + 0.1;
    return true;
  }

  /** Silences every layer. */
  stop(g: Graph | null, now: number): void {
    this.on = false;
    this.mood = null;
    this.fadeFrom = null;
    if (g) for (const l of LAYERS) g.layers[l].gain.setTargetAtTime(0, now, 0.05);
  }

  /** Ducks the music bus under dialogue and crossfades the layers to the director's mood. */
  refresh(g: Graph, now: number): void {
    const mood = this.director.mood(now);
    const ducked = this.director.baseMood === "dialog";
    if (ducked !== this.mix.isDucked) {
      this.mix.setDucked(ducked);
      applyBus(g, this.mix, "music", now);
    }
    if (mood === this.mood || !this.on) return;
    this.fadeFrom = this.mood;
    this.mood = mood;
    this.moodChangedAt = now;
    for (const l of LAYERS) g.layers[l].gain.setTargetAtTime(LAYER_MIX[mood][l] * LAYER_LEVEL[l], now, LAYER_TC);
    g.musicFilter.frequency.setTargetAtTime(MOOD_CUTOFF[mood], now, LAYER_TC);
  }

  /** Schedules the notes of the next LOOKAHEAD seconds. */
  schedule(g: Graph, now: number): void {
    if (!this.on) return;
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
    const voices = this.voices;
    switch (e.layer) {
      case "pad":
        voices.voice(g, { type: "sawtooth", freq: hz, dur: e.dur, gain: 0.06 * e.vel, attack: 0.9, filter: 1100 }, at, dest, p);
        break;
      case "bass":
        voices.voice(g, { type: "sawtooth", freq: hz, dur: e.dur, gain: 0.22 * e.vel, attack: 0.008, filter: 420, filterTo: 160, q: 4 }, at, dest, p);
        break;
      case "arp":
        voices.voice(g, { type: "square", freq: hz, dur: e.dur, gain: 0.05 * e.vel, attack: 0.004, filter: 2600, filterTo: 900 }, at, dest, p, 1, 0, 0.5);
        break;
      case "lead":
        voices.voice(g, { type: "sawtooth", freq: hz, dur: e.dur, gain: 0.07 * e.vel, attack: 0.03, filter: 3200, q: 2 }, at, dest, p, 1, 0, 0.6);
        break;
      case "drums":
        if (e.drum === "kick") voices.voice(g, { type: "sine", freq: 130, to: 42, dur: e.dur, gain: 0.5 * e.vel, attack: 0.002 }, at, dest, p);
        else if (e.drum === "snare") {
          voices.voice(g, { type: "noise", freq: 0, dur: e.dur, gain: 0.22 * e.vel, filter: 1900, filterType: "bandpass", q: 0.8, attack: 0.001 }, at, dest, p);
          voices.voice(g, { type: "triangle", freq: 190, to: 140, dur: 0.08, gain: 0.12 * e.vel, attack: 0.001 }, at, dest, p);
        } else voices.voice(g, { type: "noise", freq: 0, dur: e.dur, gain: 0.07 * e.vel, filter: 8000, filterType: "highpass", attack: 0.001 }, at, dest, p);
        break;
    }
  }
}
