import type { AudioListenerPose } from "@seki/core";
import { describe, expect, it } from "vitest";
import { VENUE_STATIONS, radioMix, radioSpeakers, speakerMix } from "../src/audio/radio-speakers";
import { RADIO_STATIONS, RADIO_STATION_IDS, STEPS_PER_BAR, buildStationLoop, chordOn, degreeToMidi } from "../src/audio/radio-stations";
import { SynthAudio } from "../src/audio/synth-audio";
import { FakeAudioContext, ManualTimer } from "./fake-audio-context";

const pose = (x: number, z: number): AudioListenerPose => ({ position: { x, y: 1.6, z }, yaw: 0, speed: 0 });

/** Every note of a loop, with its step. */
const notes = (id: keyof typeof RADIO_STATIONS) => {
  const loop = buildStationLoop(RADIO_STATIONS[id]);
  return Array.from({ length: loop.length }, (_, step) => loop.at(step).map((n) => ({ ...n, step }))).flat();
};

describe("radio stations (ADR-0036)", () => {
  it("are three different parameter sets of the sequencer: tempo, scale, timbre and drums", () => {
    expect(RADIO_STATION_IDS).toEqual(["synthwave", "citypop", "news"]);
    const all = RADIO_STATION_IDS.map((id) => RADIO_STATIONS[id]);
    expect(new Set(all.map((s) => s.bpm)).size).toBe(3);
    expect(new Set(all.map((s) => `${s.root}:${s.scale.join()}`)).size).toBe(3);
    expect(new Set(all.map((s) => s.timbre.keys.type)).size).toBe(3);
    expect(new Set(all.map((s) => s.drums?.kick)).size).toBe(3);
    // Synthwave in minor (a flat third), city pop with major sevenths.
    expect(RADIO_STATIONS.synthwave.scale[2]).toBe(3);
    expect(RADIO_STATIONS.citypop.sevenths).toBe(true);
    expect(chordOn(RADIO_STATIONS.citypop, 3)).toHaveLength(4);
  });

  it("keep every pitched note inside the station's scale", () => {
    for (const id of RADIO_STATION_IDS) {
      const p = RADIO_STATIONS[id];
      const pcs = new Set(p.scale.map((s) => (p.root + s) % 12));
      for (const n of notes(id)) if (n.layer !== "drums" && n.layer !== "voice") expect(pcs.has(n.midi % 12), `${id} ${n.layer} ${n.midi}`).toBe(true);
    }
  });

  it("loop over one bar per chord, with the tempo in the step length", () => {
    const loop = buildStationLoop(RADIO_STATIONS.citypop);
    expect(loop.length).toBe(RADIO_STATIONS.citypop.progression.length * STEPS_PER_BAR);
    expect(loop.stepSeconds).toBeCloseTo(60 / 112 / 4);
    expect(loop.at(loop.length)).toBe(loop.at(0));
    expect(degreeToMidi(RADIO_STATIONS.news, 7)).toBe(RADIO_STATIONS.news.root + 12);
  });

  it("swing city pop's off-beats; synthwave plays straight with a gated snare", () => {
    const pop = notes("citypop");
    expect(pop.filter((n) => n.step % 2 === 1).every((n) => n.delay > 0)).toBe(true);
    expect(pop.filter((n) => n.step % 2 === 0).every((n) => n.delay === 0)).toBe(true);
    const synth = notes("synthwave");
    expect(synth.every((n) => n.delay === 0)).toBe(true);
    expect(synth.some((n) => n.drum === "snare")).toBe(true);
    expect(pop.some((n) => n.drum === "clap")).toBe(true);
  });

  it("put a reader on the news, over a bed without a kick, with a pause every fourth bar", () => {
    const news = notes("news");
    const voice = news.filter((n) => n.layer === "voice");
    expect(voice.length).toBeGreaterThan(20);
    expect(news.some((n) => n.drum === "kick")).toBe(false);
    expect(voice.every((n) => Math.floor(n.step / STEPS_PER_BAR) !== 3)).toBe(true);
    expect(notes("citypop").some((n) => n.layer === "voice")).toBe(false);
  });
});

describe("diegetic speakers", () => {
  const speakers = radioSpeakers();

  it("sit at the bars, the karaoke and shops, found by the label of their neon", () => {
    const labels = new Set(speakers.map((s) => s.label));
    expect(labels.has("KARAOKE")).toBe(true);
    expect(labels.has("SAKE")).toBe(true);
    expect(labels.has("NEON KOI")).toBe(true);
    for (const s of speakers) expect(s.station).toBe(VENUE_STATIONS[s.label]);
  });

  it("play the loudest venue's station, panned towards it, and fall silent away from it", () => {
    const karaoke = speakers.find((s) => s.label === "KARAOKE")!;
    const near = speakerMix(pose(karaoke.position.x - 3, karaoke.position.z), speakers);
    expect(near?.station).toBe("citypop");
    expect(near!.gain).toBeGreaterThan(0.3);
    // The speaker is to the east (+x), i.e. on the right of a listener facing +z.
    expect(near!.pan).toBeGreaterThan(0);
    expect(speakerMix(pose(0, -300), speakers)).toBeNull();
  });

  it("lower the score near a speaker; her own station replaces it until a fight", () => {
    expect(radioMix("explore", null, 0)).toEqual({ score: 1, radio: 0 });
    const bar = radioMix("explore", null, 1);
    expect(bar.radio).toBe(1);
    expect(bar.score).toBeLessThan(0.5);
    expect(radioMix("explore", "news", 0)).toEqual({ score: 0, radio: 1 });
    expect(radioMix("combat", "news", 0)).toEqual({ score: 1, radio: 0.3 });
    expect(radioMix("overdrive", null, 1).score).toBeGreaterThan(0.7);
  });
});

describe("SynthAudio radio", () => {
  const setup = () => {
    const ctx = new FakeAudioContext();
    const timer = new ManualTimer();
    const audio = new SynthAudio({ createContext: () => ctx.asContext(), setInterval: timer.setInterval, clearInterval: timer.clearInterval, maxVoices: 5000 });
    return { ctx, audio };
  };
  const run = (ctx: FakeAudioContext, audio: SynthAudio, seconds: number) => {
    for (let t = 0; t < seconds; t += 0.05) {
      ctx.currentTime += 0.05;
      audio.tick();
    }
  };

  it("plays the chosen station instead of the score, and turns off again", () => {
    const { ctx, audio } = setup();
    audio.setListener(pose(0, -300));
    audio.unlock();
    run(ctx, audio, 1);
    expect(audio.radioAudible).toBeNull();
    expect(audio.scoreLevel).toBe(1);
    audio.setRadioStation("citypop");
    run(ctx, audio, 1);
    expect(audio.radioStation).toBe("citypop");
    expect(audio.radioAudible).toBe("citypop");
    expect(audio.scoreLevel).toBe(0);
    audio.play("shot");
    run(ctx, audio, 0.2);
    expect(audio.scoreLevel).toBe(1);
    audio.setRadioStation(null);
    expect(audio.radioStation).toBeNull();
  });

  it("plays a bar's station from its speaker when the player's radio is off", () => {
    const { ctx, audio } = setup();
    const karaoke = radioSpeakers().find((s) => s.label === "KARAOKE")!;
    audio.unlock();
    audio.setListener(pose(karaoke.position.x, karaoke.position.z - 2));
    run(ctx, audio, 1);
    expect(audio.radioAudible).toBe("citypop");
    expect(audio.scoreLevel).toBeLessThan(1);
    audio.setListener(pose(0, -300));
    run(ctx, audio, 1);
    expect(audio.radioAudible).toBeNull();
  });

  it("stays silent before the soundscape starts", () => {
    const ctx = new FakeAudioContext();
    const audio = new SynthAudio({ createContext: () => ctx.asContext(), autoStart: false, setInterval: () => 0, clearInterval: () => undefined });
    audio.unlock();
    audio.setRadioStation("synthwave");
    run(ctx, audio, 1);
    expect(audio.radioAudible).toBeNull();
  });
});
