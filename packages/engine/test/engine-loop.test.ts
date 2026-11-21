import { describe, expect, it } from "vitest";
import { ENGINE_RATE, engineVoice } from "../src/audio/engine-loop";
import { WHINE_PITCH, whineVoice } from "../src/audio/motor-whine";
import { SynthAudio } from "../src/audio/synth-audio";
import { FakeAudioContext, type FakeNode, ManualTimer } from "./fixtures/fake-audio-context";

type Source = FakeNode & { buffer: { length: number } | null; loop: boolean; started: number | null; stopped: number | null };

const setup = (files: Record<string, number> = { "engine.ogg": 40_000 }) => {
  const ctx = new FakeAudioContext();
  const timer = new ManualTimer();
  const audio = new SynthAudio({
    createContext: () => ctx.asContext(),
    setInterval: timer.setInterval,
    clearInterval: timer.clearInterval,
    autoStart: false,
    samples: { engine: { url: "engine.ogg", gain: 0.5 } },
    fetchBytes: (url) => (files[url] ? Promise.resolve(new ArrayBuffer(files[url])) : Promise.reject(new Error(`404 ${url}`))),
  });
  const loops = () => ctx.created.filter((n) => n.kind === "buffer-source" && (n as Source).loop) as Source[];
  return { ctx, audio, loops };
};

describe("the engine of the car she drives (ADR-0097)", () => {
  it("pitches its loop with the revs and makes it louder and brighter with the throttle", () => {
    const idle = engineVoice({ rpm: 0, throttle: 0, speed: 0 });
    const top = engineVoice({ rpm: 1, throttle: 1, speed: 0 });
    expect(idle.rate).toBe(ENGINE_RATE.idle);
    expect(top.rate).toBe(ENGINE_RATE.limiter);
    expect(top.level).toBe(1);
    expect(idle.level).toBeLessThan(0.5);
    expect(top.tone).toBeGreaterThan(idle.tone);
    // Out of range in, in range out.
    expect(engineVoice({ rpm: 3, throttle: -1, speed: 0 }).rate).toBe(ENGINE_RATE.limiter);
  });

  it("lays the hybrid's electric whine over it, rising with the wheels' speed, louder pulling than coasting (user's notes of 21.11)", () => {
    const still = whineVoice({ rpm: 0, throttle: 0, speed: 0 });
    const coast = whineVoice({ rpm: 0.3, throttle: 0, speed: 20 });
    const pull = whineVoice({ rpm: 0.3, throttle: 1, speed: 20 });
    expect(still.freq).toBe(WHINE_PITCH.rest);
    expect(coast.freq).toBeGreaterThan(still.freq);
    expect(whineVoice({ rpm: 1, throttle: 1, speed: 100 }).freq).toBe(WHINE_PITCH.top);
    // The wheels, not the revs: the same speed in another gear sounds the same.
    expect(whineVoice({ rpm: 0.9, throttle: 0, speed: 20 }).freq).toBe(coast.freq);
    expect(pull.level).toBeGreaterThan(coast.level);
    expect(coast.level).toBeGreaterThan(still.level);
    // Backwards as forwards.
    expect(whineVoice({ rpm: 0.3, throttle: 0, speed: -20 }).freq).toBe(coast.freq);
  });

  it("plays one loop while she drives, following the revs, and fades it out when she gets out", async () => {
    const { ctx, audio, loops } = setup();
    audio.unlock();
    await audio.sampleBank.settled();
    expect(audio.engine.playing).toBe(false);
    audio.engine.set({ rpm: 0, throttle: 0, speed: 0 });
    expect(audio.engine.playing).toBe(true);
    expect(loops()).toHaveLength(1);
    const src = loops()[0]!;
    expect(src.params.playbackRate!.target).toBe(ENGINE_RATE.idle);
    ctx.currentTime += 0.1;
    audio.engine.set({ rpm: 1, throttle: 1, speed: 0 });
    expect(src.params.playbackRate!.target).toBe(ENGINE_RATE.limiter);
    // Its level: the spec's gain at full throttle.
    expect(src.outputs[0]!.outputs[0]!.params.gain!.target).toBe(0.5);
    // Every frame the same loop, never a second one.
    for (let i = 0; i < 10; i++) audio.engine.set({ rpm: 0.5, throttle: 0.5, speed: 0 });
    expect(loops()).toHaveLength(1);
    expect(audio.engine.whining).toBe(true);
    audio.engine.set(null);
    expect(audio.engine.playing).toBe(false);
    expect(audio.engine.whining).toBe(false);
    expect(src.stopped).not.toBeNull();
  });

  it("starts once its recording is in when she is already driving, and stays silent without one", async () => {
    const { audio, loops } = setup();
    audio.unlock();
    audio.engine.set({ rpm: 0.2, throttle: 0, speed: 0 });
    expect(audio.engine.playing).toBe(false);
    await audio.sampleBank.settled();
    audio.tick();
    expect(audio.engine.playing).toBe(true);
    expect(loops()).toHaveLength(1);
    const none = setup({});
    none.audio.unlock();
    await none.audio.sampleBank.settled();
    none.audio.engine.set({ rpm: 0.2, throttle: 0, speed: 0 });
    expect(none.audio.engine.playing).toBe(false);
    // The electric motor needs no recording.
    expect(none.audio.engine.whining).toBe(true);
  });
});
