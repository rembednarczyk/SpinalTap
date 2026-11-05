import { describe, expect, it } from "vitest";
import { type DomainEvents, type ReputationState } from "@seki/core";
import { CIVILIAN_WALK_SPEED, FLEE_DEAD_ZONE, SCHEDULES, Simulation, YIELD_RADIUS } from "../src";
import { byKey, collect, input, offFacingPlayer, passerbyOnDeptak, run, teleportPlayer, watchStandOff } from "./helpers";

/** A fresh game (21:00, Oyaji's stall still open) whose standings are patched in, the way a load would. */
const simWith = (reputation: Partial<ReputationState>, seed = 5): Simulation => {
  const snap = Simulation.create({ seed }).snapshot(null, "test", "");
  return Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, reputation: { ...snap.domain.reputation, ...reputation }, wallet: { eddies: 5000 } } });
};

const STALL = SCHEDULES.oyaji!.stops[0]!.path.at(-1)!;
/** Where the player stands to shop at Oyaji's stall. */
const AT_COUNTER = { x: STALL.x, y: STALL.y, z: STALL.z - 1.4 };
const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/** A wary street (ADR-0070): −49..−11. */
const WARY = { civilians: -30 };
const HOSTILE = { civilians: -60 };

describe("a wary street makes way (ADR-0070)", () => {
  it("a passer-by steps back to 3.5 m at a walk and watches the player, without a word", () => {
    const sim = simWith(WARY, 3);
    const reactions = collect(sim, "NpcReacted");
    const walker = passerbyOnDeptak(sim);
    const w = watchStandOff(sim, walker.id, 1800);
    expect(w.min).toBeGreaterThanOrEqual(YIELD_RADIUS);
    expect(w.max).toBeLessThanOrEqual(YIELD_RADIUS + FLEE_DEAD_ZONE);
    expect(w.flips).toBeLessThanOrEqual(2);
    expect(w.speed).toBeLessThanOrEqual(CIVILIAN_WALK_SPEED + 1e-9);
    expect(reactions).toHaveLength(0);
    expect(offFacingPlayer(sim, [...sim.world].find((e) => e.id === walker.id)!)).toBeLessThan(1e-6);
  });

  it("leaves alone a player further than 3.5 m", () => {
    const sim = simWith(WARY, 3);
    const walker = passerbyOnDeptak(sim, YIELD_RADIUS + 1);
    const spot = { ...walker.position };
    run(sim, 120);
    expect(flat([...sim.world].find((e) => e.id === walker.id)!.position, spot)).toBeLessThan(0.05);
  });
});

describe("residents with a shop or a talk keep to their spot (ADR-0070)", () => {
  for (const [tier, reputation] of [
    ["wary", WARY],
    ["hostile", HOSTILE],
  ] as const) {
    it(`Oyaji stays at his stall, two metres from a ${tier} player`, () => {
      const sim = simWith(reputation);
      const reactions = collect(sim, "NpcReacted");
      teleportPlayer(sim, { x: STALL.x, y: STALL.y, z: STALL.z + 2 });
      run(sim, 1);
      const oyaji = byKey(sim, "oyaji")!;
      const w = watchStandOff(sim, oyaji.id, 1800);
      // He used to keep 7 m from the player whenever the street was below -10 (G-305).
      expect(w.flips).toBe(0);
      expect(w.max).toBeLessThan(2.2);
      expect(flat(byKey(sim, "oyaji")!.position, STALL)).toBeLessThan(0.3);
      expect(reactions).toHaveLength(0);
    });

    it(`Ume stays at her spot by a ${tier} player`, () => {
      const sim = simWith(reputation, 3);
      const home = byKey(sim, "ume")!.position;
      teleportPlayer(sim, { x: home.x + 2, y: home.y, z: home.z });
      run(sim, 300);
      expect(flat(byKey(sim, "ume")!.position, home)).toBeLessThan(0.05);
    });
  }

  it("a hostile street's resident turns to face the player", () => {
    const sim = simWith(HOSTILE, 3);
    const home = byKey(sim, "ume")!.position;
    teleportPlayer(sim, { x: home.x + 2, y: home.y, z: home.z });
    run(sim, 30);
    expect(offFacingPlayer(sim, byKey(sim, "ume")!)).toBeLessThan(1e-6);
  });

  it("a wary customer reaches Oyaji's counter and the shop opens (G-305)", () => {
    const sim = simWith(WARY);
    const started = collect(sim, "InteractionStarted");
    teleportPlayer(sim, AT_COUNTER);
    run(sim, 120);
    sim.step(input({ interact: true }));
    expect(started).toEqual([expect.objectContaining({ kind: "shop", shopId: "oyaji" })]);
  });

  it("a shot by his stall still sends Oyaji off, whatever the street thinks", () => {
    const sim = simWith({});
    teleportPlayer(sim, AT_COUNTER, Math.PI);
    run(sim, 2);
    const oyaji = byKey(sim, "oyaji")!;
    const reacted: DomainEvents["CrowdReacted"][] = [];
    sim.bus.on("CrowdReacted", (e) => reacted.push(e));
    sim.player()!.pitch = -0.6;
    sim.step(input({ fire: true }));
    expect(reacted).toContainEqual({ entityId: oyaji.id, state: "cowering" });
    // Down for a few seconds, then he runs.
    run(sim, 360);
    expect(flat(byKey(sim, "oyaji")!.position, STALL)).toBeGreaterThan(2);
  });
});
