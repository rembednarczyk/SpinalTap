import type { EnemyTypeId, Vec3 } from "@seki/core";
import { describe, expect, it } from "vitest";
import { type ChunkDef, Simulation, gangerEntity } from "../src";
import { MELEE_CHASE_SPEED } from "../src/systems/ai/ganger-walk";
import { makeDeck } from "../src/world/deck";
import { groundOf } from "../src/world/ground";
import { gridOf } from "./terrain-world";
import { teleportPlayer } from "./helpers";

/**
 * A floor of its own (G-072): flat terrain at 0 and a bridge along x, 6 m wide, its deck 6 m up
 * from x 0 to 40 with room to stand under it, and a ramp at each end down to the terrain, 12 m
 * long (x -12..0 and 40..52). No solids: the only way between over and under is off a ramp's end
 * or side, the deck stopping shots and sight between them (G-071).
 */
const DECK_Y = 6;
const HALF_WIDTH = 3;
const RAMP_END = 52;
const strip = (x0: number, x1: number, y0: number, y1: number) =>
  makeDeck([x0, -HALF_WIDTH, x1, -HALF_WIDTH, x1, HALF_WIDTH, x0, HALF_WIDTH], [x0, 0, x1, 0], (x) => y0 + ((y1 - y0) * (x - x0)) / (x1 - x0));
const FLOOR: ChunkDef[] = [
  {
    id: "descent-floor",
    district: "shinsekai-7",
    bounds: { minX: -60, maxX: 100, minZ: -50, maxZ: 50 },
    props: [],
    actors: [],
    terrain: gridOf(-60, -50, 2, 81, 51, () => 0),
    decks: [strip(-12, 0, 0, DECK_Y), strip(0, 40, DECK_Y, DECK_Y), strip(40, RAMP_END, DECK_Y, 0)],
  },
];

/** Under the deck, and on it 8 m along towards the eastern ramp. */
const UNDER: Vec3 = { x: 26, y: 0, z: 0 };
const ON: Vec3 = { x: 34, y: DECK_Y, z: 1 };
/** The way between them off the eastern ramp's end (m), and the time a brawler runs it in. */
const WAY = 40 - ON.x + Math.hypot(RAMP_END - 40, DECK_Y) + (RAMP_END - UNDER.x);
const RUN = WAY / MELEE_CHASE_SPEED;

/** An alerted fighter of `type` at `from` after the player at `at`, on the floor. */
const fight = (at: Vec3, from: Vec3, type: EnemyTypeId) => {
  const sim = Simulation.create({ seed: 5, chunks: FLOOR });
  teleportPlayer(sim, at);
  sim.step();
  const g = gangerEntity(9001, { key: "g072", position: from, yaw: 0 }, null, 200, "descent-floor", undefined, type);
  g.ai!.alerted = true;
  g.ai!.lastKnown = { ...at };
  sim.world.add(g);
  return { sim, g, player: sim.player()! };
};

/** Seconds until `done`, or null within `seconds`. */
const until = (sim: Simulation, seconds: number, done: () => boolean) => {
  for (let i = 0; i < 60 * seconds; i++) {
    sim.step();
    if (done()) return i / 60;
  }
  return null;
};

/** On the same floor as the player, within a blade's reach. */
const reached = (g: { position: Vec3 }, p: { position: Vec3 }) => Math.abs(g.position.y - p.position.y) < 1 && Math.hypot(g.position.x - p.position.x, g.position.z - p.position.z) < 2.5;

describe("a fighter on a bridge's deck comes down to the player under it, off its end (G-072)", () => {
  it("the deck stands where put, with room under it", () => {
    const { sim } = fight(UNDER, ON, "hebi_brawler");
    const ground = groundOf(sim.world);
    expect(ground.heightAt(ON.x, ON.z)).toBeCloseTo(DECK_Y, 5);
    expect(ground.heightAt(UNDER.x, UNDER.z, 0.5)).toBeCloseTo(0, 5);
  });

  it("an alerted brawler on the deck reaches the player under it in about the time of the way down", () => {
    const { sim, g, player } = fight(UNDER, ON, "hebi_brawler");
    const at = until(sim, 2 * RUN, () => reached(g, player));
    expect(at).not.toBeNull();
    expect(at!).toBeLessThan(RUN * 1.5);
  });

  it("an alerted gunner on the deck comes down and shoots the player under it", () => {
    const { sim, player } = fight(UNDER, ON, "hebi_ganger");
    const hp = player.health!.current;
    expect(until(sim, 2 * RUN, () => player.health!.current < hp)).not.toBeNull();
  });

  it("and the other way: a brawler under the deck goes up to the player on it", () => {
    const { sim, g, player } = fight(ON, UNDER, "hebi_brawler");
    const at = until(sim, 2 * RUN, () => reached(g, player));
    expect(at).not.toBeNull();
    expect(at!).toBeLessThan(RUN * 1.5);
  });

  it("a brawler at the ramp's foot goes under the deck, not up the ramp over the player", () => {
    const { sim, g, player } = fight(UNDER, { x: RAMP_END + 3, y: 0, z: 0 }, "hebi_brawler");
    let top = 0;
    const at = until(sim, 2 * RUN, () => {
      top = Math.max(top, g.position.y);
      return reached(g, player);
    });
    expect(at).not.toBeNull();
    expect(top).toBeLessThan(DECK_Y / 2);
  });
});
