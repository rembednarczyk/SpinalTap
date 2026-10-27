import { describe, expect, it } from "vitest";
import { CUES, SynthAudio } from "../src/audio/synth-audio";
import { type AudioSampleManifest, SampleBank, VariantPicker, manifestUrls, pickVariant, pitchRate } from "../src/audio/samples";
import { mulberry32 } from "../src/audio/music";
import { FakeAudioContext, type FakeNode, ManualTimer } from "./fake-audio-context";

/** In-memory "server": URL → bytes; anything else is a 404. Counts requests per URL. */
const server = (files: Record<string, number>) => {
  const bytes = new Map(Object.entries(files).map(([url, size]) => [url, new ArrayBuffer(size)]));
  const requests: string[] = [];
  const fetchBytes = (url: string) => {
    requests.push(url);
    const b = bytes.get(url);
    return b ? Promise.resolve(b) : Promise.reject(new Error(`404 ${url}`));
  };
  return { bytes, requests, fetchBytes };
};

const MANIFEST: AudioSampleManifest = {
  cues: {
    shot: { urls: ["shot-a.ogg", "shot-b.ogg"], pitch: 0.05, send: 0.5 },
    critical: { urls: ["crit.ogg"], layerSynth: true },
    hit: { urls: ["missing.ogg"] },
    denied: { urls: ["broken.ogg"] },
  },
  footsteps: { urls: ["step-1.ogg", "step-2.ogg", "step-3.ogg"], pitch: 0.08 },
  rain: { url: "rain.ogg", gain: 0.8, synthLevel: 0.25 },
};

const FILES = { "shot-a.ogg": 800, "shot-b.ogg": 900, "crit.ogg": 400, "broken.ogg": 64, "step-1.ogg": 100, "step-2.ogg": 110, "step-3.ogg": 120, "rain.ogg": 8000 * 20 };

const setup = async (manifest: AudioSampleManifest = MANIFEST, files: Record<string, number> = FILES) => {
  const ctx = new FakeAudioContext();
  const srv = server(files);
  const broken = srv.bytes.get("broken.ogg");
  if (broken) ctx.undecodable.add(broken);
  const timer = new ManualTimer();
  const audio = new SynthAudio({
    createContext: () => ctx.asContext(),
    setInterval: timer.setInterval,
    clearInterval: timer.clearInterval,
    samples: manifest,
    fetchBytes: srv.fetchBytes,
  });
  return { ctx, srv, audio };
};

type BufferSource = FakeNode & { buffer: unknown; loop: boolean; started: number | null };
const bufferSources = (ctx: FakeAudioContext, from = 0): BufferSource[] => ctx.created.slice(from).filter((n) => n.kind === "buffer-source") as BufferSource[];
/** Buffer sources playing a decoded recording (synth noise buffers are 2 s of white noise, not decoded). */
const recordings = (ctx: FakeAudioContext, from = 0) => bufferSources(ctx, from).filter((s) => (s.buffer as { length?: number } | null)?.length !== ctx.sampleRate * 2);
const oscillators = (ctx: FakeAudioContext, from = 0) => ctx.created.slice(from).filter((n) => n.kind === "oscillator").length;

describe("sample variants", () => {
  it("picks among the variants without repeating the last one", () => {
    const rnd = mulberry32(7);
    let last = -1;
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const v = pickVariant(4, rnd, last);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(4);
      expect(v).not.toBe(last);
      seen.add(v);
      last = v;
    }
    expect(seen.size).toBe(4);
  });

  it("handles a single variant and an out-of-range last index", () => {
    expect(pickVariant(1, () => 0.99, 0)).toBe(0);
    expect(pickVariant(0, () => 0.5)).toBe(0);
    expect(pickVariant(3, () => 0.999, 7)).toBe(2);
  });

  it("spreads the pitch around 1 within the requested range", () => {
    const rnd = mulberry32(3);
    const rates = Array.from({ length: 300 }, () => pitchRate(0.06, rnd));
    expect(Math.min(...rates)).toBeGreaterThanOrEqual(0.94);
    expect(Math.max(...rates)).toBeLessThanOrEqual(1.06);
    expect(new Set(rates.map((r) => r.toFixed(3))).size).toBeGreaterThan(50);
    expect(pitchRate(0, rnd)).toBe(1);
    expect(pitchRate(5, () => 1)).toBe(1.5);
  });

  it("lists every manifest URL once", () => {
    const urls = manifestUrls({ ...MANIFEST, cues: { ...MANIFEST.cues, kill: { urls: ["shot-a.ogg"] } } });
    expect(urls.filter((u) => u === "shot-a.ogg")).toHaveLength(1);
    expect(urls).toContain("rain.ogg");
    expect(urls).toContain("step-3.ogg");
    expect(manifestUrls({})).toEqual([]);
  });
});

describe("SampleBank", () => {
  it("fetches and decodes each URL once, however often it is requested", async () => {
    const ctx = new FakeAudioContext();
    const srv = server({ "a.ogg": 10 });
    const bank = new SampleBank(srv.fetchBytes);
    bank.load(ctx.asContext(), ["a.ogg", "a.ogg"]);
    bank.load(ctx.asContext(), ["a.ogg"]);
    expect(bank.status("a.ogg")).toBe("pending");
    expect(bank.get("a.ogg")).toBeNull();
    await bank.settled();
    expect(srv.requests).toEqual(["a.ogg"]);
    expect(ctx.decodeCalls).toBe(1);
    expect(bank.status("a.ogg")).toBe("ready");
    expect(bank.get("a.ogg")?.length).toBe(10);
    bank.load(ctx.asContext(), ["a.ogg"]);
    await bank.settled();
    expect(srv.requests).toHaveLength(1);
  });

  it("marks missing and undecodable files as failed without throwing", async () => {
    const ctx = new FakeAudioContext();
    const srv = server({ "bad.ogg": 4 });
    ctx.undecodable.add(srv.bytes.get("bad.ogg")!);
    const bank = new SampleBank(srv.fetchBytes);
    bank.load(ctx.asContext(), ["gone.ogg", "bad.ogg"]);
    await bank.settled();
    expect(bank.status("gone.ogg")).toBe("failed");
    expect(bank.status("bad.ogg")).toBe("failed");
    expect(bank.get("bad.ogg")).toBeNull();
    expect(bank.status("never.ogg")).toBeUndefined();
  });

  it("supports the callback-only decodeAudioData of old Safari", async () => {
    const buffer = { length: 3 } as unknown as AudioBuffer;
    const ctx = { decodeAudioData: (_b: ArrayBuffer, ok: (b: AudioBuffer) => void) => void ok(buffer) } as unknown as BaseAudioContext;
    const bank = new SampleBank(() => Promise.resolve(new ArrayBuffer(3)));
    bank.load(ctx, ["x.ogg"]);
    await bank.settled();
    expect(bank.get("x.ogg")).toBe(buffer);
  });

  it("uses only ready variants while others are loading or failed", async () => {
    const ctx = new FakeAudioContext();
    const srv = server({ "a.ogg": 5 });
    const bank = new SampleBank(srv.fetchBytes);
    const picker = new VariantPicker(bank, mulberry32(1));
    const set = { urls: ["a.ogg", "b.ogg"] };
    expect(picker.pick(set)).toBeNull();
    bank.load(ctx.asContext(), set.urls);
    await bank.settled();
    for (let i = 0; i < 5; i++) expect(picker.pick(set)?.index).toBe(0);
    expect(picker.pick(undefined)).toBeNull();
    expect(picker.pick({ urls: [] })).toBeNull();
  });
});

describe("SynthAudio with recordings", () => {
  it("downloads nothing before unlock and everything lazily after it", async () => {
    const { srv, audio } = await setup();
    audio.play("shot");
    expect(srv.requests).toHaveLength(0);
    audio.unlock();
    audio.unlock();
    await audio.sampleBank.settled();
    expect(new Set(srv.requests).size).toBe(srv.requests.length);
    expect(srv.requests).toEqual(expect.arrayContaining(["shot-a.ogg", "rain.ogg", "missing.ogg"]));
  });

  it("synthesizes a cue while its recording is still loading", () => {
    const ctx = new FakeAudioContext();
    const audio = new SynthAudio({ createContext: () => ctx.asContext(), autoStart: false, samples: MANIFEST, fetchBytes: () => new Promise<ArrayBuffer>(() => undefined) });
    audio.unlock();
    const before = ctx.created.length;
    audio.play("shot");
    expect(oscillators(ctx, before)).toBe(CUES.shot.voices.filter((v) => v.type !== "noise").length);
    expect(recordings(ctx, before)).toHaveLength(0);
  });

  it("plays a decoded variant on the SFX bus with a pitch spread and the alley send", async () => {
    const { ctx, audio } = await setup();
    audio.unlock();
    await audio.sampleBank.settled();
    const rates = new Set<number>();
    const buffers = new Set<unknown>();
    for (let i = 0; i < 12; i++) {
      ctx.currentTime += 0.2;
      const before = ctx.created.length;
      audio.play("shot");
      expect(oscillators(ctx, before)).toBe(0);
      const [src] = recordings(ctx, before);
      expect(src).toBeDefined();
      rates.add(src!.params.playbackRate!.value);
      buffers.add(src!.buffer);
      // source → envelope → bus, plus a send into the reverb.
      const env = src!.outputs[0]!;
      expect(env.kind).toBe("gain");
      expect(env.outputs.length).toBe(2);
    }
    expect(buffers.size).toBe(2);
    expect(rates.size).toBeGreaterThan(5);
    for (const r of rates) expect(Math.abs(r - 1)).toBeLessThanOrEqual(0.05);
  });

  it("layers the synth under a recording when asked", async () => {
    const { ctx, audio } = await setup();
    audio.unlock();
    await audio.sampleBank.settled();
    const before = ctx.created.length;
    audio.play("critical");
    expect(recordings(ctx, before)).toHaveLength(1);
    expect(oscillators(ctx, before)).toBe(CUES.critical.voices.length);
  });

  it("falls back to the synth for a missing or undecodable file", async () => {
    const { ctx, audio } = await setup();
    audio.unlock();
    await audio.sampleBank.settled();
    for (const cue of ["hit", "denied", "kill"] as const) {
      ctx.currentTime += 0.1;
      const before = ctx.created.length;
      audio.play(cue);
      expect(recordings(ctx, before)).toHaveLength(0);
      expect(oscillators(ctx, before)).toBe(CUES[cue].voices.filter((v) => v.type !== "noise").length);
    }
  });

  it("plays recorded footsteps with varying variants while walking", async () => {
    const { ctx, audio } = await setup();
    audio.unlock();
    await audio.sampleBank.settled();
    audio.setListener({ position: { x: 0, y: 1.6, z: 0 }, yaw: 0, speed: 6 });
    const before = ctx.created.length;
    for (let i = 0; i < 60; i++) {
      ctx.currentTime += 0.05;
      audio.tick();
    }
    const steps = recordings(ctx, before).filter((s) => !s.loop);
    expect(steps.length).toBeGreaterThan(4);
    const lengths = steps.map((s) => (s.buffer as { length: number }).length);
    for (let i = 1; i < lengths.length; i++) expect(lengths[i]).not.toBe(lengths[i - 1]);
  });

  it("loops the recorded rain on the ambience and turns the synthesized rain down", async () => {
    const { ctx, audio } = await setup();
    audio.unlock();
    expect(audio.recordedRain).toBe(false);
    await audio.sampleBank.settled();
    ctx.currentTime += 0.05;
    audio.tick();
    expect(audio.recordedRain).toBe(true);
    const loops = recordings(ctx).filter((s) => s.loop);
    expect(loops).toHaveLength(1);
    expect(loops[0]!.started).not.toBeNull();
    const level = loops[0]!.outputs[0]!;
    expect(level.params.gain!.target).toBe(0.8);
    // A second tick does not start another loop.
    audio.tick();
    expect(recordings(ctx).filter((s) => s.loop)).toHaveLength(1);
    // stopAll stops it; a new soundscape starts the loop again from the cache.
    audio.stopAll();
    expect(audio.recordedRain).toBe(false);
    audio.startAmbience();
    expect(audio.recordedRain).toBe(true);
    expect(ctx.decodeCalls).toBe(manifestUrls(MANIFEST).length - 1);
  });

  it("keeps the synthesized rain at full level when the loop cannot be loaded", async () => {
    const { ctx, audio } = await setup({ rain: { url: "nope.ogg" } }, {});
    audio.unlock();
    await audio.sampleBank.settled();
    ctx.currentTime += 0.05;
    audio.tick();
    expect(audio.recordedRain).toBe(false);
    expect(audio.sampleBank.status("nope.ogg")).toBe("failed");
    expect(recordings(ctx).filter((s) => s.loop)).toHaveLength(0);
  });

  it("without a manifest behaves exactly like the pure synth", async () => {
    const { ctx, srv, audio } = await setup({}, {});
    audio.unlock();
    await audio.sampleBank.settled();
    audio.play("shot");
    expect(srv.requests).toHaveLength(0);
    expect(recordings(ctx)).toHaveLength(0);
  });
});
