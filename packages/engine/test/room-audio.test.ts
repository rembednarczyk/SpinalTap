import { describe, expect, it } from "vitest";
import { type AudioListenerPose, ROOM_DETAIL_SHAPES } from "@seki/core";
import { INTERIORS, T1_CART, T1_EXTRACT, interiorAt } from "@seki/sim";
import { ROOM_SOUNDS, ROOM_SOUND_NEAR, THROUGH_WALL, roomEmitters, roomMix } from "../src/audio/room-sound-map";
import { SynthAudio } from "../src/audio/synth-audio";
import { FakeAudioContext, type FakeNode, ManualTimer } from "./fixtures/fake-audio-context";

/*
 * The rooms' sound from its source (`docs/zasady-lokacji.md` §17, ADR-0099 stage 6): every placed thing with a sound is
 * an emitter in its room, heard whole there and dull through the walls, and the loops exist only near one.
 */

const EMITTERS = roomEmitters();
const pose = (x: number, y: number, z: number): AudioListenerPose => ({ position: { x, y, z }, yaw: 0, speed: 0 });
const aquarium = EMITTERS.find((e) => e.sound === "pump" && e.room === "neon-koi");
/** Neon Koi's floor: the listener's position is her feet. */
const KOI = INTERIORS.find((i) => i.id === "neon-koi")!.rooms[0]!;
/** Two metres from the aquarium towards the room's middle, on its floor. */
const byAquarium = (): AudioListenerPose => {
  const a = aquarium!.position;
  const cx = (KOI.minX + KOI.maxX) / 2 - a.x;
  const cz = (KOI.minZ + KOI.maxZ) / 2 - a.z;
  const d = Math.hypot(cx, cz);
  return pose(a.x + (2 * cx) / d, KOI.bottom, a.z + (2 * cz) / d);
};

describe("the rooms' sound map", () => {
  it("finds an emitter of every sound, each in the room it stands in", () => {
    for (const s of ROOM_SOUNDS) expect(EMITTERS.some((e) => e.sound === s), s).toBe(true);
    expect(aquarium).toBeDefined();
    expect(EMITTERS.some((e) => e.sound === "tubes" && e.room === "tessen-office")).toBe(true);
    expect(EMITTERS.find((e) => e.sound === "vent")?.room).toMatch(/^metro-/);
    expect(ROOM_DETAIL_SHAPES.filter((s) => s.sound).length).toBeGreaterThanOrEqual(10);
    // Every one of them in a room, the wall-hung ones too (the basement's panel, the hall's leak), but those in the open
    // air (ADR-0102 point 5): the car wash's pump and its gantry's dryer in its yard; on Neon Koi's back wall the kitchen's
    // extract, the downpipe and the meters' box; on Alchemia's T1 Hana's cool box and the extract of Fumiko's kitchen.
    const near = (e: { position: { x: number; z: number } }, x: number, z: number, r: number) => Math.hypot(e.position.x - x, e.position.z - z) < r;
    const outside = EMITTERS.filter((e) => e.room === null);
    expect(outside.map((e) => e.sound).sort()).toEqual(["drip", "hum", "hum", "pump", "vent", "vent", "vent"]);
    for (const e of outside) expect(near(e, 410, -36, 8) || near(e, 313, -110, 3) || near(e, T1_CART.x, T1_CART.z, 1) || near(e, T1_EXTRACT.x, T1_EXTRACT.z, 1), `${e.sound}`).toBe(true);
  });

  it("hears the car wash's pump whole in its yard, the open air being one more room", () => {
    const pump = EMITTERS.find((e) => e.sound === "pump" && e.room === null)!;
    const yard = roomMix(pose(pump.position.x - 2, pump.position.y, pump.position.z + 2.5), EMITTERS);
    expect(yard.room).toBeNull();
    expect(yard.layers.pump.gain).toBeGreaterThan(0.3);
    expect(yard.layers.pump.cutoff).toBeGreaterThan(10000);
    expect(yard.layers.vent.gain).toBeGreaterThan(0);
  });

  it("hears the yard's kitchen extract whole in the yard behind Neon Koi and dull from the bar's back room", () => {
    const fan = EMITTERS.find((e) => e.sound === "vent" && e.room === null && Math.hypot(e.position.x - 313, e.position.z + 110) < 3)!;
    const yard = roomMix(pose(fan.position.x, fan.position.y, fan.position.z - 3), EMITTERS);
    expect(yard.room).toBeNull();
    expect(yard.layers.vent.gain).toBeGreaterThan(0.3);
    expect(yard.layers.vent.cutoff).toBeGreaterThan(10000);
    // In the back room's corridor, a couple of metres off behind the bar's back wall.
    const corridor = INTERIORS.find((i) => i.id === "neon-koi")!.rooms[1]!;
    const inside = roomMix(pose((corridor.minX + corridor.maxX) / 2, corridor.bottom, corridor.minZ + 1), EMITTERS);
    expect(inside.room).toBe("neon-koi");
    expect(inside.layers.vent.cutoff).toBe(THROUGH_WALL.cutoff);
    expect(inside.layers.vent.gain).toBeLessThan(yard.layers.vent.gain / 2);
  });

  it("hears the aquarium's pump whole in Neon Koi and dull and quieter through its wall", () => {
    const a = aquarium!.position;
    const inside = roomMix(byAquarium(), EMITTERS);
    expect(inside.room).toBe("neon-koi");
    expect(inside.layers.pump.gain).toBeGreaterThan(0.3);
    expect(inside.layers.pump.cutoff).toBeGreaterThan(10000);
    // Out of the room the same few metres off, through its wall.
    const koi = KOI;
    const out = [pose(koi.minX - 1.5, koi.bottom, a.z), pose(koi.maxX + 1.5, koi.bottom, a.z), pose(a.x, koi.bottom, koi.minZ - 1.5), pose(a.x, koi.bottom, koi.maxZ + 1.5)]
      .map((p) => ({ p, d: Math.hypot(p.position.x - a.x, p.position.z - a.z) }))
      .filter(({ p }) => interiorAt(p.position)?.id !== "neon-koi")
      .sort((x, y) => x.d - y.d)[0]!;
    const through = roomMix(out.p, EMITTERS);
    expect(through.room).not.toBe("neon-koi");
    if (through.layers.pump.gain > 0) {
      expect(through.layers.pump.cutoff).toBe(THROUGH_WALL.cutoff);
      expect(through.layers.pump.gain).toBeLessThanOrEqual(THROUGH_WALL.gain);
    }
    expect(through.layers.pump.gain).toBeLessThan(inside.layers.pump.gain / 2);
  });

  it("is silent far from every room", () => {
    const far = roomMix(pose(0, 0, 0), EMITTERS);
    expect(far.nearest).toBeGreaterThan(ROOM_SOUND_NEAR);
    for (const s of ROOM_SOUNDS) expect(far.layers[s].gain).toBe(0);
  });
});

const setup = () => {
  const ctx = new FakeAudioContext();
  const timer = new ManualTimer();
  // No one-shots (a pool of none): only the loops make nodes.
  const audio = new SynthAudio({ createContext: () => ctx.asContext(), setInterval: timer.setInterval, clearInterval: timer.clearInterval, maxVoices: 0 });
  audio.unlock();
  return { ctx, audio };
};
const run = (ctx: FakeAudioContext, audio: SynthAudio, seconds: number, dt = 0.05) => {
  for (let t = 0; t < seconds; t += dt) {
    ctx.currentTime += dt;
    audio.tick();
  }
};
const sources = (ctx: FakeAudioContext, from: number) =>
  ctx.created.slice(from).filter((n): n is FakeNode & { stopped: number | null } => (n.kind === "oscillator" || n.kind === "buffer-source") && "stopped" in n);

describe("the rooms' soundscape in the synth", () => {
  it("is built by the aquarium in Neon Koi, torn down far off, and gone with stopAll", () => {
    const { ctx, audio } = setup();
    audio.setListener(pose(0, 0, 0));
    run(ctx, audio, 0.5);
    expect(audio.positional.rooms.active).toBe(false);
    const before = ctx.created.length;
    audio.setListener(byAquarium());
    run(ctx, audio, 0.5);
    expect(audio.positional.rooms.active).toBe(true);
    expect(audio.positional.rooms.mix.room).toBe("neon-koi");
    const loops = sources(ctx, before);
    expect(loops.length).toBeGreaterThan(2);
    audio.setListener(pose(0, 0, 0));
    run(ctx, audio, 0.5);
    expect(audio.positional.rooms.active).toBe(false);
    audio.setListener(byAquarium());
    run(ctx, audio, 0.3);
    expect(audio.positional.rooms.active).toBe(true);
    audio.stopAll();
    expect(audio.positional.rooms.active).toBe(false);
  });
});
