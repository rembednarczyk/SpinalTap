import { describe, expect, it } from "vitest";
import { SPEECH_DUCK_ATTACK, SPEECH_DUCK_DB, SPEECH_DUCK_HOLD, SPEECH_DUCK_RELEASE, SpeechDucker, dbToGain } from "../src/audio/ducking";
import { DUCK_LEVEL, MixState } from "../src/audio/mixer";
import { SynthAudio } from "../src/audio/synth-audio";
import { FakeAudioContext, type FakeNode, ManualTimer } from "./fake-audio-context";

const DUCKED = dbToGain(SPEECH_DUCK_DB);

describe("SpeechDucker", () => {
  it("falls to the duck in the attack, holds it through the line and rises in the release", () => {
    const d = new SpeechDucker();
    expect(d.update(0)).toBe(1);
    d.speak(0, 2);
    expect(d.update(SPEECH_DUCK_ATTACK / 2)).toBeCloseTo(dbToGain(SPEECH_DUCK_DB / 2));
    expect(d.update(SPEECH_DUCK_ATTACK)).toBeCloseTo(DUCKED);
    expect(d.moving(1)).toBe(false);
    expect(d.update(2 + SPEECH_DUCK_HOLD - 0.01)).toBeCloseTo(DUCKED);
    const end = 2 + SPEECH_DUCK_HOLD;
    expect(d.update(end + SPEECH_DUCK_RELEASE / 2)).toBeCloseTo(dbToGain(SPEECH_DUCK_DB / 2));
    expect(d.moving(end + SPEECH_DUCK_RELEASE / 2)).toBe(true);
    expect(d.update(end + SPEECH_DUCK_RELEASE)).toBe(1);
    expect(d.update(end + 10)).toBe(1);
  });

  it("extends the duck over overlapping lines and releases at once when cut", () => {
    const d = new SpeechDucker();
    d.speak(0, 1);
    d.speak(0.5, 3);
    expect(d.speaking(2)).toBe(true);
    d.update(2);
    d.stop(2);
    expect(d.speaking(2)).toBe(false);
    expect(d.update(2 + SPEECH_DUCK_RELEASE)).toBe(1);
  });

  it("treats a clock going back as no time passing", () => {
    const d = new SpeechDucker();
    d.speak(1, 2);
    const f = d.update(1.1);
    expect(d.update(0.5)).toBe(f);
  });
});

describe("MixState speech duck", () => {
  it("ducks music and radio, not effects or dialogue, and takes the deeper of the two ducks", () => {
    const m = new MixState();
    m.set("music", 0.5);
    m.set("radio", 0.4);
    m.setSpeechDuck(DUCKED);
    expect(m.gain("music")).toBeCloseTo(0.5 * DUCKED);
    expect(m.gain("radio")).toBeCloseTo(0.4 * DUCKED);
    expect(m.gain("sfx")).toBe(m.get("sfx"));
    expect(m.gain("dialogue")).toBe(m.get("dialogue"));
    // An open conversation already holds the score lower than a line would.
    m.setDucked(true);
    expect(m.gain("music")).toBeCloseTo(0.5 * Math.min(DUCK_LEVEL, DUCKED));
    expect(m.gain("radio")).toBeCloseTo(0.4 * Math.min(DUCK_LEVEL, DUCKED));
  });
});

/** Fake "server" of voice files: key → seconds of audio at the fake context's 8 kHz. */
const setup = (files: Record<string, number>, voiced = true) => {
  const voiceUrl = voiced ? (k: string) => `voice/en/${k}.ogg` : undefined;
  const ctx = new FakeAudioContext();
  const timer = new ManualTimer();
  const requests: string[] = [];
  const fetchBytes = (url: string) => {
    requests.push(url);
    const s = files[url];
    return s === undefined ? Promise.reject(new Error(`404 ${url}`)) : Promise.resolve(new ArrayBuffer(Math.round(s * ctx.sampleRate)));
  };
  const audio = new SynthAudio({ createContext: () => ctx.asContext(), setInterval: timer.setInterval, clearInterval: timer.clearInterval, fetchBytes, voiceUrl });
  return { ctx, audio, requests };
};

const gain = (n: FakeNode) => n.params.gain!;
const masterOf = (ctx: FakeAudioContext) => ctx.created.filter((n) => n.kind === "gain" && n.outputs.includes(ctx.created.find((c) => c.kind === "compressor")!))[0]!;
/** Bus gains in creation order: music, sfx, ambience, dialogue, radio. */
const buses = (ctx: FakeAudioContext) => {
  const [music, sfx, ambience, dialogue, radio] = ctx.created.filter((n) => n.kind === "gain").slice(1, 6);
  return { music: music!, sfx: sfx!, ambience: ambience!, dialogue: dialogue!, radio: radio! };
};
const run = (ctx: FakeAudioContext, audio: SynthAudio, seconds: number) => {
  for (let t = 0; t < seconds - 1e-9; t += 0.05) {
    ctx.currentTime += 0.05;
    audio.tick();
  }
};

describe("SynthAudio dialogue and radio buses", () => {
  it("routes dialogue to the master and the radio through the score's filter, each with its own volume", () => {
    const { ctx, audio } = setup({});
    audio.setVolume("dialogue", 0.6);
    audio.unlock();
    const b = buses(ctx);
    expect(b.dialogue.outputs).toEqual([masterOf(ctx)]);
    expect(b.radio.outputs[0]?.kind).toBe("biquad");
    expect(b.music.outputs[0]).toBe(b.radio.outputs[0]);
    expect(gain(b.dialogue).value).toBe(0.6);
    audio.setVolume("radio", 0.2);
    expect(audio.getVolume("radio")).toBe(0.2);
    expect(gain(b.radio).target).toBe(0.2);
    // The player's radio plays into the radio bus, not the music bus.
    audio.setRadioStation("drift");
    run(ctx, audio, 1);
    expect(ctx.created.some((n) => n.outputs.includes(b.radio) && n.kind === "biquad")).toBe(true);
  });

  it("plays a line by key on the dialogue bus, ducks music and radio under it and restores them after", async () => {
    const { ctx, audio, requests } = setup({ "voice/en/kaito/greet.ogg": 1.5 });
    audio.unlock();
    const b = buses(ctx);
    const music = audio.getVolume("music");
    expect(await audio.playLine("kaito/greet")).toBe(true);
    expect(requests).toEqual(["voice/en/kaito/greet.ogg"]);
    expect(audio.lineSpeaking).toBe("kaito/greet");
    const src = ctx.sources().at(-1)!;
    expect(src.outputs).toEqual([b.dialogue]);
    run(ctx, audio, SPEECH_DUCK_ATTACK + 0.05);
    expect(audio.speechDuck).toBeCloseTo(DUCKED);
    expect(gain(b.music).target).toBeCloseTo(music * DUCKED);
    expect(gain(b.radio).target).toBeCloseTo(audio.getVolume("radio") * DUCKED);
    expect(gain(b.sfx).target ?? gain(b.sfx).value).toBe(audio.getVolume("sfx"));
    run(ctx, audio, 1.5 + SPEECH_DUCK_HOLD + SPEECH_DUCK_RELEASE);
    expect(audio.speechDuck).toBe(1);
    expect(gain(b.music).target).toBeCloseTo(music);
  });

  it("stays silent and does not throw for a key without a recording, and asks only once", async () => {
    const { ctx, audio, requests } = setup({});
    audio.unlock();
    const sources = ctx.sources().length;
    await expect(audio.playLine("nobody/nothing")).resolves.toBe(false);
    await expect(audio.playLine("nobody/nothing")).resolves.toBe(false);
    expect(requests).toEqual(["voice/en/nobody/nothing.ogg"]);
    expect(ctx.sources().length).toBe(sources);
    expect(audio.lineSpeaking).toBeNull();
    run(ctx, audio, 0.5);
    expect(audio.speechDuck).toBe(1);
  });

  it("stays silent without a voice URL or before the first gesture", async () => {
    const before = setup({ "voice/en/a.ogg": 1 });
    await expect(before.audio.playLine("a")).resolves.toBe(false);
    expect(() => before.audio.stopLine()).not.toThrow();
    const none = setup({ "voice/en/a.ogg": 1 }, false);
    none.audio.unlock();
    await expect(none.audio.playLine("a")).resolves.toBe(false);
    expect(none.requests).toEqual([]);
  });

  it("cuts the line on stopLine and lets a newer line replace an older one", async () => {
    const { ctx, audio } = setup({ "voice/en/a.ogg": 3, "voice/en/b.ogg": 3 });
    audio.unlock();
    await audio.playLine("a");
    const a = ctx.sources().at(-1)!;
    await audio.playLine("b");
    expect(a.stopped).not.toBeNull();
    expect(audio.lineSpeaking).toBe("b");
    run(ctx, audio, 0.5);
    audio.stopLine();
    expect(audio.lineSpeaking).toBeNull();
    run(ctx, audio, SPEECH_DUCK_RELEASE + 0.05);
    expect(audio.speechDuck).toBe(1);
  });

  it("drops a line that finishes loading after it was stopped", async () => {
    const { audio } = setup({ "voice/en/a.ogg": 1 });
    audio.unlock();
    const p = audio.playLine("a");
    audio.stopLine();
    await expect(p).resolves.toBe(false);
    expect(audio.lineSpeaking).toBeNull();
  });
});
