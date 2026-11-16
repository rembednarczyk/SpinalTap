import type { Vec3 } from "@seki/core";
import { describe, expect, it } from "vitest";
import { type ChunkDef, Simulation } from "../src";
import { makeDeck } from "../src/world/deck";
import { chestOf, clearSight, eyeOf, hitscan, lineOfSight, rayGeometry } from "../src/world/hitscan";
import { gridOf } from "./terrain-world";
import { teleportPlayer } from "./helpers";

/**
 * A floor of its own: flat terrain at 0 and one bridge's deck 6 m over it, x 0..40 along its
 * axis, z -3..3, with room under it to stand (G-062). No solids: only the deck stands between.
 */
const DECK_Y = 6;
const FLOOR: ChunkDef[] = [
  {
    id: "deck-floor",
    district: "shinsekai-7",
    bounds: { minX: -40, maxX: 80, minZ: -40, maxZ: 40 },
    props: [],
    actors: [],
    terrain: gridOf(-40, -40, 2, 61, 41, () => 0),
    decks: [makeDeck([0, -3, 40, -3, 40, 3, 0, 3], [0, 0, 40, 0], () => DECK_Y)],
  },
];

/** A game on the floor with the player at `at`, after one step so the chunk is in. */
const floorSim = (at: Vec3): Simulation => {
  const sim = Simulation.create({ seed: 5, chunks: FLOOR });
  teleportPlayer(sim, at);
  sim.step();
  return sim;
};

const toward = (from: Vec3, to: Vec3) => {
  const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
  const len = Math.hypot(d.x, d.y, d.z);
  return { dir: { x: d.x / len, y: d.y / len, z: d.z / len }, len };
};

/** A shot from `from` at the player's chest: what it hits and how far from the muzzle. */
const shootAtPlayer = (sim: Simulation, from: Vec3) => {
  const p = sim.player()!;
  const { dir, len } = toward(from, chestOf(p));
  const hit = hitscan(sim.world, from, dir, len + 5, -1);
  return { hitPlayer: hit.entity?.id === p.id, distance: hit.distance, point: hit.point };
};

describe("a bridge's deck stops shots and sight between over and under it (G-071, ADR-0053)", () => {
  it("the player stands under the deck and on it where put", () => {
    expect(floorSim({ x: 20, y: 0, z: 0 }).player()!.position.y).toBeCloseTo(0, 5);
    expect(floorSim({ x: 20, y: DECK_Y, z: 0 }).player()!.position.y).toBeCloseTo(DECK_Y, 5);
  });

  it("a shot from the deck at a target under it hits the deck", () => {
    const sim = floorSim({ x: 20, y: 0, z: 0 });
    const shot = shootAtPlayer(sim, { x: 24, y: DECK_Y + 1.62, z: 1 });
    expect(shot.hitPlayer).toBe(false);
    expect(shot.point.y).toBeGreaterThan(DECK_Y - 1);
    expect(shot.point.y).toBeLessThanOrEqual(DECK_Y + 1e-6);
  });

  it("a shot from under the deck at the player on it hits the deck's underside", () => {
    const sim = floorSim({ x: 20, y: DECK_Y, z: 0 });
    const shot = shootAtPlayer(sim, { x: 26, y: 1.62, z: -1 });
    expect(shot.hitPlayer).toBe(false);
    expect(shot.point.y).toBeLessThan(DECK_Y);
    expect(shot.point.y).toBeGreaterThan(DECK_Y - 1);
  });

  it("a straight-down shot through the deck stops on it, and so does one from under it straight up", () => {
    const sim = floorSim({ x: 30, y: 0, z: 30 });
    expect(rayGeometry(sim.world, { x: 20, y: DECK_Y + 2, z: 0 }, { x: 0, y: -1, z: 0 }, 10)).toBeCloseTo(2, 3);
    const up = rayGeometry(sim.world, { x: 20, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }, 10);
    expect(up).not.toBeNull();
    expect(up!).toBeLessThan(DECK_Y - 1);
    expect(up!).toBeGreaterThan(DECK_Y - 2);
  });

  it("a witness under the deck does not see the player on it, nor the player on it one under it", () => {
    const sim = floorSim({ x: 20, y: DECK_Y, z: 0 });
    const witness = { x: 23, y: 1.62, z: 0 };
    expect(clearSight(sim.world, witness, chestOf(sim.player()!))).toBe(false);
    expect(lineOfSight(sim.world, eyeOf(sim.player()!), { x: 23, y: 1.25, z: 0 })).toBe(false);
  });

  it("a shot along the deck, one from beside it under it and one from far over it still hit", () => {
    const onDeck = floorSim({ x: 20, y: DECK_Y, z: 0 });
    expect(shootAtPlayer(onDeck, { x: 5, y: DECK_Y + 1.62, z: 1 }).hitPlayer).toBe(true);
    expect(shootAtPlayer(onDeck, { x: 20, y: DECK_Y + 6, z: 25 }).hitPlayer).toBe(true);
    const under = floorSim({ x: 20, y: 0, z: 0 });
    expect(shootAtPlayer(under, { x: 20, y: 1.62, z: 15 }).hitPlayer).toBe(true);
    expect(shootAtPlayer(under, { x: -10, y: 1.62, z: 0 }).hitPlayer).toBe(true);
    expect(clearSight(under.world, { x: 20, y: 1.62, z: 15 }, chestOf(under.player()!))).toBe(true);
  });

  it("a shot past the deck's end over the terrain is no shot at the deck", () => {
    const sim = floorSim({ x: 45, y: 0, z: 0 });
    expect(shootAtPlayer(sim, { x: 45, y: DECK_Y + 1.62, z: 10 }).hitPlayer).toBe(true);
  });
});
