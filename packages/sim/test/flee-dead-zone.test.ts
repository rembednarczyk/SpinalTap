import { describe, expect, it } from "vitest";
import { type ReputationState } from "@seki/core";
import { FLEE_RADIUS, Simulation, stateHash } from "../src";
import { collect, offFacingPlayer, passerbyOnDeptak, run, teleportPlayer, watchStandOff } from "./helpers";

/** A fresh game whose standings are patched in, built the way a load would build it. */
const simWith = (reputation: Partial<ReputationState>, seed = 3): Simulation => {
  const snap = Simulation.create({ seed }).snapshot(null, "test", "");
  return Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, reputation: { ...snap.domain.reputation, ...reputation } } });
};

/** How far past the flee radius a scared civilian stands still rather than going back (ADR-0070). */
const FLEE_DEAD_ZONE = 2;
/** A street hostile to the player (ADR-0070): its passers-by run. */
const HOSTILE = { civilians: -60 };

const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "x", ""));
const byId = (sim: Simulation, id: number) => [...sim.world].find((e) => e.id === id)!;

describe("the flee radius's dead zone (ADR-0070)", () => {
  it("a scared passer-by stops past the radius and stands, instead of stepping in and out of it", () => {
    const sim = simWith(HOSTILE);
    const walker = passerbyOnDeptak(sim);
    const w = watchStandOff(sim, walker.id, 1800);
    // Ume at -30 used to turn 1095 times in these 30 s, 8 cm in and out at 7 m.
    expect(w.flips).toBeLessThanOrEqual(2);
    expect(w.min).toBeGreaterThanOrEqual(FLEE_RADIUS);
    expect(w.max).toBeLessThanOrEqual(FLEE_RADIUS + FLEE_DEAD_ZONE);
    const now = byId(sim, walker.id);
    expect(now.velocity).toEqual({ x: 0, y: 0, z: 0 });
    expect(offFacingPlayer(sim, now)).toBeLessThan(1e-6);
  });

  it("cues one escape for the whole stand-off", () => {
    const sim = simWith(HOSTILE);
    const reactions = collect(sim, "NpcReacted");
    passerbyOnDeptak(sim);
    run(sim, 1800);
    expect(reactions).toHaveLength(1);
  });

  it("holds on another seed too", () => {
    const sim = simWith(HOSTILE, 17);
    const walker = passerbyOnDeptak(sim);
    expect(watchStandOff(sim, walker.id, 1800).flips).toBeLessThanOrEqual(2);
  });

  it("keeps no hidden state: a load while it stands goes on the same", () => {
    const sim = simWith(HOSTILE, 11);
    passerbyOnDeptak(sim);
    run(sim, 400);
    const restored = Simulation.fromSnapshot(sim.snapshot(null, "x", ""));
    run(sim, 300);
    run(restored, 300);
    expect(hash(restored)).toBe(hash(sim));
  });

  it("walks back to its spot once the player is far enough", () => {
    const sim = simWith(HOSTILE);
    const walker = passerbyOnDeptak(sim);
    const spot = { ...walker.position };
    run(sim, 400);
    // Its spot is further than the dead zone from the player now: it goes back to it.
    teleportPlayer(sim, { x: spot.x + FLEE_RADIUS + FLEE_DEAD_ZONE + 1, y: spot.y, z: spot.z });
    run(sim, 900);
    const now = byId(sim, walker.id);
    expect(Math.hypot(now.position.x - spot.x, now.position.z - spot.z)).toBeLessThanOrEqual(0.5);
  });
});
