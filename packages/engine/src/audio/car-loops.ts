import type { EngineSound } from "@seki/core";
import type { Graph } from "./audio-graph";
import type { CarLoopsSpec, SampleBank } from "./samples";

/*
 * The car's sounds that run while it moves (the user's request of 22.11: every sound typical for a
 * car, recorded, no stand-ins): the tyres' roll on the road and the wind from its speed, the tyres'
 * squeal from their slide, the body's scrape along a wall and, faster, its sparks (metal ground on
 * concrete). Each a recorded loop whose level and playback rate follow the car's state, the way racing
 * games layer their surface, wind and skid loops over the engine (the loop-per-parameter model of
 * engine and tyre audio in middleware such as FMOD and Wwise, here with Web Audio's buffer sources).
 */

export type CarLoopKey = keyof CarLoopsSpec;

/** The tyres squeal past this slide (0..1, `EngineSound.skid`): past the grip's peak, not in an ordinary bend. */
export const SQUEAL_FROM = 0.35;
/** The roll is heard from a crawl, full at this speed (m/s, about 110 km/h). */
const ROLL_FULL = 30;
/** The wind rises from this speed (m/s, about 36 km/h), full at `WIND_FULL` (about 150 km/h). */
const WIND_FROM = 10;
const WIND_FULL = 42;
/** The scrape from this slide along a wall (m/s), full at `SCRAPE_FULL`. */
const SCRAPE_FROM = 0.3;
const SCRAPE_FULL = 8;
/** The sparks from this slide along a wall (m/s, some 18 km/h), full at `SPARKS_FULL` (about 72 km/h). */
const SPARKS_FROM = 5;
const SPARKS_FULL = 20;

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const ramp = (x: number, from: number, full: number): number => clamp01((x - from) / (full - from));

/** How hard the tyres squeal (0 none .. 1 a full slide) for the car's slide (pure; tests). */
export const squealOf = (e: EngineSound): number => {
  const s = ramp(e.skid ?? 0, SQUEAL_FROM, 1);
  return s * s;
};

/** Each loop's level share (0..1) and playback rate for the car's state (pure; tests). */
export const carLoopVoices = (e: EngineSound): Readonly<Record<CarLoopKey, { readonly level: number; readonly rate: number }>> => {
  const v = Math.abs(e.speed ?? 0);
  const roll = Math.sqrt(ramp(v, 0.5, ROLL_FULL));
  const wind = ramp(v, WIND_FROM, WIND_FULL) ** 2;
  const squeal = squealOf(e);
  const along = e.scrape ?? 0;
  const scrape = along > SCRAPE_FROM ? Math.sqrt(ramp(along, SCRAPE_FROM, SCRAPE_FULL)) : 0;
  const sparks = ramp(along, SPARKS_FROM, SPARKS_FULL);
  return {
    roll: { level: roll, rate: 0.8 + 0.5 * ramp(v, 0, ROLL_FULL) },
    wind: { level: wind, rate: 0.9 + 0.3 * wind },
    skid: { level: squeal, rate: 0.92 + 0.16 * squeal },
    scrape: { level: scrape, rate: 0.8 + 0.4 * ramp(along, SCRAPE_FROM, SCRAPE_FULL) },
    sparks: { level: sparks, rate: 0.9 + 0.2 * sparks },
  };
};

const FOLLOW = 0.05;
const FADE = 0.2;

interface Running {
  readonly src: AudioBufferSourceNode;
  readonly level: GainNode;
}

/**
 * The car's loops: each starts once its recording is decoded and the car runs, silent until its
 * state calls for it, and all fade out when she gets out. A part of `EngineLoop` of its own.
 */
export class CarLoops {
  private readonly run = new Map<CarLoopKey, Running>();

  constructor(
    private readonly bank: SampleBank,
    private readonly spec: CarLoopsSpec | undefined,
  ) {}

  /** True while any loop runs, silent or not (debug, tests). */
  get playing(): boolean {
    return this.run.size > 0;
  }

  /** The loops for the car's state now. */
  follow(g: Graph, now: number, e: EngineSound): void {
    if (!this.spec) return;
    const voices = carLoopVoices(e);
    for (const key of Object.keys(voices) as CarLoopKey[]) {
      const run = this.run.get(key) ?? this.start(g, now, key);
      if (!run) continue;
      const v = voices[key];
      run.level.gain.setTargetAtTime((this.spec[key].gain ?? 1) * v.level, now, FOLLOW);
      run.src.playbackRate.setTargetAtTime(v.rate, now, FOLLOW);
    }
  }

  stop(now: number): void {
    for (const r of this.run.values()) {
      r.level.gain.setTargetAtTime(0, now, FADE / 3);
      r.src.stop(now + FADE);
    }
    this.run.clear();
  }

  private start(g: Graph, now: number, key: CarLoopKey): Running | null {
    const spec = this.spec?.[key];
    const buffer = spec ? this.bank.get(spec.url) : null;
    if (!buffer) return null;
    const src = g.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const level = g.ctx.createGain();
    level.gain.value = 0;
    src.connect(level).connect(g.buses.sfx);
    // Each loop from its own point, so two of them never start in step.
    src.start(now, (buffer.duration * (this.run.size * 0.37)) % buffer.duration);
    const run = { src, level };
    this.run.set(key, run);
    return run;
  }
}
