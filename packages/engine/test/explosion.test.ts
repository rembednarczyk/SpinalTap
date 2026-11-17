import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene, Vector3 } from "../src/babylon";
import { ExplosionFx } from "../src/effects/explosion-fx";
import { BLAST_LIFE, ExplosionState, FIRE_LIFE, FLASH_LIFE, MAX_BLASTS, MAX_STEP, PER_BLAST } from "../src/effects/explosion-state";

const DT = 1 / 60;
const AT = { x: 2519, y: 1.1, z: 412.2 };
const VIEW = { right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, forward: { x: 0, y: 0, z: 1 } };

/** Live particles of a state now: fire, smoke and debris, written into buffers big enough for all. */
const counts = (s: ExplosionState) => {
  const m = new Float32Array(16 * 64);
  const c = new Float32Array(4 * 64);
  return { fire: s.writeFire(m, c, VIEW), smoke: s.writeSmoke(m, c, VIEW, [0.3, 0.3, 0.3]), debris: s.writeDebris(m, c) };
};
const run = (s: ExplosionState, seconds: number) => {
  for (let t = 0; t < seconds; t += DT) s.update(DT);
};

/**
 * W-3's blast in the engine (ADR-0082 stage 3c): a fireball, smoke and debris that live their time
 * and are gone, a flash on the newest blast only while it is lit, a cloud of particles on High and
 * one fireball and one puff without; its meshes off at rest, none made per blast.
 */
describe("explosion: the blast's life (ADR-0082 stage 3c)", () => {
  it("burns, smokes and throws debris, then the fire, the debris and at last the smoke are gone", () => {
    const s = new ExplosionState(true);
    s.add(AT, 10);
    run(s, 0.15);
    expect(counts(s)).toEqual({ fire: PER_BLAST.fire, smoke: expect.any(Number), debris: PER_BLAST.debris });
    expect(counts(s).smoke).toBeGreaterThan(0);
    run(s, FIRE_LIFE + 0.5);
    expect(counts(s)).toMatchObject({ fire: 0, debris: 0 });
    expect(counts(s).smoke).toBeGreaterThan(0);
    run(s, BLAST_LIFE);
    expect(s.live).toBe(0);
    expect(counts(s)).toEqual({ fire: 0, smoke: 0, debris: 0 });
  });

  it("without particles is one fireball and one puff, no debris", () => {
    const s = new ExplosionState(false);
    s.add(AT, 10);
    run(s, 0.3);
    expect(counts(s)).toEqual({ fire: 1, smoke: 1, debris: 0 });
  });

  it("lights the place for a moment from its newest lit blast, never when not lit or reduced", () => {
    const s = new ExplosionState(true);
    s.add(AT, 10);
    s.update(DT);
    const first = s.flash();
    expect(first?.intensity).toBeGreaterThan(1);
    expect(first?.at.x).toBe(AT.x);
    run(s, FLASH_LIFE / 2);
    expect(s.flash()!.intensity).toBeLessThan(first!.intensity);
    run(s, FLASH_LIFE);
    expect(s.flash()).toBeNull();
    s.add({ ...AT, x: AT.x + 18 }, 10, false);
    s.update(DT);
    expect(s.flash()).toBeNull();
    s.add(AT, 10);
    s.reduced = true;
    expect(s.flash()).toBeNull();
  });

  it("plays its frames through a hitch (at most a twentieth of a second a frame) and keeps at most four blasts", () => {
    const s = new ExplosionState(true);
    s.add(AT, 10);
    s.update(5);
    expect(counts(s).fire).toBe(PER_BLAST.fire);
    run(s, BLAST_LIFE);
    for (let i = 0; i < MAX_BLASTS + 2; i++) s.add({ ...AT, x: AT.x + i }, 10);
    expect(s.live).toBe(MAX_BLASTS);
    s.update(MAX_STEP);
    expect(counts(s).fire).toBe(MAX_BLASTS * PER_BLAST.fire);
  });

  it("looks the same every time: the particles follow the blast's age and its own seed", () => {
    const frame = () => {
      const s = new ExplosionState(true);
      s.add(AT, 10);
      run(s, 0.2);
      const m = new Float32Array(16 * 64);
      s.writeDebris(m, new Float32Array(4 * 64));
      return Array.from(m);
    };
    expect(frame()).toEqual(frame());
  });
});

describe("explosion: its meshes (ADR-0082 stage 3c)", () => {
  const setup = (particles: boolean) => {
    const scene = new Scene(new NullEngine());
    const fx = new ExplosionFx(scene, particles);
    const view = { right: Vector3.Right(), up: Vector3.Up(), forward: Vector3.Forward() };
    return { scene, fx, view };
  };

  it("draws nothing at rest, three meshes while a blast shows on High, none once it is over; makes no mesh per blast", () => {
    const { scene, fx, view } = setup(true);
    const meshes = scene.meshes.length;
    fx.update(DT, view);
    expect(fx.meshes.filter((m) => m.isEnabled())).toHaveLength(0);
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < 3; i++) fx.add({ ...AT, x: AT.x + 6 * i }, 10, i === 0);
      fx.update(DT, view);
      for (let k = 0; k < 4; k++) fx.update(MAX_STEP, view);
      expect(fx.meshes.filter((m) => m.isEnabled())).toHaveLength(3);
      expect(fx.meshes[0]!.thinInstanceCount).toBe(3 * PER_BLAST.fire);
      for (let t = 0; t < BLAST_LIFE + 0.1; t += MAX_STEP) fx.update(MAX_STEP, view);
      expect(fx.meshes.filter((m) => m.isEnabled())).toHaveLength(0);
    }
    expect(scene.meshes.length).toBe(meshes);
  });

  it("on low quality has no debris mesh: one fireball and one puff a blast", () => {
    const { scene, fx, view } = setup(false);
    expect(fx.meshes).toHaveLength(2);
    expect(scene.meshes.filter((m) => m.name.startsWith("fx-blast"))).toHaveLength(2);
    fx.add(AT, 10, true);
    for (let k = 0; k < 6; k++) fx.update(MAX_STEP, view);
    expect(fx.meshes.map((m) => [m.isEnabled(), m.thinInstanceCount])).toEqual([
      [true, 1],
      [true, 1],
    ]);
  });

  it("clears at a load: nothing goes on drawing", () => {
    const { fx, view } = setup(true);
    fx.add(AT, 10, true);
    fx.update(0.1, view);
    fx.clear();
    expect(fx.state.live).toBe(0);
    expect(fx.meshes.filter((m) => m.isEnabled())).toHaveLength(0);
  });
});
