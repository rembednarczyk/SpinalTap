import type { AudioCue } from "@seki/core";
import type { Graph } from "./audio-graph";
import { CUES, type Voice } from "./cues";
import type { FootstepClock } from "./footsteps";
import { type AudioSampleManifest, type SampleBank, type SampleSet, VariantPicker } from "./samples";
import { PRIORITY, VoicePool } from "./voice-pool";

interface PlayingVoice {
  readonly src: AudioScheduledSourceNode;
  readonly env: GainNode;
}

const SILENT = 0.0001;

/**
 * One-shot voices and effects: cue recipes, recorded samples, footsteps, all through one voice
 * pool with priorities. Music and ambience schedule their notes and drops here too.
 */
export class SynthVoices {
  private readonly pool: VoicePool<PlayingVoice>;
  private readonly picker: VariantPicker;

  constructor(
    maxVoices: number,
    bank: SampleBank,
    private readonly samples: AudioSampleManifest,
    /** Shared with the ambience: one seeded stream, drawn in the same order as before the split. */
    private readonly rnd: () => number,
  ) {
    this.pool = new VoicePool(maxVoices);
    this.picker = new VariantPicker(bank, rnd);
  }

  /** Voices currently held in the pool. */
  get size(): number {
    return this.pool.size;
  }

  prune(now: number): void {
    this.pool.prune(now);
  }

  /** Fades out every voice. */
  stopAll(now: number): void {
    for (const v of this.pool.drain()) this.kill(v, now);
  }

  /** A cue: its recording when one is decoded, the synth recipe otherwise (or layered under it). */
  cue(g: Graph, cue: AudioCue, now: number): void {
    const r = CUES[cue];
    const dest = r.crush ? g.crusher : g.buses.sfx;
    const set = this.samples.cues?.[cue];
    const played = this.sample(g, set, now, dest, r.priority ?? PRIORITY.sfx, 1, 0, set?.send ?? r.send ?? 0);
    if (!played || set?.layerSynth) {
      for (const v of r.voices) this.voice(g, v, now + (v.start ?? 0), dest, r.priority ?? PRIORITY.sfx, 1, r.send ?? 0);
    }
  }

  /** Wet asphalt: a dull heel, a splash and a low thud, louder and brighter when running. */
  footstep(g: Graph, at: number, speed: number, steps: FootstepClock): void {
    const k = Math.min(1, Math.max(0.4, speed / 6.5));
    const pan = steps.nextFoot() * 0.08;
    const p = PRIORITY.footstep;
    const dest = g.buses.sfx;
    if (this.sample(g, this.samples.footsteps, at, dest, p, k, pan, 0)) return;
    const pitch = 0.92 + this.rnd() * 0.16;
    this.voice(g, { type: "noise", freq: 0, dur: 0.07, gain: 0.13, filter: (650 + speed * 90) * pitch, attack: 0.002, pan }, at, dest, p, k);
    this.voice(g, { type: "noise", freq: 0, dur: 0.1 + 0.03 * k, gain: 0.06, filter: 4200 * pitch, filterTo: 2400, filterType: "bandpass", q: 1.2, attack: 0.004, pan }, at + 0.012, dest, p, k);
    this.voice(g, { type: "sine", freq: 75 * pitch, to: 48, dur: 0.07, gain: 0.12, attack: 0.002 }, at, dest, p, k);
  }

  /**
   * Plays a ready recording of `set` through the same pool, bus, panner and reverb send as a
   * synth voice. Returns false when no variant is decoded yet (or ever), so the caller synthesizes.
   */
  sample(g: Graph, set: SampleSet | undefined, at: number, dest: AudioNode, priority: number, scale: number, pan: number, send: number): boolean {
    const picked = this.picker.pick(set);
    if (!picked || !set) return false;
    const { ctx } = g;
    const now = ctx.currentTime;
    // A refused voice still counts as played: falling back to synth would steal the same slot.
    if (!this.pool.canClaim(priority, now)) return true;
    const dur = picked.buffer.duration / picked.rate;
    const end = at + dur + 0.02;
    const src = ctx.createBufferSource();
    src.buffer = picked.buffer;
    src.playbackRate.value = picked.rate;
    const env = ctx.createGain();
    const peak = Math.max(SILENT * 2, (set.gain ?? 1) * scale);
    env.gain.setValueAtTime(peak, at);
    env.gain.setValueAtTime(peak, Math.max(at, end - 0.03));
    env.gain.linearRampToValueAtTime(0, end);
    const claimed = this.pool.claim({ src, env }, priority, now, end);
    if (claimed.ok && claimed.evicted) this.kill(claimed.evicted, now);
    let node: AudioNode = src.connect(env);
    if (pan !== 0 && typeof ctx.createStereoPanner === "function") {
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(pan, at);
      node = node.connect(p);
    }
    node.connect(dest);
    if (send > 0) {
      const s = ctx.createGain();
      s.gain.value = send;
      node.connect(s).connect(g.reverb);
    }
    src.start(at);
    src.stop(end);
    return true;
  }

  /** Builds one voice if the pool admits it; the nodes are disposable (single-use sources). */
  voice(g: Graph, v: Voice, at: number, dest: AudioNode, priority: number, scale = 1, send = 0, echo = 0): void {
    const { ctx } = g;
    const now = ctx.currentTime;
    // Ask first, so a refused voice costs no nodes.
    if (!this.pool.canClaim(priority, now)) return;
    const attack = Math.min(v.attack ?? 0.005, v.dur * 0.5);
    const end = at + v.dur + 0.03;
    const env = ctx.createGain();
    let src: AudioScheduledSourceNode;
    let buffer: AudioBufferSourceNode | null = null;
    if (v.type === "noise") {
      buffer = ctx.createBufferSource();
      buffer.buffer = g.noise;
      buffer.loop = true;
      src = buffer;
    } else {
      const o = ctx.createOscillator();
      o.type = v.type;
      o.frequency.setValueAtTime(v.freq, at);
      if (v.to) o.frequency.exponentialRampToValueAtTime(v.to, at + v.dur);
      if (v.bend) {
        o.detune.setValueAtTime(0, at);
        o.detune.linearRampToValueAtTime(v.bend, at + v.dur);
      }
      src = o;
    }
    const claimed = this.pool.claim({ src, env }, priority, now, end);
    if (claimed.ok && claimed.evicted) this.kill(claimed.evicted, now);
    this.wire(g, v, at, attack, scale, src, env, dest, send, echo);
    // Noise starts at a random offset so repeated bursts do not sound identical.
    if (buffer) buffer.start(at, this.rnd() * 1.5);
    else src.start(at);
    src.stop(end);
  }

  private wire(g: Graph, v: Voice, at: number, attack: number, scale: number, src: AudioNode, env: GainNode, dest: AudioNode, send: number, echo: number): void {
    const { ctx } = g;
    const peak = Math.max(SILENT * 2, v.gain * scale);
    env.gain.setValueAtTime(SILENT, at);
    env.gain.linearRampToValueAtTime(peak, at + attack);
    env.gain.exponentialRampToValueAtTime(SILENT, at + v.dur);
    let node: AudioNode = src;
    if (v.filter) {
      const f = ctx.createBiquadFilter();
      f.type = v.filterType ?? "lowpass";
      f.frequency.setValueAtTime(v.filter, at);
      if (v.filterTo) f.frequency.exponentialRampToValueAtTime(v.filterTo, at + v.dur);
      if (v.q) f.Q.value = v.q;
      node = node.connect(f);
    }
    node = node.connect(env);
    if (v.pan !== undefined && typeof ctx.createStereoPanner === "function") {
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(v.pan, at);
      if (v.panTo !== undefined) p.pan.linearRampToValueAtTime(v.panTo, at + v.dur);
      node = node.connect(p);
    }
    node.connect(dest);
    if (send > 0) {
      const s = ctx.createGain();
      s.gain.value = send;
      node.connect(s).connect(g.reverb);
    }
    if (echo > 0) {
      const s = ctx.createGain();
      s.gain.value = echo;
      node.connect(s).connect(g.echo);
    }
  }

  /** Stops a voice with a short fade so stealing it does not click. */
  private kill(v: PlayingVoice, now: number): void {
    const gain = v.env.gain;
    // Hold the current envelope value instead of jumping back to an earlier event.
    if (typeof gain.cancelAndHoldAtTime === "function") gain.cancelAndHoldAtTime(now);
    else gain.cancelScheduledValues(now);
    gain.setTargetAtTime(0, now, 0.008);
    try {
      v.src.stop(now + 0.05);
    } catch {
      // Already stopped.
    }
  }
}
