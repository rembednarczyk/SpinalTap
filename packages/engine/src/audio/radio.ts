import type { AudioListenerPose, MusicMood } from "@seki/core";
import type { Graph } from "./audio-graph";
import { midiToHz } from "./music";
import { type RadioSpeaker, type SpeakerMix, radioMix, radioSpeakers, speakerMix } from "./radio-speakers";
import { RADIO_STATIONS, type RadioNote, type RadioStationId, type StationLoop, buildStationLoop } from "./radio-stations";
import type { SynthVoices } from "./synth-voices";
import { PRIORITY } from "./voice-pool";

const LOOKAHEAD = 0.25;
const LEVEL_TC = 0.25;
/** Overall trim of the radio against the score. */
const RADIO_LEVEL = 0.85;

/** Nodes of the radio: its input, the speaker tone (band-limited) or the full range, and the pan. */
interface RadioNodes {
  readonly input: GainNode;
  readonly level: GainNode;
  readonly pan: StereoPannerNode | null;
  readonly lowCut: BiquadFilterNode;
  readonly highCut: BiquadFilterNode;
}

/**
 * The radio (ADR-0036): the player's own station, or the station of the loudest speaker nearby.
 * One station plays at a time and only while audible, so a silent radio schedules nothing. It
 * runs on the music bus, so dialogue ducks it like the score.
 */
export class RadioPlayer {
  private own: RadioStationId | null = null;
  private readonly loops = new Map<RadioStationId, StationLoop>();
  private readonly speakers: readonly RadioSpeaker[];
  private heard: SpeakerMix | null = null;
  private playing: RadioStationId | null = null;
  private step = 0;
  private nextStep = 0;
  private nodes: RadioNodes | null = null;
  private applied = { radio: -1, pan: 2, speaker: false };
  private tuneAt = -Infinity;

  constructor(
    private readonly voices: SynthVoices,
    speakers?: readonly RadioSpeaker[],
  ) {
    this.speakers = speakers ?? radioSpeakers();
  }

  /** The player's own station (null: off). */
  get station(): RadioStationId | null {
    return this.own;
  }

  /** The station being scheduled right now: the own one, a speaker's, or none. */
  get audible(): RadioStationId | null {
    return this.playing;
  }

  setStation(id: RadioStationId | null): void {
    if (id === this.own) return;
    this.own = id;
    this.tuneAt = Infinity;
  }

  /** Listener moved: which speaker station is heard, and how loud. */
  updateListener(pose: AudioListenerPose): void {
    this.heard = speakerMix(pose, this.speakers);
  }

  /** Score level for the music layers at `mood`. */
  scoreLevel(mood: MusicMood): number {
    return radioMix(mood, this.own, this.heard?.gain ?? 0).score;
  }

  /** Levels, the speaker tone and the notes of the next LOOKAHEAD seconds. */
  schedule(g: Graph, now: number, mood: MusicMood): void {
    const mix = radioMix(mood, this.own, this.heard?.gain ?? 0);
    const station = this.own ?? (mix.radio > 0.01 ? (this.heard?.station ?? null) : null);
    if (station !== this.playing) this.switchTo(g, station, now);
    if (!station) {
      if (this.nodes && this.applied.radio !== 0) this.applyLevel(this.nodes, 0, 0, this.applied.speaker, now);
      return;
    }
    const nodes = this.nodes ?? (this.nodes = this.build(g));
    this.applyLevel(nodes, mix.radio * RADIO_LEVEL, this.own ? 0 : (this.heard?.pan ?? 0), this.own === null, now);
    const loop = this.loopOf(station);
    if (this.nextStep < now - 0.1) this.nextStep = now + 0.05;
    while (this.nextStep < now + LOOKAHEAD) {
      for (const e of loop.at(this.step)) this.note(g, nodes, e, this.nextStep + e.delay, loop.params.timbre);
      this.step = (this.step + 1) % loop.length;
      this.nextStep += loop.stepSeconds;
    }
  }

  stop(now: number): void {
    if (this.nodes) this.applyLevel(this.nodes, 0, 0, this.applied.speaker, now);
    this.playing = null;
  }

  private loopOf(id: RadioStationId): StationLoop {
    let loop = this.loops.get(id);
    if (!loop) {
      loop = buildStationLoop(RADIO_STATIONS[id]);
      this.loops.set(id, loop);
    }
    return loop;
  }

  /** A new station starts on its first bar; turning the dial plays a burst of static. */
  private switchTo(g: Graph, station: RadioStationId | null, now: number): void {
    this.playing = station;
    this.step = 0;
    this.nextStep = now + 0.08;
    if (station && this.tuneAt === Infinity) {
      this.tuneAt = now;
      const nodes = this.nodes ?? (this.nodes = this.build(g));
      this.voices.voice(g, { type: "noise", freq: 0, dur: 0.22, gain: 0.05, attack: 0.01, filter: 900, filterTo: 3800, filterType: "bandpass", q: 1.5 }, now, nodes.input, PRIORITY.music);
    }
  }

  private build(g: Graph): RadioNodes {
    const { ctx } = g;
    const input = ctx.createGain();
    const lowCut = ctx.createBiquadFilter();
    lowCut.type = "highpass";
    lowCut.frequency.value = 20;
    const highCut = ctx.createBiquadFilter();
    highCut.type = "lowpass";
    highCut.frequency.value = 16000;
    const level = ctx.createGain();
    level.gain.value = 0;
    const pan = typeof ctx.createStereoPanner === "function" ? ctx.createStereoPanner() : null;
    let node: AudioNode = input.connect(level).connect(lowCut);
    if (pan) node = node.connect(pan);
    node.connect(highCut).connect(g.buses.music);
    return { input, level, pan, lowCut, highCut };
  }

  /** Eases the level and pan; a speaker sounds small (no lows, no highs), the own radio full. */
  private applyLevel(n: RadioNodes, radio: number, pan: number, speaker: boolean, now: number): void {
    const a = this.applied;
    if (Math.abs(a.radio - radio) > 0.005) n.level.gain.setTargetAtTime(radio, now, LEVEL_TC);
    if (Math.abs(a.pan - pan) > 0.02) n.pan?.pan.setTargetAtTime(pan * 0.8, now, LEVEL_TC);
    if (a.speaker !== speaker || a.radio < 0) {
      n.lowCut.frequency.setTargetAtTime(speaker ? 320 : 20, now, 0.05);
      n.highCut.frequency.setTargetAtTime(speaker ? 3800 : 16000, now, 0.05);
    }
    this.applied = { radio, pan, speaker };
  }

  private note(g: Graph, n: RadioNodes, e: RadioNote, at: number, timbre: (typeof RADIO_STATIONS)[RadioStationId]["timbre"]): void {
    const p = PRIORITY.music;
    const v = this.voices;
    const hz = midiToHz(e.midi);
    switch (e.layer) {
      case "drums":
        return this.drum(g, n, e, at);
      case "voice":
        // A syllable: a buzzy glottal tone through a moving formant, with a breathy edge.
        v.voice(g, { type: "sawtooth", freq: 110 + (e.midi - 60) * 4, to: 100 + (e.midi - 60) * 3, dur: e.dur, gain: 0.05 * e.vel, attack: 0.015, filter: hz * 1.9, filterTo: hz * 1.2, filterType: "bandpass", q: 6 }, at, n.input, p);
        v.voice(g, { type: "noise", freq: 0, dur: e.dur * 0.5, gain: 0.012 * e.vel, filter: 3200, filterType: "bandpass", q: 2, attack: 0.005 }, at, n.input, p);
        return;
      default: {
        const t = timbre[e.layer];
        if (t.gain <= 0) return;
        // No echo or reverb sends: they return past the radio's level and would ignore the distance.
        v.voice(g, { type: t.type, freq: hz, dur: e.dur, gain: t.gain * e.vel, attack: t.attack, filter: t.filter, ...(t.filterTo ? { filterTo: t.filterTo } : {}), ...(t.q ? { q: t.q } : {}) }, at, n.input, p);
      }
    }
  }

  private drum(g: Graph, n: RadioNodes, e: RadioNote, at: number): void {
    const p = PRIORITY.music;
    const v = this.voices;
    const dest = n.input;
    if (e.drum === "kick") v.voice(g, { type: "sine", freq: 120, to: 45, dur: e.dur, gain: 0.45 * e.vel, attack: 0.002 }, at, dest, p);
    else if (e.drum === "hat") v.voice(g, { type: "noise", freq: 0, dur: e.dur, gain: 0.06 * e.vel, filter: 8500, filterType: "highpass", attack: 0.001 }, at, dest, p);
    else {
      // Snare with a gated tail (synthwave) or a dry clap (city pop).
      const gated = e.drum === "snare";
      v.voice(g, { type: "noise", freq: 0, dur: e.dur, gain: (gated ? 0.2 : 0.16) * e.vel, filter: gated ? 1700 : 1300, filterType: "bandpass", q: gated ? 0.7 : 1.4, attack: 0.001 }, at, dest, p);
    }
  }
}
