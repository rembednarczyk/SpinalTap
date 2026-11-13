import { describe, expect, it } from "vitest";
import { Simulation, gangerEntity } from "../src";
import { BRIDGE_DECKS } from "../src/content/lublin/decks";
import { teleportPlayer } from "./helpers";

/**
 * Chases off and onto the bridges away from any flight of steps (G-255 round 8): the way along
 * and over a deck's edge there is the one the walk always took. From the lower bridge of
 * Mełgiewska down to the street south of it (G-068), and from beside the footbridge of
 * podzamcze-2-0 and of the lower bridge of Mełgiewska onto them, round their ends (G-741).
 */

type P = { readonly x: number; readonly z: number };

/** Seconds an alerted brawler at `from` (feet reaching `fr`) takes to get within 2.5 m and `dy` (m) of height of the player at `to` (`tr`), or null. */
const chase = (from: P, fr: number, to: P, tr: number, chunk: string, seconds: number, dy = 1): number | null => {
  const sim = Simulation.create({ seed: 3 });
  teleportPlayer(sim, { x: to.x, y: 0, z: to.z });
  sim.step();
  const ground = sim.streamer.ground;
  const p = sim.player()!;
  p.position = { x: to.x, y: ground.heightAt(to.x, to.z, tr), z: to.z };
  p.prevPosition = p.position;
  const g = gangerEntity(9001, { key: "g255-edges", position: { x: from.x, y: ground.heightAt(from.x, from.z, fr), z: from.z }, yaw: 0 }, null, 200, chunk, undefined, "hebi_brawler");
  g.ai!.alerted = true;
  sim.world.add(g);
  for (let i = 0; i < 60 * seconds; i++) {
    sim.step();
    if (Math.hypot(g.position.x - p.position.x, g.position.z - p.position.z) < 2.5 && Math.abs(g.position.y - p.position.y) < dy) return i / 60;
  }
  return null;
};

describe("chasing over the edges of the bridges away from the flights of steps (G-255)", () => {
  it("gets from the lower bridge of Mełgiewska down to the street south of it", () => {
    const D = BRIDGE_DECKS.get("nabrzeze-0-1")![0]!;
    for (const [t, to] of [
      [0.1, { x: 2447, z: 319 }],
      [0.2, { x: 2449, z: 318 }],
      [0.6, { x: 2449, z: 318 }],
    ] as const) {
      const from = { x: D.a.x + (D.b.x - D.a.x) * t, z: D.a.z + (D.b.z - D.a.z) * t };
      expect(chase(from, Infinity, to, -Infinity, "nabrzeze-0-1", 30), `deck at ${t} → (${to.x}, ${to.z})`).not.toBeNull();
    }
  }, 120_000);

  it("gets past the wall of the abutment's level ground west of Mełgiewska's lower bridge, not up it (G-738)", () => {
    // From the bank south-west of the ramp: the way round its corner, by the 1.5 m wall at its foot.
    for (const from of [
      { x: 2411.9, z: 296 },
      { x: 2414.2, z: 307.4 },
    ]) {
      expect(chase(from, -Infinity, { x: 2447, z: 319 }, -Infinity, "nabrzeze-0-1", 20), `(${from.x}, ${from.z})`).not.toBeNull();
    }
  }, 120_000);

  it("gets from beside the footbridge of podzamcze-2-0 onto its middle", () => {
    const D = BRIDGE_DECKS.get("podzamcze-2-0")![0]!;
    const len = Math.hypot(D.b.x - D.a.x, D.b.z - D.a.z);
    const u = { x: (D.b.x - D.a.x) / len, z: (D.b.z - D.a.z) / len };
    const at = (t: number, side: number): P => ({ x: D.a.x + u.x * len * t - u.z * side, z: D.a.z + u.z * len * t + u.x * side });
    // On the deck (G-741): standing under its side, 0.75 m below, was within a metre.
    expect(chase(at(0.2, 8), -Infinity, at(0.5, 0), Infinity, "podzamcze-2-0", 25, 0.3)).not.toBeNull();
  }, 120_000);

  it("gets from beside the lower bridge of Mełgiewska by its western abutment onto it round its end, not up its side (G-741)", () => {
    // From the ground north of it, the deck there 1.2 m over it: the field led straight up its
    // side, and the walker stood at its foot. On the deck, not under its edge within a metre.
    const D = BRIDGE_DECKS.get("nabrzeze-0-1")![0]!;
    const len = Math.hypot(D.b.x - D.a.x, D.b.z - D.a.z);
    const u = { x: (D.b.x - D.a.x) / len, z: (D.b.z - D.a.z) / len };
    const at = (t: number, side: number): P => ({ x: D.a.x + u.x * len * t - u.z * side, z: D.a.z + u.z * len * t + u.x * side });
    expect(chase(at(0.15, -14), -Infinity, at(0.15, 0), Infinity, "nabrzeze-0-1", 20, 0.3)).not.toBeNull();
  }, 120_000);
});
