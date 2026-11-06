import { describe, expect, it } from "vitest";
import type { CharacterState } from "@seki/core";
import { Simulation, fallDamage, playerStatsOf } from "../src";
import { BALCONY_TOP, MARKET_PLACE, OLD_MARKET_CHUNK, ROOF_WEST_TOP, market } from "./fixtures/old-market";
import { collect, input, run, teleportPlayer } from "./helpers";

type Body = Partial<Pick<CharacterState, "cyberware" | "memories">>;

/** The legs and both memories of running: a walk of 5.4 m/s. */
const FAST: Body = { cyberware: { optics: "hitomi_optics_mk1", skeleton: "kitsune_tendons" }, memories: ["street_runner", "crash_night"] };

/** The low roof's edge over the balcony, along x at z 64 of the market; the second ladder's line is at x 69.2. */
const EDGE = 64;

interface Drop {
  readonly drop: number;
  /** Height of the floor she landed on, above the market's. */
  readonly floor: number;
  readonly health: number;
}

/**
 * A new game with her on the low roof 1.5 m back from the edge at `x`, walking over it at
 * `yaw` (0 is north, out over the market); with the stick let go once off the roof, or held.
 */
const walkOff = (x: number, yaw: number, hold: boolean, body?: Body): Drop => {
  let sim = Simulation.create({ seed: 1, chunks: [OLD_MARKET_CHUNK] });
  const start = market(x - Math.sin(yaw) * 1.5, ROOF_WEST_TOP, EDGE - 1.5);
  teleportPlayer(sim, start, yaw);
  run(sim, 2);
  if (body) {
    const snap = sim.snapshot(null, "t", "");
    sim = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, character: { ...snap.domain.character, ...body } } }, undefined, "off", "off", [OLD_MARKET_CHUNK]);
  }
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  teleportPlayer(sim, start, yaw);
  const p = sim.player()!;
  delete p.fall;
  delete p.airPeak;
  const landed = collect<{ drop: number }>(sim, "Landed");
  for (let i = 0; i < 200 && landed.length === 0 && !p.climb; i++) sim.step(input({ moveZ: hold || p.fall === undefined ? 1 : 0 }));
  expect(p.climb, `${x} ${yaw}: off the roof beside the ladder, not onto it`).toBeUndefined();
  expect(landed, `${x} ${yaw}`).toHaveLength(1);
  return { drop: landed[0]!.drop, floor: p.position.y - MARKET_PLACE.y, health: p.health?.current ?? 0 };
};

describe("a walk off the low roof over the fire escape's balcony (G-318)", () => {
  const onBalcony = fallDamage(ROOF_WEST_TOP - BALCONY_TOP);

  it("lands on the balcony, not 9 m down on the market, the stick held or let go", () => {
    expect(playerStatsOf(Simulation.create({ seed: 1 }).domain).moveSpeed).toBeCloseTo(4.2, 5);
    // Beside the ladder's catch (0.7 m from its line) on both sides, and along the balcony.
    for (const x of [68.4, 70.1, 71, 72.4]) {
      for (const hold of [true, false]) {
        const d = walkOff(x, 0, hold);
        // Before: from the stick held she flew over the rail, 9.1 m onto the market, 51 damage.
        expect(d.floor, `${x} ${hold}`).toBeCloseTo(BALCONY_TOP, 5);
        expect(d.drop, `${x} ${hold}`).toBeCloseTo(ROOF_WEST_TOP - BALCONY_TOP, 5);
        expect(d.health, `${x} ${hold}`).toBe(100 - onBalcony);
      }
    }
  });

  it("lands on it from a walk at an angle over the edge too, towards the balcony's middle", () => {
    for (const [x, yaw] of [[70.1, 0.5], [71, 0.5], [71, -0.5], [72.4, -0.5]] as const) {
      const d = walkOff(x, yaw, true);
      expect(d.floor, `${x} ${yaw}`).toBeCloseTo(BALCONY_TOP, 5);
      expect(d.health, `${x} ${yaw}`).toBe(100 - onBalcony);
    }
  });

  it("a walk with every buff of speed lands on the balcony or its rail, never on the market", () => {
    for (const hold of [true, false]) {
      const d = walkOff(71, 0, hold, FAST);
      expect(d.floor, `${hold}`).toBeGreaterThanOrEqual(BALCONY_TOP - 1e-6);
      expect(d.floor, `${hold}`).toBeLessThan(BALCONY_TOP + 1.1);
      expect(d.health, `${hold}`).toBe(100 - fallDamage(d.drop));
      expect(d.health, `${hold}`).toBeGreaterThanOrEqual(100 - onBalcony);
    }
  });
});
