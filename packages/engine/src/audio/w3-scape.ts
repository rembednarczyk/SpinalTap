import type { AudioListenerPose, Vec3 } from "@seki/core";
import type { Graph } from "./audio-graph";
import { type Group, type Kit, type Strip, kit } from "./loop-kit";
import { DEFAULT_POSE } from "./spatial";
import type { SynthVoices } from "./synth-voices";
import { PRIORITY } from "./voice-pool";
import { W3_ARMS, W3_SOUND_FAR, W3_STEAM_INSIDE, W3_STEAM_OUTSIDE, type W3Layer, type W3Mix, type W3Place, w3Mix, w3PointMix, w3SoundDistance } from "./w3-sound-map";

const LOOKAHEAD = 0.25;
const LISTENER_TC = 0.15;
/** The walls' low-pass and the groups' levels move slower than a layer's: a door, not a jump cut. */
const WALL_TC = 0.25;

/** Each layer's loudness at full mix, on the ambience bus (the street's rain is about 0.26). */
export const W3_LAYER_LEVEL: Readonly<Record<W3Layer, number>> = { line: 0.34, hum: 0.12, tubes: 0.035, river: 0.3, plant: 0.24, sign: 0.13 };

/** The sector's running loops, built near it and torn down past `W3_SOUND_FAR`. */
interface Nodes {
  readonly sources: AudioScheduledSourceNode[];
  readonly out: GainNode;
  readonly hall: Group;
  readonly yard: Group;
  readonly layers: Readonly<Record<W3Layer, Strip>>;
}

/** The assembly line: the belts' low rumble and their rollers clattering in a steady beat. */
const buildLine = (k: Kit, s: Strip): void => {
  const src = k.noise(0.7);
  src.connect(k.filter("bandpass", 200, 0.7)).connect(k.gain(0.55)).connect(s.gain);
  const clatter = k.gain(0.22);
  src.connect(k.filter("bandpass", 1700, 2.5)).connect(clatter).connect(s.gain);
  k.lfo(2.6, 0.2, clatter.gain);
};

/** The transformers: 50 Hz mains, its octave and a little buzz, steadier and deeper than a neon. */
const buildHum = (k: Kit, s: Strip): void => {
  const tone = k.filter("lowpass", 400);
  for (const [type, freq, level] of [["sine", 50, 0.5], ["sine", 100, 0.45], ["sawtooth", 150, 0.06]] as const) k.osc(type, freq).connect(k.gain(level)).connect(tone);
  tone.connect(s.gain);
};

/** The strip lights under the ceiling: a thin 100 Hz buzz that flickers. */
const buildTubes = (k: Kit, s: Strip): void => {
  const flicker = k.gain(0.8);
  k.osc("sawtooth", 100).connect(k.filter("bandpass", 2200, 3)).connect(flicker).connect(s.gain);
  k.lfo(9.1, 0.15, flicker.gain);
};

/** The river: a wash of water along the quay and a slow gurgle round the pier's posts. */
const buildRiver = (k: Kit, s: Strip): void => {
  const src = k.noise(0.5);
  src.connect(k.filter("lowpass", 700)).connect(k.gain(0.6)).connect(s.gain);
  const gurgle = k.filter("bandpass", 380, 1.5);
  src.connect(gurgle).connect(k.gain(0.35)).connect(s.gain);
  k.lfo(0.31, 120, gurgle.frequency);
};

/** The plant's drone: a deep rumble, a 43 Hz machine tone and the cooling units' fans. */
const buildPlant = (k: Kit, s: Strip): void => {
  const src = k.noise(0.33);
  src.connect(k.filter("lowpass", 120)).connect(k.gain(0.7)).connect(s.gain);
  k.osc("sine", 43).connect(k.gain(0.18)).connect(s.gain);
  const fans = k.gain(0.12);
  src.connect(k.filter("bandpass", 650, 1.2)).connect(fans).connect(s.gain);
  k.lfo(13, 0.05, fans.gain);
};

/** The TESSEN neon: mains hum and harmonics through a sign's transformer, a nervous flicker. */
const buildSign = (k: Kit, s: Strip): void => {
  const tone = k.filter("lowpass", 900);
  const flicker = k.gain(0.85);
  for (const [type, freq, level] of [["sawtooth", 50, 0.4], ["sine", 100, 0.5], ["square", 150, 0.06]] as const) k.osc(type, freq).connect(k.gain(level)).connect(tone);
  tone.connect(flicker).connect(s.gain);
  k.lfo(6.1, 0.15, flicker.gain);
};

const BUILD: Readonly<Record<W3Layer, (k: Kit, s: Strip) => void>> = { line: buildLine, hum: buildHum, tubes: buildTubes, river: buildRiver, plant: buildPlant, sign: buildSign };

/**
 * W-3's soundscape (ADR-0082 stage 4): the hall's line, transformers and lights, the river, the
 * plant's drone and the TESSEN neon outside, as loops that follow the listener like the street's
 * neon hum and steam (`AmbientScape`); the robot arms' servos and welds and the steam valves as
 * one-shots scheduled ahead. Built only within `W3_SOUND_NEAR` of the sector and torn down past
 * `W3_SOUND_FAR`, so the rest of the city pays nothing for it.
 */
export class W3Scape {
  private nodes: Nodes | null = null;
  private pose: AudioListenerPose = DEFAULT_POSE;
  private last: W3Mix = w3Mix(DEFAULT_POSE);
  private applied: W3Mix | null = null;
  private nextArm = 0;
  private nextSteam = 0;

  constructor(
    private readonly voices: SynthVoices,
    private readonly rnd: () => number,
  ) {}

  /** True while the sector's loops exist. */
  get active(): boolean {
    return this.nodes !== null;
  }

  /** The last mix of the sector heard from the listener (debug, tests). */
  get mix(): W3Mix {
    return this.last;
  }

  get place(): W3Place {
    return this.last.place;
  }

  /** New listener pose: the mix follows, and the loops' levels with it once they are built. */
  update(pose: AudioListenerPose, now: number, force = false): void {
    this.pose = pose;
    this.last = w3Mix(pose, this.last.place);
    if (this.nodes) this.apply(this.nodes, now, force);
  }

  /** One scheduler step: build near the sector, tear down far from it, the one-shots ahead. */
  tick(g: Graph, now: number): void {
    if (!this.nodes && this.last.near) {
      this.nodes = this.build(g);
      this.applied = null;
      this.apply(this.nodes, now, true);
      this.nextArm = now + 0.3;
      this.nextSteam = now + 1.5;
    } else if (this.nodes && w3SoundDistance(this.pose.position) > W3_SOUND_FAR) {
      this.stop(now);
    }
    if (this.nodes) this.schedule(g, this.nodes, now);
  }

  stop(now: number): void {
    const n = this.nodes;
    if (!n) return;
    n.out.gain.setTargetAtTime(0, now, 0.15);
    for (const s of n.sources) s.stop(now + 0.8);
    this.nodes = null;
    this.applied = null;
  }

  private build(g: Graph): Nodes {
    const sources: AudioScheduledSourceNode[] = [];
    const k = kit(g, sources);
    const out = k.gain(0);
    out.gain.setTargetAtTime(1, g.ctx.currentTime, 0.8);
    out.connect(g.buses.ambience);
    const hall = k.group(out);
    const yard = k.group(out);
    const strips = {
      line: k.strip(hall.gain),
      hum: k.strip(hall.gain),
      tubes: k.strip(hall.gain, false),
      river: k.strip(yard.gain),
      plant: k.strip(yard.gain),
      sign: k.strip(yard.gain),
    };
    for (const l of Object.keys(BUILD) as W3Layer[]) BUILD[l](k, strips[l]);
    for (const s of sources) s.start();
    return { sources, out, hall, yard, layers: strips };
  }

  /** Levels, pans and walls from the last mix; only what changed audibly, unless `force`. */
  private apply(n: Nodes, now: number, force: boolean): void {
    const m = this.last;
    const was = this.applied;
    for (const l of Object.keys(n.layers) as W3Layer[]) {
      const mix = m.layers[l];
      if (!force && was && Math.abs(was.layers[l].gain - mix.gain) <= 0.01 && Math.abs(was.layers[l].pan - mix.pan) <= 0.05) continue;
      n.layers[l].gain.gain.setTargetAtTime(mix.gain * W3_LAYER_LEVEL[l], now, LISTENER_TC);
      n.layers[l].pan?.pan.setTargetAtTime(mix.pan * 0.8, now, LISTENER_TC);
    }
    if (force || was?.place !== m.place) {
      for (const k of ["hall", "yard"] as const) {
        n[k].gain.gain.setTargetAtTime(m[k].gain, now, WALL_TC);
        n[k].filter.frequency.setTargetAtTime(m[k].cutoff, now, WALL_TC);
      }
    }
    this.applied = m;
  }

  private pick(points: readonly Vec3[]): Vec3 {
    return points[Math.floor(this.rnd() * points.length) % points.length] as Vec3;
  }

  /** The arms in the hall while she is in it; a puff of steam in the hall or outside, wherever she is. */
  private schedule(g: Graph, n: Nodes, now: number): void {
    const inHall = this.last.place === "hall";
    if (this.nextArm < now - 0.1) this.nextArm = now;
    while (this.nextArm < now + LOOKAHEAD) {
      if (inHall) this.arm(g, n, this.pick(W3_ARMS), this.nextArm);
      this.nextArm += 0.5 + this.rnd() * 1.4;
    }
    if (this.nextSteam < now - 0.1) this.nextSteam = now;
    while (this.nextSteam < now + LOOKAHEAD) {
      const outside = this.last.place === "outside";
      this.steam(g, outside ? n.yard.gain : n.hall.gain, this.pick(outside ? W3_STEAM_OUTSIDE : W3_STEAM_INSIDE), this.nextSteam, !outside);
      this.nextSteam += 3 + this.rnd() * 5;
    }
  }

  /** A robot arm: its servo whining up or down, the clunk of its stop, now and then a weld's crackle. */
  private arm(g: Graph, n: Nodes, at: Vec3, t: number): void {
    const mix = w3PointMix(this.pose, at, 2.5, 30);
    if (mix.gain < 0.02) return;
    const dest = n.hall.gain;
    const pan = mix.pan * 0.8;
    const p = PRIORITY.ambience;
    const from = 170 + this.rnd() * 90;
    const up = this.rnd() < 0.5;
    const dur = 0.45 + this.rnd() * 0.5;
    this.voices.voice(g, { type: "sawtooth", freq: up ? from : from * 2.2, to: up ? from * 2.2 : from, dur, gain: 0.05, attack: 0.06, filter: 1100, filterType: "bandpass", q: 2.5, pan }, t, dest, p, mix.gain, 0.3);
    this.voices.voice(g, { type: "noise", freq: 0, dur: 0.07, gain: 0.12, attack: 0.002, filter: 500, pan }, t + dur, dest, p, mix.gain, 0.3);
    if (this.rnd() >= 0.35) return;
    const weld = t + dur + 0.1;
    this.voices.voice(g, { type: "noise", freq: 0, dur: 0.3 + this.rnd() * 0.5, gain: 0.04, attack: 0.01, filter: 5200, filterType: "bandpass", q: 1.5, pan }, weld, dest, p, mix.gain, 0.2);
    for (let i = 0; i < 3; i++) {
      const f = 3000 + this.rnd() * 3000;
      this.voices.voice(g, { type: "triangle", freq: f, to: f * 0.7, dur: 0.015, gain: 0.03, attack: 0.001, pan }, weld + 0.04 + i * 0.07 * this.rnd(), dest, p, mix.gain);
    }
  }

  /** Steam hissing out of a valve, louder the closer she is. */
  private steam(g: Graph, dest: AudioNode, at: Vec3, t: number, inside: boolean): void {
    const mix = w3PointMix(this.pose, at, 2, 25);
    if (mix.gain < 0.02) return;
    const dur = 0.9 + this.rnd() * 1.2;
    this.voices.voice(g, { type: "noise", freq: 0, dur, gain: 0.14, attack: 0.12, filter: 2600, filterTo: 1800, filterType: "bandpass", q: 0.8, pan: mix.pan * 0.8 }, t, dest, PRIORITY.ambience, mix.gain, inside ? 0.25 : 0);
  }
}
