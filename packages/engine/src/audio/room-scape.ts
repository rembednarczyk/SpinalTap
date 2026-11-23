import type { AudioListenerPose, RoomSound } from "@seki/core";
import type { Graph } from "./audio-graph";
import { type Kit, type Strip, kit } from "./loop-kit";
import { ROOM_SOUNDS, ROOM_SOUND_FAR, ROOM_SOUND_NEAR, type RoomEmitter, type RoomMix, roomEmitters, roomMix } from "./room-sound-map";
import { DEFAULT_POSE } from "./spatial";
import type { SynthVoices } from "./synth-voices";
import { PRIORITY } from "./voice-pool";

const LOOKAHEAD = 0.25;
const LISTENER_TC = 0.15;
/** A doorway's step changes the walls' low-pass slower than a layer's level: a door, not a jump cut. */
const WALL_TC = 0.25;

/** Each sound's loudness at full mix on the ambience bus (the street's rain is about 0.26, W-3's transformers 0.12). */
export const ROOM_SOUND_LEVEL: Readonly<Record<RoomSound, number>> = { vent: 0.12, hum: 0.07, pump: 0.1, drip: 0.14, simmer: 0.1, tubes: 0.03, fountain: 0.1 };

interface Layer {
  readonly strip: Strip;
  readonly filter: BiquadFilterNode;
}

interface Nodes {
  readonly sources: AudioScheduledSourceNode[];
  readonly out: GainNode;
  /** Only the sounds with an emitter within reach when built: a room's few, not all of them. */
  readonly layers: Readonly<Partial<Record<RoomSound, Layer>>>;
}

/** A metro vent: a fan's hiss and the whistle of its grille, a slow beat of the blades. */
const buildVent = (k: Kit, s: Strip): void => {
  const src = k.noise(0.6);
  src.connect(k.filter("lowpass", 900)).connect(k.gain(0.6)).connect(s.gain);
  const whistle = k.gain(0.12);
  src.connect(k.filter("bandpass", 2400, 1.2)).connect(whistle).connect(s.gain);
  k.lfo(7, 0.05, whistle.gain);
};

/** A fuse box, a control cabinet, a charger: mains at 50 Hz and its octave, a little buzz. */
const buildHum = (k: Kit, s: Strip): void => {
  const tone = k.filter("lowpass", 500);
  for (const [type, freq, level] of [["sine", 50, 0.45], ["sine", 100, 0.5], ["sawtooth", 150, 0.05]] as const) k.osc(type, freq).connect(k.gain(level)).connect(tone);
  tone.connect(s.gain);
};

/** A pump: its motor's low tone and the water it moves, bubbling (an aquarium's air pump, the basement's sump pump). */
const buildPump = (k: Kit, s: Strip): void => {
  k.osc("sine", 29).connect(k.gain(0.35)).connect(s.gain);
  const water = k.gain(0.4);
  k.noise(0.5).connect(k.filter("bandpass", 450, 1.5)).connect(water).connect(s.gain);
  k.lfo(1.3, 0.2, water.gain);
};

/** A pot on the hob: the broth's simmer, its bubbles in a quick uneven beat, the gas under it. */
const buildSimmer = (k: Kit, s: Strip): void => {
  const src = k.noise(0.8);
  const bubbles = k.gain(0.45);
  src.connect(k.filter("bandpass", 1800, 0.8)).connect(bubbles).connect(s.gain);
  k.lfo(3.1, 0.3, bubbles.gain);
  src.connect(k.filter("lowpass", 300)).connect(k.gain(0.3)).connect(s.gain);
};

/** Strip lights: a thin 100 Hz buzz that flickers (as W-3's hall). */
const buildTubes = (k: Kit, s: Strip): void => {
  const flicker = k.gain(0.8);
  k.osc("sawtooth", 100).connect(k.filter("bandpass", 2200, 3)).connect(flicker).connect(s.gain);
  k.lfo(9.1, 0.15, flicker.gain);
};

/** A dry fountain's jets: the hiss of the mist off them and the patter of the water falling back onto the grates. */
const buildFountain = (k: Kit, s: Strip): void => {
  const src = k.noise(1.1);
  src.connect(k.filter("bandpass", 3200, 0.7)).connect(k.gain(0.35)).connect(s.gain);
  const patter = k.gain(0.5);
  src.connect(k.filter("bandpass", 700, 0.9)).connect(patter).connect(s.gain);
  k.lfo(0.4, 0.15, patter.gain);
};

/** The drip is one-shots (`RoomScape.schedule`): its strip only carries them. */
const BUILD: Readonly<Record<RoomSound, ((k: Kit, s: Strip) => void) | null>> = { vent: buildVent, hum: buildHum, pump: buildPump, drip: null, simmer: buildSimmer, tubes: buildTubes, fountain: buildFountain };

/**
 * The rooms' soundscape (`docs/zasady-lokacji.md` §17: sound from its source; ADR-0099 stage 6): the steady sounds of
 * the rooms' things as loops whose levels, pans and walls follow the listener, the drips of a leak as one-shots
 * scheduled ahead. Built only within `ROOM_SOUND_NEAR` of an emitter and torn down past `ROOM_SOUND_FAR`, so the
 * street pays nothing for it.
 */
export class RoomScape {
  private nodes: Nodes | null = null;
  private pose: AudioListenerPose = DEFAULT_POSE;
  private readonly emitters: readonly RoomEmitter[];
  private last: RoomMix;
  private nextDrip = 0;

  constructor(
    private readonly voices: SynthVoices,
    private readonly rnd: () => number,
    emitters: readonly RoomEmitter[] = roomEmitters(),
  ) {
    this.emitters = emitters;
    this.last = roomMix(DEFAULT_POSE, emitters);
  }

  /** True while the rooms' loops exist. */
  get active(): boolean {
    return this.nodes !== null;
  }

  /** The last mix (debug, tests). */
  get mix(): RoomMix {
    return this.last;
  }

  /** New listener pose: the mix follows, and the loops' levels with it once they are built. */
  update(pose: AudioListenerPose, now: number): void {
    this.pose = pose;
    this.last = roomMix(pose, this.emitters, this.last.room);
    if (this.nodes) this.apply(this.nodes, now);
  }

  /** One scheduler step: build near an emitter, tear down far from all, the drips ahead. */
  tick(g: Graph, now: number): void {
    // A sound heard that is not built (she walked on to a room of other things): built anew with it.
    if (this.nodes && ROOM_SOUNDS.some((sound) => this.last.layers[sound].gain > 0 && !this.nodes?.layers[sound])) this.stop(now);
    if (!this.nodes && this.last.nearest < ROOM_SOUND_NEAR) {
      this.nodes = this.build(g);
      this.apply(this.nodes, now);
      this.nextDrip = now + 0.4;
    } else if (this.nodes && this.last.nearest > ROOM_SOUND_FAR) {
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
  }

  private build(g: Graph): Nodes {
    const sources: AudioScheduledSourceNode[] = [];
    const k = kit(g, sources);
    const out = k.gain(0);
    out.gain.setTargetAtTime(1, g.ctx.currentTime, 0.8);
    out.connect(g.buses.ambience);
    const layers: Partial<Record<RoomSound, Layer>> = {};
    for (const sound of ROOM_SOUNDS) {
      if (this.last.layers[sound].gain <= 0) continue;
      const filter = k.filter("lowpass", 12000);
      filter.connect(out);
      const strip = k.strip(filter);
      BUILD[sound]?.(k, strip);
      layers[sound] = { strip, filter };
    }
    for (const s of sources) s.start();
    return { sources, out, layers };
  }

  private apply(n: Nodes, now: number): void {
    for (const sound of ROOM_SOUNDS) {
      const m = this.last.layers[sound];
      const l = n.layers[sound];
      if (!l) continue;
      l.strip.gain.gain.setTargetAtTime(m.gain * ROOM_SOUND_LEVEL[sound], now, LISTENER_TC);
      l.strip.pan?.pan.setTargetAtTime(m.pan * 0.8, now, LISTENER_TC);
      l.filter.frequency.setTargetAtTime(m.cutoff, now, WALL_TC);
    }
  }

  /** A leak's drops while one is heard: a short falling ping and its splash, unevenly apart. */
  private schedule(g: Graph, n: Nodes, now: number): void {
    const drip = this.last.layers.drip;
    if (this.nextDrip < now - 0.1) this.nextDrip = now;
    while (this.nextDrip < now + LOOKAHEAD) {
      const strip = n.layers.drip?.strip;
      if (strip && drip.gain > 0.02) {
        const t = this.nextDrip;
        const f = 1100 + this.rnd() * 500;
        const pan = drip.pan * 0.8;
        const dest = strip.gain;
        this.voices.voice(g, { type: "sine", freq: f, to: f * 0.55, dur: 0.06, gain: 0.5, attack: 0.002, pan }, t, dest, PRIORITY.ambience, 1);
        this.voices.voice(g, { type: "noise", freq: 0, dur: 0.05, gain: 0.15, attack: 0.002, filter: 3000, filterType: "bandpass", q: 1.2, pan }, t + 0.01, dest, PRIORITY.ambience, 1);
      }
      this.nextDrip += 0.7 + this.rnd() * 1.6;
    }
  }
}
