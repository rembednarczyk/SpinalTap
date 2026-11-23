import type { Graph } from "./audio-graph";

/*
 * The node factories of the looping soundscapes (W-3's sector, the rooms'): gains, filters, a looping noise, oscillators
 * and their LFOs, a layer's strip (level and pan) and a group (level and the walls' low-pass). Every source is collected
 * for the teardown.
 */

export interface Strip {
  readonly gain: GainNode;
  readonly pan: StereoPannerNode | null;
}

export interface Group {
  readonly gain: GainNode;
  readonly filter: BiquadFilterNode;
}

/** Node factories over one context; every source is collected for the teardown. */
export const kit = (g: Graph, sources: AudioScheduledSourceNode[]) => {
  const { ctx } = g;
  const gain = (v: number) => {
    const n = ctx.createGain();
    n.gain.value = v;
    return n;
  };
  const filter = (type: BiquadFilterType, freq: number, q = 0.7) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  };
  const noise = (rate: number) => {
    const s = ctx.createBufferSource();
    s.buffer = g.noise;
    s.loop = true;
    s.playbackRate.value = rate;
    sources.push(s);
    return s;
  };
  const osc = (type: OscillatorType, freq: number) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    sources.push(o);
    return o;
  };
  const lfo = (freq: number, depth: number, target: AudioParam) => {
    osc("sine", freq).connect(gain(depth)).connect(target);
  };
  /** A layer's level and pan into its group; `pan` false for a sound all round (the strip lights). */
  const strip = (into: AudioNode, pan = true): Strip => {
    const level = gain(0);
    const p = pan && typeof ctx.createStereoPanner === "function" ? ctx.createStereoPanner() : null;
    if (p) level.connect(p).connect(into);
    else level.connect(into);
    return { gain: level, pan: p };
  };
  const group = (out: AudioNode): Group => {
    const level = gain(0);
    const f = filter("lowpass", 12000);
    level.connect(f).connect(out);
    return { gain: level, filter: f };
  };
  return { gain, filter, noise, osc, lfo, strip, group };
};

export type Kit = ReturnType<typeof kit>;
