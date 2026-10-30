import { describe, expect, it } from "vitest";
import { Simulation, groundY } from "../src";
import { BRIDGE_DECKS } from "../src/content/lublin/decks";
import { SHAPED_TERRAIN } from "../src/content/lublin/terrain";
import { TRAFFIC_ROUTES, pointAt } from "../src/content/traffic";
import { deckAt, makeDeck } from "../src/world/deck";
import { terrainHeightAt } from "@seki/core";

/** Mełgiewska over the Bystrzyca: its two carriageways' bridges, the river some 5 m below. */
const OVER_RIVER = { x: 2428, z: 262 };

describe("bridges' decks (ADR-0053)", () => {
  it("run level from abutment to abutment, level across, nothing off the deck", () => {
    const d = makeDeck([0, -5, 40, -5, 40, 5, 0, 5], [0, 0, 40, 0], (x) => (x === 0 ? 2 : 4));
    expect(deckAt([d], 20, 3)).toBeCloseTo(3, 5);
    expect(deckAt([d], 20, -3)).toBeCloseTo(3, 5);
    expect(deckAt([d], 0, 0)).toBeCloseTo(2, 5);
    expect(deckAt([d], 20, 8)).toBeNull();
  });

  it("carry Mełgiewska over the Bystrzyca: the ground, the traffic and the player stay up on the deck", () => {
    expect([...BRIDGE_DECKS.values()].flat().length).toBeGreaterThan(4);
    const terrain = terrainHeightAt(SHAPED_TERRAIN.get("nabrzeze-0-0")!, OVER_RIVER.x, OVER_RIVER.z);
    const deck = groundY(OVER_RIVER.x, OVER_RIVER.z);
    expect(deck - terrain).toBeGreaterThan(3);
    const sim = Simulation.create({ seed: 1 });
    expect(sim.streamer.ground.heightAt(OVER_RIVER.x, OVER_RIVER.z)).toBeCloseTo(deck, 5);
    // The cars along Mełgiewska never dip into the valley: the road keeps within a metre of the abutments' level.
    for (const r of TRAFFIC_ROUTES.filter((x) => x.street === "Mełgiewska" && x.use === "cars")) {
      for (let s = 0; s < r.length; s += 2) {
        const p = pointAt(r.points, s);
        if (Math.hypot(p.x - OVER_RIVER.x, p.z - OVER_RIVER.z) < 15) expect(sim.streamer.ground.heightAt(p.x, p.z), `${r.id} at ${s}`).toBeGreaterThan(deck - 1.5);
      }
    }
  });
});
