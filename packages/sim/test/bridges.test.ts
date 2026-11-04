import { describe, expect, it } from "vitest";
import { Simulation, groundY } from "../src";
import { BRIDGE_DECKS, bridgeDeckAt, flightDeckAt } from "../src/content/lublin/decks";
import { chunkScenery } from "../src/content/lublin/city";
import { MAP_CHUNKS } from "../src/content/lublin/sites";
import { SHAPED_TERRAIN } from "../src/content/lublin/terrain";
import { TRAFFIC_ROUTES, pointAt } from "../src/content/traffic";
import { type GroundDeck, deckAt, flightGradientAt, groundOver, makeDeck, onFlight } from "../src/world/deck";
import { terrainHeightAt } from "@seki/core";

const pointInRing = (p: { x: number; z: number }, ring: readonly { x: number; z: number }[]): boolean => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) c = !c;
  }
  return c;
};

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

  it("stay the ground over a flight of steps hung off them, which is the ground on its band off them even under the terrain (G-255, G-274)", () => {
    // A flight 2 m wide down from y 3 at x 10 to y 1 at x 0, beside a deck at y 3 reaching 1 m over its band.
    const ring = [
      { x: 0, z: -1 },
      { x: 10, z: -1 },
      { x: 10, z: 1 },
      { x: 0, z: 1 },
    ];
    const flight: GroundDeck = { ring, a: { x: 0, z: 0 }, b: { x: 10, z: 0 }, ya: 1, yb: 3, box: { minX: 0, maxX: 10, minZ: -1, maxZ: 1 }, flight: true };
    const deck: GroundDeck = makeDeck([0, 0, 20, 0, 20, 8, 0, 8], [0, 4, 20, 4], () => 3);
    // In the deck's outline the deck, drawn there, is the ground; off it the flight.
    expect(groundOver([deck, flight], 5, 0.5, 0)).toBeCloseTo(3, 5);
    expect(groundOver([deck, flight], 5, -0.5, 0)).toBeCloseTo(2, 5);
    expect(onFlight([deck, flight], 5, 0.5)).toBe(false);
    expect(onFlight([deck, flight], 5, -0.5)).toBe(true);
    // Cut into a bank: the terrain over the flight is not the ground there.
    expect(groundOver([deck, flight], 2, -0.5, 2)).toBeCloseTo(1.4, 5);
    // Off the flight's band the deck and the terrain are the ground as before.
    expect(groundOver([deck, flight], 5, 3, 0)).toBeCloseTo(3, 5);
    expect(groundOver([deck, flight], 5, -3, 0.5)).toBeCloseTo(0.5, 5);
    // No room under the flight, as under a bridge: feet far under it get it too, and a body
    // walking up to it from below finds a bank too steep to walk, not a way under it.
    expect(groundOver([deck, flight], 9, -0.5, 0, 0.45)).toBeCloseTo(2.8, 5);
    expect(groundOver([deck, flight], 2, -0.5, 0, 0.45)).toBeCloseTo(1.4, 5);
    const out = { x: 0, z: 0 };
    // On it within reach, its own grade (0.2), not the seam with the terrain beside it.
    expect(flightGradientAt([deck, flight], 5, -0.9, 2.5, out)).toEqual({ x: 0.2, z: 0 });
    expect(flightGradientAt([deck, flight], 5, -0.9, 1.5, out)).toBeNull();
    expect(flightGradientAt([deck, flight], 5, 0.5, Infinity, out)).toBeNull();
    expect(flightGradientAt([deck, flight], 5, 3, Infinity, out)).toBeNull();
  });

  it("let the steps from the viaduct of Zamkowa down beside it on their grade, for the walkers as for the ground (G-255)", () => {
    const sim = Simulation.create({ seed: 1 });
    // On the run from the bend (729.5, 159.9) up to the deck's edge (734.1, 163.9): its middle on
    // the flight's grade, its side in the map's outline of the viaduct on the bend's landing, in
    // the niche the steps have in the viaduct's sidewalk (G-274).
    for (const [x, z, y] of [
      [731.8, 161.9, -14.55],
      [730.8, 159.6, -15.31],
    ] as const) {
      expect(groundY(x, z), `${x}, ${z}`).toBeCloseTo(y, 1);
      expect(sim.streamer.ground.heightAt(x, z), `${x}, ${z}`).toBeCloseTo(groundY(x, z), 5);
    }
  });

  it("lay no steps on a flight's grade where a bridge's deck is the ground, nor a deck over the steps: one or the other, drawn as walked (G-274)", () => {
    const both: string[] = [];
    for (const c of MAP_CHUNKS) {
      for (const item of chunkScenery(c, [])) {
        const v = item.view;
        if (v.kind !== "ground" || !v.deck) continue;
        const xs = v.outline.map((p) => p.x);
        const zs = v.outline.map((p) => p.z);
        for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.25) {
          for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.25) {
            if (!pointInRing({ x, z }, v.outline)) continue;
            // A band of steps on a flight's grade over a bridge's deck, or a bridge's piece over a flight.
            if (v.surface === "steps" && flightDeckAt(x, z) === null && bridgeDeckAt(x, z) !== null) both.push(`steps over the deck at (${x.toFixed(2)}, ${z.toFixed(2)})`);
            if (v.surface !== "steps" && flightDeckAt(x, z) !== null) both.push(`deck over the flight at (${x.toFixed(2)}, ${z.toFixed(2)})`);
          }
        }
      }
    }
    expect(both).toEqual([]);
  });
});
