import { terrainHeightAt } from "@seki/core";
import { describe, expect, it } from "vitest";
import { Simulation } from "../src";
import { BRIDGE_DECKS } from "../src/content/lublin/decks";
import { SHAPED_TERRAIN } from "../src/content/lublin/terrain";
import { deckHeight } from "../src/world/deck";
import { input, teleportPlayer } from "./helpers";

type P = { readonly x: number; readonly z: number };

/** Podwale w66318260 under the viaduct of Zamkowa (OSM), a few metres on at each end. */
const PODWALE: readonly P[] = [
  { x: 751.1, z: 162.2 },
  { x: 735.9, z: 176.6 },
];
/** The Bystrzyca's embankment path w307943890 (OSM) under both bridges of Mełgiewska. */
const BULWAR: readonly P[] = [
  { x: 2451.6, z: 342.8 },
  { x: 2438.2, z: 248.1 },
  { x: 2436.7, z: 242.5 },
];
/** Zamkowa on its viaduct w232362907, from abutment to abutment. */
const ZAMKOWA: readonly P[] = [
  { x: 758.5, z: 183.1 },
  { x: 732.6, z: 157 },
];

const terrain = (chunk: string, p: P) => terrainHeightAt(SHAPED_TERRAIN.get(chunk)!, p.x, p.z);

/**
 * Walks the player along `way` on foot, turned towards the next point every step, from its
 * first point on the ground. The biggest change of the feet's height from step to step, and
 * how close the player got to the end.
 */
const walk = (way: readonly P[], start: number, onStep: (p: { x: number; y: number; z: number }) => void = () => {}) => {
  const sim = Simulation.create({ seed: 3 });
  teleportPlayer(sim, { x: way[0]!.x, y: start, z: way[0]!.z });
  sim.step();
  let next = 1;
  let jump = 0;
  for (let i = 0; i < 60 * 60 && next < way.length; i++) {
    const p = sim.player()!;
    const to = way[next]!;
    if (Math.hypot(to.x - p.position.x, to.z - p.position.z) < 0.6) {
      next++;
      continue;
    }
    p.yaw = Math.atan2(to.x - p.position.x, to.z - p.position.z);
    const y = p.position.y;
    sim.step(input({ moveZ: 1 }));
    jump = Math.max(jump, Math.abs(sim.player()!.position.y - y));
    onStep(sim.player()!.position);
  }
  const end = way[way.length - 1]!;
  const p = sim.player()!.position;
  return { jump, left: Math.hypot(end.x - p.x, end.z - p.z) };
};

describe("ways under a bridge's deck (G-062, ADR-0053)", () => {
  it("Podwale runs on under the viaduct of Zamkowa: the feet stay on the street, no wall of the deck", () => {
    const { jump, left } = walk(PODWALE, terrain("podzamcze-1-0", PODWALE[0]!));
    expect(jump).toBeLessThan(0.5);
    expect(left).toBeLessThan(1);
  });

  it("the embankment path runs on under both bridges of Mełgiewska", () => {
    const { jump, left } = walk(BULWAR, terrain("nabrzeze-0-1", BULWAR[0]!));
    expect(jump).toBeLessThan(0.5);
    expect(left).toBeLessThan(1);
  });

  it("a jump under the lower bridge of Mełgiewska stops at the deck's underside, the head under the concrete", () => {
    const at = { x: 2445.9, z: 302.2 };
    const ground = terrain("nabrzeze-0-1", at);
    const sim = Simulation.create({ seed: 3 });
    teleportPlayer(sim, { x: at.x, y: ground, z: at.z });
    sim.step();
    const deck = sim.streamer.ground.heightAt(at.x, at.z);
    expect(deck - ground).toBeGreaterThan(2);
    const under = sim.streamer.ground.ceilingAt(at.x, at.z, ground + 1.8);
    expect(under).toBeLessThan(deck);
    expect(under - ground).toBeGreaterThanOrEqual(1.8);
    let top = ground;
    sim.step(input({ jump: true }));
    for (let i = 0; i < 60; i++) {
      sim.step();
      top = Math.max(top, sim.player()!.position.y);
    }
    expect(top).toBeGreaterThan(ground + 0.05);
    expect(top + 1.8).toBeLessThanOrEqual(under + 1e-6);
    expect(sim.player()!.position.y).toBeCloseTo(ground, 1);
  });

  it("the viaduct still carries Zamkowa: walking it, the feet stay on the deck over Podwale", () => {
    const deck = BRIDGE_DECKS.get("podzamcze-1-0")![0]!;
    let worst = 0;
    const { left } = walk(ZAMKOWA, deckHeight(deck, ZAMKOWA[0]!.x, ZAMKOWA[0]!.z), (p) => {
      if (Math.hypot(p.x - 745, p.z - 170) < 4) worst = Math.max(worst, Math.abs(p.y - deckHeight(deck, p.x, p.z)));
    });
    expect(left).toBeLessThan(1);
    expect(worst).toBeLessThan(0.3);
    expect(deckHeight(deck, 745, 170) - terrain("podzamcze-1-0", { x: 745, z: 170 })).toBeGreaterThan(4);
  });
});
