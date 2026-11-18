import { describe, expect, it } from "vitest";
import type { AudioListenerPose } from "@seki/core";
import { W3_GATE, W3_LAYOUT, W3_Y } from "@seki/sim";
import { SynthAudio } from "../src/audio/synth-audio";
import { W3_LAYER_LEVEL } from "../src/audio/w3-scape";
import { W3_STREET_LEVEL, type W3Layer, type W3Mix, w3Heard, w3Mix } from "../src/audio/w3-sound-map";
import { FakeAudioContext, type FakeNode, ManualTimer } from "./fixtures/fake-audio-context";

/**
 * W-3's soundscape (ADR-0082 stage 4): what plays in the hall, what outside, and that it falls
 * silent and is torn down once she leaves the sector. The listener's position is her feet, as
 * `main.tsx` sends it.
 */

const at = (x: number, over: number, z: number, yaw = 0): AudioListenerPose => ({ position: { x, y: W3_Y + over, z }, yaw, speed: 0 });

/** In the aisle between the belts, by the line; on the quay by the river; before the wagon gate under the neon. */
const HALL = at(2528, 0, 418);
const QUAY = at(2483, 0, 430);
const GATE = at(W3_GATE.x - 6, 0, 418);
const BASEMENT = at(2530, W3_LAYOUT.BASEMENT_FLOOR, 405);
/** Far off in the city: the old town's streets, the M0 district at the origin. */
const FAR = { position: { x: 0, y: 0, z: 0 }, yaw: 0, speed: 0 };

const LAYERS: readonly W3Layer[] = ["line", "hum", "tubes", "river", "plant", "sign"];
const heard = (m: W3Mix) => Object.fromEntries(LAYERS.map((l) => [l, w3Heard(m, l)])) as Record<W3Layer, number>;

describe("W-3's sound map", () => {
  it("in the hall: the line, the transformers and the strip lights; the river and the neon only through the walls", () => {
    const hall = w3Mix(HALL);
    const quay = w3Mix(QUAY);
    expect(hall.near).toBe(true);
    expect(hall.place).toBe("hall");
    const h = heard(hall);
    expect(h.line).toBeGreaterThan(0.3);
    expect(h.tubes).toBe(1);
    expect(h.hum).toBeGreaterThan(0);
    // The yard reaches the hall dull: a fraction of its level, low-passed by the walls.
    expect(hall.yard.gain).toBeLessThan(0.2);
    expect(hall.yard.cutoff).toBeLessThanOrEqual(500);
    expect(hall.hall.cutoff).toBeGreaterThan(8000);
    expect(h.river).toBeLessThan(heard(quay).river * 0.2);
  });

  it("outside: the river on the quay to her left, the neon by the gate, the plant's drone; the line dull through the walls", () => {
    const quay = w3Mix(QUAY);
    expect(quay.place).toBe("outside");
    const q = heard(quay);
    expect(q.river).toBeGreaterThan(0.3);
    // Facing north, the Bystrzyca lies west of the quay: on her left.
    expect(quay.layers.river.pan).toBeLessThan(-0.3);
    expect(q.tubes).toBe(0);
    expect(q.line).toBeLessThan(heard(w3Mix(HALL)).line * 0.4);
    expect(quay.hall.cutoff).toBeLessThanOrEqual(500);
    const gate = heard(w3Mix(GATE));
    expect(gate.sign).toBeGreaterThan(0.2);
    expect(gate.sign).toBeGreaterThan(q.sign);
    expect(gate.plant).toBeGreaterThan(0);
  });

  it("in the basement the hall above is dull and the yard almost gone", () => {
    const m = w3Mix(BASEMENT);
    expect(m.place).toBe("basement");
    expect(m.hall.gain).toBeLessThan(1);
    expect(m.hall.cutoff).toBeLessThan(500);
    expect(m.yard.gain).toBeLessThan(m.hall.gain);
  });

  it("far from the sector nothing of it sounds", () => {
    const m = w3Mix(FAR);
    expect(m.near).toBe(false);
    expect(m.place).toBe("outside");
    for (const l of LAYERS) expect(w3Heard(m, l)).toBe(0);
  });

  it("under the hall's roof the street's rain comes through dull, in the open it plays as it is", () => {
    expect(W3_STREET_LEVEL.outside).toBe(1);
    expect(W3_STREET_LEVEL.hall).toBeLessThan(0.5);
    expect(W3_STREET_LEVEL.basement).toBeLessThan(W3_STREET_LEVEL.hall);
  });
});

const setup = (maxVoices = 40) => {
  const ctx = new FakeAudioContext();
  const timer = new ManualTimer();
  const audio = new SynthAudio({ createContext: () => ctx.asContext(), setInterval: timer.setInterval, clearInterval: timer.clearInterval, maxVoices });
  audio.unlock();
  return { ctx, audio };
};

const run = (ctx: FakeAudioContext, audio: SynthAudio, seconds: number, dt = 0.05) => {
  for (let t = 0; t < seconds; t += dt) {
    ctx.currentTime += dt;
    audio.tick();
  }
};

/** The sources made since `from`: with a pool of no voices, the sector's loops alone. */
const loopSources = (ctx: FakeAudioContext, from: number) =>
  ctx.created.slice(from).filter((n): n is FakeNode & { stopped: number | null } => (n.kind === "oscillator" || n.kind === "buffer-source") && "stopped" in n);

describe("W-3's soundscape in the synth", () => {
  it("is not built far from the sector, is built near it and follows her from the hall out to the quay", () => {
    // No one-shots (a pool of none): only the loops make nodes.
    const { ctx, audio } = setup(0);
    audio.setListener(FAR);
    run(ctx, audio, 0.5);
    expect(audio.sector.active).toBe(false);
    const before = ctx.created.length;
    audio.setListener(HALL);
    run(ctx, audio, 0.5);
    expect(audio.sector.active).toBe(true);
    expect(audio.sector.mix.place).toBe("hall");
    expect(audio.sector.street).toBe(W3_STREET_LEVEL.hall);
    const loops = loopSources(ctx, before);
    expect(loops.length).toBeGreaterThan(10);
    expect(loops.length).toBeLessThanOrEqual(16);
    // The line's strip heads to its level in the hall.
    const target = (w3Heard(audio.sector.mix, "line") / audio.sector.mix.hall.gain) * W3_LAYER_LEVEL.line;
    expect(ctx.created.some((n) => n.kind === "gain" && Math.abs((n.params.gain?.target ?? -1) - target) < 1e-9)).toBe(true);
    // Moving within the sector makes no nodes: only levels change.
    const n = ctx.created.length;
    audio.setListener(QUAY);
    run(ctx, audio, 0.5);
    expect(ctx.created.length).toBe(n);
    expect(audio.sector.mix.place).toBe("outside");
    expect(audio.sector.street).toBe(1);
  });

  it("falls silent and is torn down when she leaves W-3 (the metro), and comes back with her", () => {
    const { ctx, audio } = setup(0);
    audio.setListener(QUAY);
    const before = ctx.created.length;
    run(ctx, audio, 0.5);
    const loops = loopSources(ctx, before);
    expect(loops.length).toBeGreaterThan(0);
    audio.setListener(FAR);
    run(ctx, audio, 0.5);
    expect(audio.sector.active).toBe(false);
    for (const s of loops) expect(s.stopped).not.toBeNull();
    for (const l of LAYERS) expect(w3Heard(audio.sector.mix, l)).toBe(0);
    audio.setListener(GATE);
    run(ctx, audio, 0.2);
    expect(audio.sector.active).toBe(true);
    // stopAll tears it down with the rest of the soundscape.
    audio.stopAll();
    expect(audio.sector.active).toBe(false);
  });

  it("sets off the arms' servos in the hall, none on the quay", () => {
    const oneShots = (pose: AudioListenerPose) => {
      const { ctx, audio } = setup(500);
      audio.setListener(pose);
      run(ctx, audio, 6);
      // The servos are gliding sawtooths; the score plays the same in both places.
      return ctx.created.filter((x) => x.kind === "oscillator" && (x as unknown as { type: string }).type === "sawtooth" && (x.params.frequency?.events ?? []).some((e) => e[0] === "exp")).length;
    };
    expect(oneShots(HALL)).toBeGreaterThan(oneShots(QUAY) + 2);
  });
});
