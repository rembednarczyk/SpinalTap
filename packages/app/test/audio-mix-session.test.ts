import { describe, expect, it } from "vitest";
import type { AudioBus, AudioScenePort, MusicMood } from "@seki/core";
import { DUCK_LEVEL, SPEECH_DUCK_ATTACK, SPEECH_DUCK_DB, SPEECH_DUCK_HOLD, SPEECH_DUCK_RELEASE, SynthAudio, dbToGain } from "@seki/engine";
import { DEFAULT_SETTINGS } from "@seki/ui";
import { FakeAudioContext, ManualTimer } from "../../engine/test/fake-audio-context";
import { bindAudioMix } from "../src/controllers/audio-mix";
import { finishDialogue, setup, talkToKaito } from "./story-helpers";

/** The scene port's calls, in order. */
class FakeScene implements AudioScenePort {
  readonly volumes: [AudioBus, number][] = [];
  readonly moods: MusicMood[] = [];
  stops = 0;
  setMood(mood: MusicMood) {
    this.moods.push(mood);
  }
  setListener() {}
  setVolume(bus: AudioBus, value: number) {
    this.volumes.push([bus, value]);
  }
  getVolume() {
    return 0;
  }
  stopLine() {
    this.stops++;
  }
}

/** The real adapter on a fake WebAudio context, with voice files from a fake server (key → seconds). */
const synth = (files: Record<string, number>) => {
  const ctx = new FakeAudioContext();
  const timer = new ManualTimer();
  const fetchBytes = (url: string) => {
    const s = files[url];
    return s === undefined ? Promise.reject(new Error(`404 ${url}`)) : Promise.resolve(new ArrayBuffer(Math.round(s * ctx.sampleRate)));
  };
  const audio = new SynthAudio({ createContext: () => ctx.asContext(), setInterval: timer.setInterval, clearInterval: timer.clearInterval, fetchBytes, voiceUrl: (k) => `voice/en/${k}.ogg` });
  audio.unlock();
  const run = (seconds: number) => {
    for (let t = 0; t < seconds - 1e-9; t += 0.05) {
      ctx.currentTime += 0.05;
      audio.tick();
    }
  };
  return { audio, run };
};

const DUCKED = dbToGain(SPEECH_DUCK_DB);

describe("audio mix in the session (ADR-0060 stage 1)", () => {
  it("sends the dialogue and radio sliders to their buses, and only the changed volumes", () => {
    const { session, ui } = setup();
    const scene = new FakeScene();
    bindAudioMix(ui, scene, ui.getState().settings);
    session.intents.changeSettings({ dialogueVolume: 0.4 });
    expect(ui.getState().settings.dialogueVolume).toBe(0.4);
    expect(scene.volumes).toContainEqual(["dialogue", 0.4]);
    scene.volumes.length = 0;
    session.intents.changeSettings({ radioVolume: 0.2 });
    expect(scene.volumes).toContainEqual(["radio", 0.2]);
    expect(scene.volumes).toContainEqual(["dialogue", 0.4]);
    scene.volumes.length = 0;
    // Nothing of the mix changed: nothing is sent.
    session.intents.changeSettings({ hints: false });
    expect(scene.volumes).toEqual([]);
  });

  it("ducks for a conversation and cuts the line still spoken when it closes", () => {
    const { session, ui } = setup();
    const scene = new FakeScene();
    bindAudioMix(ui, scene, ui.getState().settings);
    session.newGame();
    talkToKaito(session);
    expect(ui.getState().dialogue).not.toBeNull();
    expect(scene.moods).toEqual(["dialog"]);
    expect(scene.stops).toBe(0);
    finishDialogue(session, ui);
    expect(ui.getState().dialogue).toBeNull();
    expect(scene.moods).toEqual(["dialog", "explore"]);
    expect(scene.stops).toBe(1);
  });

  it("changes the real dialogue bus with the slider", () => {
    const { session, ui } = setup();
    const { audio } = synth({});
    bindAudioMix(ui, audio, DEFAULT_SETTINGS);
    expect(audio.getVolume("dialogue")).toBe(1);
    session.intents.changeSettings({ dialogueVolume: 0.35, radioVolume: 0.15 });
    expect(audio.getVolume("dialogue")).toBe(0.35);
    expect(audio.getVolume("radio")).toBe(0.15);
  });

  it("ducks music and radio while a line is spoken and brings them back after it", async () => {
    const { audio, run } = synth({ "voice/en/kaito/greet.ogg": 1.2 });
    expect(audio.speechDuck).toBe(1);
    expect(await audio.playLine("kaito/greet")).toBe(true);
    run(SPEECH_DUCK_ATTACK + 0.05);
    expect(audio.lineSpeaking).toBe("kaito/greet");
    expect(audio.speechDuck).toBeCloseTo(DUCKED);
    run(1.2 + SPEECH_DUCK_HOLD);
    expect(audio.speechDuck).toBeLessThan(1);
    run(SPEECH_DUCK_RELEASE);
    expect(audio.speechDuck).toBe(1);
  });

  it("closing the conversation cuts the line and lifts the duck; the open conversation holds the score lower", async () => {
    const { session, ui } = setup();
    const { audio, run } = synth({ "voice/en/kaito/greet.ogg": 10 });
    bindAudioMix(ui, audio, DEFAULT_SETTINGS);
    session.newGame();
    talkToKaito(session);
    expect(await audio.playLine("kaito/greet")).toBe(true);
    run(SPEECH_DUCK_ATTACK + 0.05);
    expect(Math.min(DUCK_LEVEL, audio.speechDuck)).toBe(DUCK_LEVEL);
    finishDialogue(session, ui);
    expect(audio.lineSpeaking).toBeNull();
    run(SPEECH_DUCK_RELEASE + 0.05);
    expect(audio.speechDuck).toBe(1);
  });

  it("a key without a recording does not throw and leaves the mix alone", async () => {
    const { audio, run } = synth({});
    await expect(audio.playLine("nobody/missing")).resolves.toBe(false);
    run(0.5);
    expect(audio.lineSpeaking).toBeNull();
    expect(audio.speechDuck).toBe(1);
  });
});
