import type { EngineSound } from "@seki/core";
import type { Graph } from "./audio-graph";
import { CarLoops } from "./car-loops";
import type { CarLoopsSpec, EngineLoopSpec, SampleBank } from "./samples";

/** Playback rate of the loop at idle and at the limiter: the recording is an idle's beat, pitched up with the revs. */
export const ENGINE_RATE = { idle: 0.7, limiter: 2.2 } as const;
/** Share of the full level off the throttle: an engine idling or coasting is quieter than one pulling. */
const COAST_LEVEL = 0.45;
/** The tone's low-pass (Hz): dull off the throttle, open when pulling hard at high revs. */
const TONE = { closed: 700, open: 5600 } as const;
/** Time constants (s): the revs follow quickly, the start and stop are a short fade. */
const FOLLOW = 0.05;
const FADE = 0.25;

/** Rate, level share and low-pass of the loop for an engine's state (pure; tests). */
export const engineVoice = (e: EngineSound): { rate: number; level: number; tone: number } => {
  const rpm = Math.min(1, Math.max(0, e.rpm));
  const throttle = Math.min(1, Math.max(0, e.throttle));
  return {
    rate: ENGINE_RATE.idle + (ENGINE_RATE.limiter - ENGINE_RATE.idle) * rpm,
    level: COAST_LEVEL + (1 - COAST_LEVEL) * throttle,
    tone: TONE.closed + (TONE.open - TONE.closed) * (0.3 * rpm + 0.7 * throttle),
  };
};

interface Running {
  readonly src: AudioBufferSourceNode;
  readonly level: GainNode;
  readonly tone: BiquadFilterNode;
}

/**
 * The engine as one recorded loop pitched with the revs (the single-loop variant of the games'
 * granular and crossfaded engine sounds: one recording, its playback rate following the rpm, its
 * level the throttle, a low-pass opening as it pulls). Starts once its recording is decoded and
 * she drives; fades out when she gets out. A part of `SynthAudio` of its own (`audio.engine`).
 */
export class EngineLoop {
  private want: EngineSound | null = null;
  private run: Running | null = null;
  /** The car's other recorded loops (22.11): roll, wind, squeal, scrape, sparks. */
  private readonly loops: CarLoops;

  constructor(
    private readonly bank: SampleBank,
    private readonly spec: EngineLoopSpec | undefined,
    /** The audio graph once the context exists. */
    private readonly graph: () => Graph | null,
    loops?: CarLoopsSpec,
  ) {
    this.loops = new CarLoops(bank, loops);
  }

  /** True while the car's other loops run, silent or not (debug, tests). */
  get rolling(): boolean {
    return this.loops.playing;
  }

  /** True while the loop plays (debug, tests). */
  get playing(): boolean {
    return this.run !== null;
  }

  /** The engine now, or null with no car (every frame); applied at once when there is a context. */
  set(engine: EngineSound | null): void {
    this.want = engine;
    const g = this.graph();
    if (g) this.apply(g, g.ctx.currentTime);
  }

  /** Starts, follows or stops the loop; called again on every scheduler step until the recording is in. */
  apply(g: Graph, now: number): void {
    const want = this.want;
    if (!want) return this.stop(now);
    this.loops.follow(g, now, want);
    const run = this.run ?? this.start(g, now);
    if (!run) return;
    const v = engineVoice(want);
    run.src.playbackRate.setTargetAtTime(v.rate, now, FOLLOW);
    run.level.gain.setTargetAtTime((this.spec?.gain ?? 1) * v.level, now, FOLLOW);
    run.tone.frequency.setTargetAtTime(v.tone, now, FOLLOW);
  }

  stop(now: number): void {
    this.loops.stop(now);
    const run = this.run;
    if (!run) return;
    run.level.gain.setTargetAtTime(0, now, FADE / 3);
    run.src.stop(now + FADE);
    this.run = null;
  }

  private start(g: Graph, now: number): Running | null {
    const buffer = this.spec ? this.bank.get(this.spec.url) : null;
    if (!buffer) return null;
    const { ctx } = g;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = TONE.closed;
    const level = ctx.createGain();
    level.gain.value = 0;
    src.connect(tone).connect(level).connect(g.buses.sfx);
    src.start(now);
    this.run = { src, level, tone };
    return this.run;
  }
}
