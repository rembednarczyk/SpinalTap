import { afterEach, describe, expect, it, vi } from "vitest";
import type { AudioListenerPose } from "@seki/core";
import { DUCK_LEVEL } from "../src/audio/mixer";
import { LAYER_MIX } from "../src/audio/music";
import { CUES, SynthAudio } from "../src/audio/synth-audio";
import { FakeAudioContext, type FakeNode, type FakeParam, ManualTimer } from "./fake-audio-context";

const setup = (opts: { maxVoices?: number; autoStart?: boolean } = {}) => {
  const ctx = new FakeAudioContext();
  const timer = new ManualTimer();
  const audio = new SynthAudio({ createContext: () => ctx.asContext(), setInterval: timer.setInterval, clearInterval: timer.clearInterval, ...opts });
  return { ctx, timer, audio };
};

/** Advances the fake clock in scheduler ticks. */
const run = (ctx: FakeAudioContext, audio: SynthAudio, seconds: number, dt = 0.05) => {
  for (let t = 0; t < seconds; t += dt) {
    ctx.currentTime += dt;
    audio.tick();
  }
};

const gainOf = (n: FakeNode) => n.params.gain!;
const feeding = (ctx: FakeAudioContext, target: FakeNode, kind = "gain") => ctx.created.filter((n) => n.kind === kind && n.outputs.includes(target));

/** master → compressor → destination; music bus → low-pass → master. */
const graph = (ctx: FakeAudioContext) => {
  const compressor = ctx.created.find((n) => n.kind === "compressor")!;
  const master = feeding(ctx, compressor)[0]!;
  const musicFilter = feeding(ctx, master, "biquad")[0]!;
  const music = feeding(ctx, musicFilter)[0]!;
  const [sfx, ambience] = feeding(ctx, master);
  const layers = feeding(ctx, music);
  return { compressor, master, music, sfx: sfx!, ambience: ambience!, layers, musicFilter };
};

const pose = (x: number, z: number, speed = 0): AudioListenerPose => ({ position: { x, y: 1.6, z }, yaw: 0, speed });

afterEach(() => vi.unstubAllGlobals());

describe("audio cues", () => {
  it("defines a non-empty, audible recipe for every cue", () => {
    for (const r of Object.values(CUES)) {
      expect(r.voices.length).toBeGreaterThan(0);
      for (const v of r.voices) {
        expect(v.dur).toBeGreaterThan(0);
        expect(v.gain).toBeGreaterThan(0);
        if (v.to !== undefined) expect(v.to).toBeGreaterThan(0);
        if (v.filterTo !== undefined) expect(v.filterTo).toBeGreaterThan(0);
      }
    }
  });

  it("gives the shot an alley tail and routes the memory glitch through the crusher", () => {
    expect(CUES.shot.send).toBeGreaterThan(0.5);
    expect(CUES.memory.crush).toBe(true);
    expect(CUES.memory.voices.some((v) => v.bend !== undefined)).toBe(true);
  });
});

describe("SynthAudio without WebAudio", () => {
  it("is a silent no-op when AudioContext does not exist", () => {
    vi.stubGlobal("AudioContext", undefined);
    const a = new SynthAudio();
    expect(() => {
      a.unlock();
      a.play("shot");
      a.setMood("dialog");
      a.setListener(pose(0, 0, 5));
      a.setVolume("music", 0.2);
      a.startAmbience();
      a.tick();
      a.stopAll();
    }).not.toThrow();
    expect(a.ready).toBe(false);
    expect(a.getVolume("music")).toBe(0.2);
  });

  it("swallows a failing context constructor and does not retry every gesture", () => {
    const factory = vi.fn(() => {
      throw new Error("NotSupportedError");
    });
    const a = new SynthAudio({ createContext: factory });
    a.unlock();
    a.unlock();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(a.ready).toBe(false);
  });

  it("accepts a factory that reports no audio", () => {
    const a = new SynthAudio({ createContext: () => null });
    a.unlock();
    expect(a.ready).toBe(false);
  });

  it("does not leak a rejected resume()", async () => {
    const { ctx, audio } = setup();
    ctx.rejectResume = true;
    audio.unlock();
    await Promise.resolve();
    expect(ctx.resumeCalls).toBe(1);
  });
});

describe("SynthAudio graph and mixer", () => {
  it("builds master → compressor → destination on unlock and resumes", () => {
    const { ctx, audio } = setup();
    audio.unlock();
    const g = graph(ctx);
    expect(g.compressor.outputs).toContain(ctx.destination);
    expect(ctx.state).toBe("running");
    expect(g.layers).toHaveLength(5);
    expect(audio.ready).toBe(true);
  });

  it("creates the shared graph once, however many gestures", () => {
    const { ctx, audio } = setup();
    audio.unlock();
    const n = ctx.created.length;
    audio.unlock();
    audio.startAmbience();
    expect(ctx.created.length).toBe(n);
  });

  it("applies bus volumes, clamped, to the matching nodes", () => {
    const { ctx, audio } = setup();
    audio.setVolume("sfx", 0.4);
    audio.unlock();
    const g = graph(ctx);
    expect(gainOf(g.sfx).value).toBe(0.4);
    audio.setVolume("ambience", 7);
    audio.setVolume("master", 0.25);
    expect(audio.getVolume("ambience")).toBe(1);
    expect(gainOf(g.ambience).target).toBe(1);
    expect(gainOf(g.master).target).toBe(0.25);
  });

  it("ducks the music during dialogue and restores it afterwards", () => {
    const { ctx, audio } = setup();
    audio.unlock();
    const g = graph(ctx);
    const music = audio.getVolume("music");
    audio.setMood("dialog");
    expect(gainOf(g.music).target).toBeCloseTo(music * DUCK_LEVEL);
    audio.setVolume("music", 1);
    expect(gainOf(g.music).target).toBeCloseTo(DUCK_LEVEL);
    audio.setMood("explore");
    expect(gainOf(g.music).target).toBe(1);
  });

  it("remembers dialogue ducking set before the context exists", () => {
    const { ctx, audio } = setup();
    audio.setMood("dialog");
    audio.unlock();
    expect(gainOf(graph(ctx).music).value).toBeCloseTo(audio.getVolume("music") * DUCK_LEVEL);
  });
});

describe("SynthAudio music", () => {
  const layerTargets = (layers: FakeNode[]) => layers.map((l) => gainOf(l).target);

  it("fades exploration layers in and crossfades to combat on gunfire", () => {
    const { ctx, audio } = setup();
    // Out on the street, away from the bar speakers: a new game now starts in the clinic next to
    // RAMEN's speaker (ADR-0038), whose radio would duck the music.
    audio.setListener({ position: { x: 0, y: 1.6, z: -28 }, yaw: 0, speed: 0 });
    audio.unlock();
    const { layers } = graph(ctx);
    expect(audio.currentMood).toBe("explore");
    const explore = layerTargets(layers);
    expect(explore[3]).toBe(0); // drums
    audio.play("enemy-shot");
    expect(audio.currentMood).toBe("combat");
    const combat = layerTargets(layers);
    expect(combat[3]).toBeGreaterThan(0);
    run(ctx, audio, 10);
    expect(audio.currentMood).toBe("explore");
    expect(layerTargets(layers)).toEqual(explore);
  });

  it("switches layers only with smooth ramps, never with a jump", () => {
    const { ctx, audio } = setup();
    audio.unlock();
    const { layers, musicFilter } = graph(ctx);
    audio.play("overdrive");
    audio.setMood("dialog");
    run(ctx, audio, 2);
    const methods = (p: FakeParam) => new Set(p.events.map((e) => e[0]));
    for (const l of layers) expect([...methods(gainOf(l))]).toEqual(["target"]);
    expect([...methods(musicFilter.params.frequency!)]).toEqual(["target"]);
  });

  it("schedules notes ahead and plays no drums while exploring", () => {
    const { ctx, audio } = setup({ maxVoices: 500 });
    audio.unlock();
    const { layers } = graph(ctx);
    const drums = layers[3]!;
    run(ctx, audio, 6);
    const notes = feeding(ctx, layers[0]!).length + feeding(ctx, layers[1]!).length + feeding(ctx, layers[2]!).length;
    expect(notes).toBeGreaterThan(20);
    expect(feeding(ctx, drums)).toHaveLength(0);
    audio.setMood("combat");
    run(ctx, audio, 2);
    expect(feeding(ctx, drums).length).toBeGreaterThan(0);
  });

  it("skips ahead after a stall instead of firing a burst", () => {
    const { ctx, audio } = setup({ maxVoices: 1000 });
    audio.unlock();
    run(ctx, audio, 1);
    const before = ctx.created.length;
    ctx.currentTime += 60;
    audio.tick();
    expect(ctx.created.length - before).toBeLessThan(80);
  });
});

describe("SynthAudio voices and performance", () => {
  it("never holds more voices than the pool allows", () => {
    const { ctx, audio } = setup({ maxVoices: 12 });
    audio.unlock();
    for (let i = 0; i < 200; i++) {
      audio.play(i % 2 ? "shot" : "memory");
      if (i % 4 === 0) ctx.currentTime += 0.03;
    }
    expect(audio.voiceCount).toBeLessThanOrEqual(12);
    run(ctx, audio, 3);
    expect(audio.voiceCount).toBeLessThanOrEqual(12);
  });

  it("does not stack the same cue triggered in one instant", () => {
    const { ctx, audio } = setup({ maxVoices: 500, autoStart: false });
    audio.unlock();
    for (let i = 0; i < 50; i++) audio.play("shot");
    const once = CUES.shot.voices.length;
    expect(ctx.count("oscillator") + ctx.count("buffer-source")).toBe(once);
    ctx.currentTime += 0.1;
    audio.play("shot");
    expect(ctx.count("oscillator") + ctx.count("buffer-source")).toBe(once * 2);
  });

  it("fades out a stolen voice before stopping it", () => {
    const { ctx, audio } = setup({ maxVoices: 2, autoStart: false });
    audio.unlock();
    audio.play("hit");
    const first = ctx.created.find((n) => n.kind === "gain" && n.params.gain!.events.length > 0 && n.params.gain!.events[0]![0] === "set")!;
    audio.play("shot");
    expect(first.params.gain!.events.map((e) => e[0])).toContain("hold");
  });

  it("creates no nodes when the listener moves", () => {
    const { ctx, audio } = setup();
    audio.unlock();
    const n = ctx.created.length;
    for (let i = 0; i < 300; i++) audio.setListener(pose(Math.sin(i / 30) * 6, i / 10));
    expect(ctx.created.length).toBe(n);
  });

  it("raises the neon hum under the signs and the steam near the manhole", () => {
    const { audio } = setup();
    audio.unlock();
    audio.setListener(pose(0, -60));
    const far = audio.positional;
    audio.setListener(pose(5.8, 2));
    const sign = audio.positional;
    audio.setListener(pose(1.8, 5.5));
    const vent = audio.positional;
    expect(sign.hum.gain).toBeGreaterThan(far.hum.gain);
    expect(sign.hum.pan).toBeGreaterThan(0); // the bar is on the east (right) side
    expect(vent.steam.gain).toBeGreaterThan(far.steam.gain);
  });

  it("plays footsteps only while moving, more of them when sprinting", () => {
    const steps = (speed: number) => {
      const { ctx, audio } = setup({ maxVoices: 5000, autoStart: false });
      audio.unlock();
      audio.setListener(pose(0, 0, speed));
      run(ctx, audio, 4);
      return ctx.count("buffer-source");
    };
    const still = steps(0);
    expect(still).toBe(0);
    expect(steps(4.2)).toBeGreaterThan(still);
    expect(steps(6.9)).toBeGreaterThan(steps(4.2));
  });

  it("stopAll silences everything and the soundscape can start again", () => {
    const { ctx, audio, timer } = setup();
    audio.unlock();
    audio.play("shot");
    run(ctx, audio, 0.5);
    audio.stopAll();
    expect(timer.cleared).toBe(1);
    expect(audio.voiceCount).toBe(0);
    for (const s of ctx.sources()) expect(s.stopped).not.toBeNull();
    const n = ctx.created.length;
    audio.startAmbience();
    expect(ctx.created.length).toBeGreaterThan(n);
    expect(timer.fn).not.toBeNull();
    expect(Object.values(LAYER_MIX.explore).some((v) => v > 0)).toBe(true);
  });

  it("drives the scheduler from its timer", () => {
    const { ctx, audio, timer } = setup({ maxVoices: 500 });
    audio.unlock();
    const n = ctx.created.length;
    ctx.currentTime = 1;
    timer.fn!();
    expect(ctx.created.length).toBeGreaterThan(n);
  });
});
