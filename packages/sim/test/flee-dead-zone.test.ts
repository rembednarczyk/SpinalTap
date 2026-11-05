import { describe, expect, it } from "vitest";
import { type ReputationState } from "@seki/core";
import { FLEE_DEAD_ZONE, FLEE_RADIUS, Simulation, YIELD_RADIUS, stateHash } from "../src";
import { collect, offFacingPlayer, passerbyOnDeptak, run, teleportPlayer, watchStandOff } from "./helpers";

/** A fresh game whose standings are patched in, built the way a load would build it. */
const simWith = (reputation: Partial<ReputationState>, seed = 3): Simulation => {
  const snap = Simulation.create({ seed }).snapshot(null, "test", "");
  return Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, reputation: { ...snap.domain.reputation, ...reputation } } });
};

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

  // A passer-by has no key, so neither the save nor `stateHash` holds it (G-327): a load puts it
  // back at its spot, calm. What carries over is the player, and from there the stand-off itself,
  // so the passer-by is compared field by field, not by the hash.
  it("a load while it stands brings it back to its spot, and it runs off to the same stand-off", () => {
    const sim = simWith(HOSTILE, 11);
    const walker = passerbyOnDeptak(sim);
    const spot = { ...walker.position };
    run(sim, 400);
    expect(walker.key).toBeUndefined();
    const restored = Simulation.fromSnapshot(sim.snapshot(null, "x", ""));
    const reactions = collect(restored, "NpcReacted");
    run(restored, 1);
    // Spawned at its spot in this step, and already one step into its run.
    const back = byId(restored, walker.id).position;
    expect(Math.hypot(back.x - spot.x, back.z - spot.z)).toBeLessThan(0.1);
    run(sim, 300);
    run(restored, 299);
    expect(hash(restored)).toBe(hash(sim));
    const [was, is] = [byId(sim, walker.id), byId(restored, walker.id)];
    expect(is.position).toEqual(was.position);
    expect(is.yaw).toBe(was.yaw);
    expect(is.velocity).toEqual({ x: 0, y: 0, z: 0 });
    expect(is.passerby).toEqual(was.passerby);
    // The loaded game does not know it ran: it cues its escape again, once.
    expect(reactions).toHaveLength(1);
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

/** The same, with the deptak's crowd out (ADR-0041): walkers of its routes and people on benches. */
const crowdWith = (reputation: Partial<ReputationState>, seed = 3): Simulation => {
  const snap = Simulation.create({ seed, crowd: "high" }).snapshot(null, "test", "");
  return Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, reputation: { ...snap.domain.reputation, ...reputation } } }, undefined, "high");
};

const STREETS = [
  ["hostile", HOSTILE, FLEE_RADIUS],
  ["wary", { civilians: -30 }, YIELD_RADIUS],
] as const;

describe("the dead zone for the crowd (ADR-0070)", () => {
  /** The walkers of the crowd routes on the deptak, by id, in a fresh game of `seed`. */
  const laneWalkers = (seed: number): number[] => {
    const sim = crowdWith({}, seed);
    passerbyOnDeptak(sim);
    return [...sim.world]
      .filter((e) => e.civilian && e.passerby?.lane && !e.interactable)
      .map((e) => e.id)
      .sort((a, b) => a - b)
      .slice(0, 3);
  };

  /** The first three walkers of seed 3, found once for all the cases below. */
  let walkers: number[] | undefined;
  const firstWalkers = (): number[] => (walkers ??= laneWalkers(3));

  it("a walker of a crowd route goes on along it once the player is gone", () => {
    const [id] = laneWalkers(3);
    const sim = crowdWith(HOSTILE);
    const walker = passerbyOnDeptak(sim, 2, (e) => e.id === id);
    run(sim, 600);
    expect(byId(sim, walker.id).velocity).toEqual({ x: 0, y: 0, z: 0 });
    // The player steps 30 m off, further down the deptak, out of its sight and still in its chunk.
    const at = byId(sim, walker.id).position;
    const p = sim.player()!.position;
    const d = Math.hypot(at.x - p.x, at.z - p.z);
    teleportPlayer(sim, { x: at.x + ((at.x - p.x) / d) * 30, y: p.y, z: at.z + ((at.z - p.z) / d) * 30 });
    run(sim, 300);
    const now = byId(sim, walker.id);
    expect(Math.hypot(now.velocity!.x, now.velocity!.z)).toBeGreaterThan(0.5);
    expect(now.passerby!.lane!.rejoin).toBeNull();
  });

  for (const [tier, reputation, radius] of STREETS) {
    // One case per walker: each runs 30 s of a crowded deptak, too much for one case under coverage.
    for (const n of [0, 1, 2]) {
      it(`a walker of a crowd route (${n + 1} of 3) stops past the radius of a ${tier} street, instead of stepping in and out of it`, () => {
        const id = firstWalkers()[n];
        expect(id).toBeDefined();
        const sim = crowdWith(reputation);
        const walker = passerbyOnDeptak(sim, 2, (e) => e.id === id);
        const w = watchStandOff(sim, walker.id, 1800);
        // The walkers kept on going back to their route: 1169-1512 turns in these 30 s.
        expect(w.flips, `walker ${id}`).toBeLessThanOrEqual(2);
        expect(w.min, `walker ${id}`).toBeGreaterThanOrEqual(radius);
        expect(w.max, `walker ${id}`).toBeLessThanOrEqual(radius + FLEE_DEAD_ZONE);
      });
    }

    it(`someone sitting on a bench does not turn round to a player of a ${tier} street in the dead zone`, () => {
      const sim = crowdWith(reputation);
      const sitter = passerbyOnDeptak(sim, radius + 1, (e) => !e.passerby.lane && e.passerby.activity === "sit");
      // Its heading on the bench, before it knows the player is there.
      const yaw = byId(sim, sitter.id).yaw;
      run(sim, 60);
      const now = byId(sim, sitter.id);
      expect(now.yaw).toBe(yaw);
      expect(now.velocity).toEqual({ x: 0, y: 0, z: 0 });
      expect(now.activity).toBe("sit");
    });
  }
});
