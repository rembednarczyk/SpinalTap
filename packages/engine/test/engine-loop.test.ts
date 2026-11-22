import { describe, expect, it } from "vitest";
import { ENGINE_RATE, engineVoice } from "../src/audio/engine-loop";
import { SQUEAL_FROM, carLoopVoices } from "../src/audio/car-loops";
import { SynthAudio } from "../src/audio/synth-audio";
import { FakeAudioContext, type FakeNode, ManualTimer } from "./fixtures/fake-audio-context";

type Source = FakeNode & { buffer: { length: number } | null; loop: boolean; started: number | null; stopped: number | null };

const LOOPS = { roll: { url: "roll.ogg" }, wind: { url: "wind.ogg" }, skid: { url: "skid.ogg", gain: 0.8 }, scrape: { url: "scrape.ogg" }, sparks: { url: "sparks.ogg" } } as const;
const ALL = { "engine.ogg": 40_000, "roll.ogg": 30_000, "wind.ogg": 30_000, "skid.ogg": 30_000, "scrape.ogg": 30_000, "sparks.ogg": 30_000 };

const setup = (files: Record<string, number> = { "engine.ogg": 40_000 }) => {
  const ctx = new FakeAudioContext();
  const timer = new ManualTimer();
  const audio = new SynthAudio({
    createContext: () => ctx.asContext(),
    setInterval: timer.setInterval,
    clearInterval: timer.clearInterval,
    autoStart: false,
    samples: { engine: { url: "engine.ogg", gain: 0.5 }, carLoops: LOOPS },
    fetchBytes: (url) => (files[url] ? Promise.resolve(new ArrayBuffer(files[url])) : Promise.reject(new Error(`404 ${url}`))),
  });
  // The engine's loops: not the tyres' hiss on the graph's noise (two seconds long).
  const loops = () => ctx.created.filter((n) => n.kind === "buffer-source" && (n as Source).loop && (n as Source).buffer?.length !== ctx.sampleRate * 2) as Source[];
  return { ctx, audio, loops };
};

describe("the engine of the car she drives (ADR-0097)", () => {
  it("pitches its loop with the revs and makes it louder and brighter with the throttle", () => {
    const idle = engineVoice({ rpm: 0, throttle: 0 });
    const top = engineVoice({ rpm: 1, throttle: 1 });
    expect(idle.rate).toBe(ENGINE_RATE.idle);
    expect(top.rate).toBe(ENGINE_RATE.limiter);
    expect(top.level).toBe(1);
    expect(idle.level).toBeLessThan(0.5);
    expect(top.tone).toBeGreaterThan(idle.tone);
    // Out of range in, in range out.
    expect(engineVoice({ rpm: 3, throttle: -1 }).rate).toBe(ENGINE_RATE.limiter);
  });

  it("squeals the tyres from their recording only sliding past their grip's peak, louder and higher the harder they slide (22.11)", () => {
    expect(carLoopVoices({ rpm: 0.5, throttle: 1 }).skid.level).toBe(0);
    expect(carLoopVoices({ rpm: 0.5, throttle: 1, skid: 0.3 }).skid.level).toBe(0);
    expect(carLoopVoices({ rpm: 0.5, throttle: 1, skid: SQUEAL_FROM }).skid.level).toBe(0);
    const some = carLoopVoices({ rpm: 0, throttle: 0, skid: 0.6 }).skid;
    const full = carLoopVoices({ rpm: 0, throttle: 0, skid: 1 }).skid;
    expect(some.level).toBeGreaterThan(0);
    expect(full.level).toBe(1);
    expect(some.level).toBeLessThan(full.level);
    expect(some.rate).toBeLessThan(full.rate);
  });

  it("rolls the tyres and blows the wind with the speed: silent standing, the wind only fast (22.11)", () => {
    const still = carLoopVoices({ rpm: 0, throttle: 0, speed: 0 });
    const town = carLoopVoices({ rpm: 0.4, throttle: 0.3, speed: 14 });
    const fast = carLoopVoices({ rpm: 0.8, throttle: 1, speed: 40 });
    expect(still.roll.level).toBe(0);
    expect(still.wind.level).toBe(0);
    expect(town.roll.level).toBeGreaterThan(0.5);
    expect(town.wind.level).toBeLessThan(0.05);
    expect(fast.wind.level).toBeGreaterThan(0.8);
    expect(fast.roll.rate).toBeGreaterThan(town.roll.rate);
    // Backwards as forwards.
    expect(carLoopVoices({ rpm: 0, throttle: 0, speed: -14 }).roll).toEqual(town.roll);
  });

  it("scrapes along a wall it touches and throws sparks only sliding fast along it (22.11)", () => {
    expect(carLoopVoices({ rpm: 0, throttle: 0, scrape: 0 }).scrape.level).toBe(0);
    const slow = carLoopVoices({ rpm: 0, throttle: 0, scrape: 2 });
    const fast = carLoopVoices({ rpm: 0, throttle: 0, scrape: 15 });
    expect(slow.scrape.level).toBeGreaterThan(0.3);
    expect(slow.sparks.level).toBe(0);
    expect(fast.scrape.level).toBe(1);
    expect(fast.sparks.level).toBeGreaterThan(0.5);
  });

  it("plays one loop while she drives, following the revs, and fades it out when she gets out", async () => {
    const { ctx, audio, loops } = setup();
    audio.unlock();
    await audio.sampleBank.settled();
    expect(audio.engine.playing).toBe(false);
    audio.engine.set({ rpm: 0, throttle: 0 });
    expect(audio.engine.playing).toBe(true);
    expect(loops()).toHaveLength(1);
    const src = loops()[0]!;
    expect(src.params.playbackRate!.target).toBe(ENGINE_RATE.idle);
    ctx.currentTime += 0.1;
    audio.engine.set({ rpm: 1, throttle: 1 });
    expect(src.params.playbackRate!.target).toBe(ENGINE_RATE.limiter);
    // Its level: the spec's gain at full throttle.
    expect(src.outputs[0]!.outputs[0]!.params.gain!.target).toBe(0.5);
    // Every frame the same loop, never a second one.
    for (let i = 0; i < 10; i++) audio.engine.set({ rpm: 0.5, throttle: 0.5 });
    expect(loops()).toHaveLength(1);
    audio.engine.set(null);
    expect(audio.engine.playing).toBe(false);
    expect(src.stopped).not.toBeNull();
  });

  it("starts once its recording is in when she is already driving, and stays silent without one", async () => {
    const { audio, loops } = setup();
    audio.unlock();
    audio.engine.set({ rpm: 0.2, throttle: 0 });
    expect(audio.engine.playing).toBe(false);
    await audio.sampleBank.settled();
    audio.tick();
    expect(audio.engine.playing).toBe(true);
    expect(loops()).toHaveLength(1);
    const none = setup({});
    none.audio.unlock();
    await none.audio.sampleBank.settled();
    none.audio.engine.set({ rpm: 0.2, throttle: 0 });
    expect(none.audio.engine.playing).toBe(false);
    // No stand-ins (22.11): without their recordings the car's loops stay silent, nothing synthesized.
    expect(none.audio.engine.rolling).toBe(false);
    expect(none.ctx.created.filter((n) => n.kind === "oscillator")).toHaveLength(0);
  });

  it("runs every recorded loop of the car beside its engine while she drives, and fades them all as she gets out (22.11)", async () => {
    const { audio, loops } = setup(ALL);
    audio.unlock();
    await audio.sampleBank.settled();
    audio.engine.set({ rpm: 0.3, throttle: 0.5, speed: 12, skid: 0.8, scrape: 6 });
    expect(audio.engine.rolling).toBe(true);
    // The engine and five loops: roll, wind, skid, scrape, sparks.
    expect(loops()).toHaveLength(6);
    for (let i = 0; i < 5; i++) audio.engine.set({ rpm: 0.3, throttle: 0.5, speed: 12 });
    expect(loops()).toHaveLength(6);
    audio.engine.set(null);
    expect(audio.engine.rolling).toBe(false);
    expect(loops().every((l) => l.stopped !== null)).toBe(true);
  });
});
