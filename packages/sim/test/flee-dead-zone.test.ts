import { describe, expect, it } from "vitest";
import { type ReputationState } from "@seki/core";
import { FLEE_RADIUS, Simulation, stateHash } from "../src";
import { byKey, collect, run, teleportPlayer } from "./helpers";

/** A fresh game whose standings are patched in, built the way a load would build it. */
const simWith = (reputation: Partial<ReputationState>, seed = 3): Simulation => {
  const snap = Simulation.create({ seed }).snapshot(null, "test", "");
  return Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, reputation: { ...snap.domain.reputation, ...reputation } } });
};

/** How far past the flee radius a scared civilian stands still rather than going back (ADR-0070). */
const FLEE_DEAD_ZONE = 2;

const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "x", ""));

/**
 * Watches `key` for `steps` steps with the player standing still (ADR-0070 measurement): how
 * often its movement relative to the player turns between "away" and "towards", and how far
 * from the player it keeps after the first five seconds.
 */
const watch = (sim: Simulation, key: string, steps: number) => {
  let flips = 0;
  let last = 0;
  let min = Infinity;
  let max = 0;
  for (let i = 0; i < steps; i++) {
    run(sim, 1);
    const e = byKey(sim, key)!;
    const p = sim.player()!;
    const dx = e.position.x - p.position.x;
    const dz = e.position.z - p.position.z;
    const d = Math.hypot(dx, dz);
    const radial = ((e.velocity?.x ?? 0) * dx + (e.velocity?.z ?? 0) * dz) / Math.max(d, 1e-6);
    const s = Math.abs(radial) < 0.05 ? 0 : Math.sign(radial);
    if (s !== 0 && last !== 0 && s !== last) flips++;
    if (s !== 0) last = s;
    if (i > 300) {
      min = Math.min(min, d);
      max = Math.max(max, d);
    }
  }
  return { flips, min, max };
};

/** The player two metres from Ume's spot on the deptak. */
const byUme = (sim: Simulation) => {
  const home = byKey(sim, "ume")!.position;
  teleportPlayer(sim, { x: home.x + 2, y: home.y, z: home.z });
};

describe("the flee radius's dead zone (ADR-0070)", () => {
  it("a scared resident stops past the radius and stands, instead of stepping in and out of it", () => {
    const sim = simWith({ civilians: -30 });
    byUme(sim);
    const w = watch(sim, "ume", 1800);
    // It used to turn 1095 times in these 30 s, 8 cm in and out at 7 m.
    expect(w.flips).toBeLessThanOrEqual(2);
    expect(w.min).toBeGreaterThanOrEqual(FLEE_RADIUS);
    expect(w.max).toBeLessThanOrEqual(FLEE_RADIUS + FLEE_DEAD_ZONE);
    const ume = byKey(sim, "ume")!;
    expect(ume.velocity).toEqual({ x: 0, y: 0, z: 0 });
    // It watches the player.
    const p = sim.player()!;
    const facing = Math.atan2(p.position.x - ume.position.x, p.position.z - ume.position.z);
    expect(Math.abs(Math.atan2(Math.sin(ume.yaw - facing), Math.cos(ume.yaw - facing)))).toBeLessThan(1e-6);
  });

  it("cues one escape for the whole stand-off", () => {
    const sim = simWith({ civilians: -30 });
    const reactions = collect(sim, "NpcReacted");
    byUme(sim);
    run(sim, 1800);
    expect(reactions).toHaveLength(1);
  });

  it("holds on another seed too", () => {
    const sim = simWith({ civilians: -30 }, 17);
    byUme(sim);
    expect(watch(sim, "ume", 1800).flips).toBeLessThanOrEqual(2);
  });

  it("keeps no hidden state: a load while it stands goes on the same", () => {
    const sim = simWith({ civilians: -30 }, 11);
    byUme(sim);
    run(sim, 400);
    const restored = Simulation.fromSnapshot(sim.snapshot(null, "x", ""));
    run(sim, 300);
    run(restored, 300);
    expect(hash(restored)).toBe(hash(sim));
  });

  it("walks back home once the player is far enough", () => {
    const sim = simWith({ civilians: -30 });
    const home = byKey(sim, "ume")!.position;
    byUme(sim);
    run(sim, 400);
    // Its spot is further than the dead zone from the player now: it goes back to it.
    teleportPlayer(sim, { x: home.x + FLEE_RADIUS + FLEE_DEAD_ZONE + 1, y: home.y, z: home.z });
    run(sim, 900);
    const ume = byKey(sim, "ume")!;
    expect(Math.hypot(ume.position.x - home.x, ume.position.z - home.z)).toBeLessThanOrEqual(0.3);
  });
});
