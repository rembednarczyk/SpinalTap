import { describe, expect, it } from "vitest";
import { Simulation, gangerEntity } from "../src";
import { BRIDGE_DECKS } from "../src/content/lublin/decks";
import { teleportPlayer } from "./helpers";

/**
 * Chases off and onto the bridges away from any flight of steps (G-255 round 8): the way along
 * and over a deck's edge there is the one the walk always took. From the lower bridge of
 * Mełgiewska down to the street south of it (G-068), and from beside the footbridge of
 * podzamcze-2-0 and of the lower bridge of Mełgiewska onto them, round their ends (G-741), and
 * from beside the bridge of podzamcze-1-0 onto it (G-747), and from the foot of a bank beside the
 * lower bridge of Mełgiewska onto it (G-763), and from the foot of the wall of its western
 * abutment (G-762).
 */

type P = { readonly x: number; readonly z: number };

/**
 * Seconds an alerted brawler at `from` (feet reaching `fr`) takes to get within 2.5 m and `dy` (m)
 * of height of the player at `to` (`tr`), or null; with `unstuck`, null too once its stuck check
 * sidesteps (it walked against something for a while).
 */
const chase = (from: P, fr: number, to: P, tr: number, chunk: string, seconds: number, dy = 1, unstuck = false): number | null => {
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
    if (unstuck && (g.walk?.unstickUntil ?? 0) > 0) return null;
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

  it("gets round the sheer edge of the deck over the abutment's ramp of Mełgiewska's lower bridge, not up it (G-740)", () => {
    // From the ramp's upper end down under the bridge, and from under it up onto the deck; and from
    // where the walkers stood, at the foot of the edge (the deck's tip, the cells of their feet on it).
    for (const [from, to] of [
      [{ x: 2410, z: 310 }, { x: 2449, z: 318 }],
      [{ x: 2422, z: 310 }, { x: 2405, z: 318 }],
      [{ x: 2415.6, z: 310.8 }, { x: 2449, z: 318 }],
      [{ x: 2416.4, z: 311.5 }, { x: 2405, z: 318 }],
    ] as const) {
      expect(chase(from, -Infinity, to, -Infinity, "nabrzeze-0-1", 30), `(${from.x}, ${from.z}) → (${to.x}, ${to.z})`).not.toBeNull();
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

  it("gets from beside the bridge of podzamcze-1-0 onto it, not pressed against its side when no way's cell is a straight walk away (G-747)", () => {
    // At (772.7, 200.3), with no cell of the way a straight walk away, it walked at the way's next
    // cell over a bank its feet stop at, pressed against it for good; a cell further down the way
    // lay a straight walk away, 1.5 m aside.
    const D = BRIDGE_DECKS.get("podzamcze-1-0")![0]!;
    const len = Math.hypot(D.b.x - D.a.x, D.b.z - D.a.z);
    const u = { x: (D.b.x - D.a.x) / len, z: (D.b.z - D.a.z) / len };
    const at = (t: number, side: number): P => ({ x: D.a.x + u.x * len * t - u.z * side, z: D.a.z + u.z * len * t + u.x * side });
    expect(chase(at(0.8, 6), -Infinity, at(0.8, 0), Infinity, "podzamcze-1-0", 20, 0.3)).not.toBeNull();
  }, 120_000);

  it("gets from beside the lower bridge of Mełgiewska onto it, not sliding to and fro at the foot of a bank (G-763)", () => {
    // At (2449.4, 258.8), under the deck's edge 0.27 m high, and at (2454.7, 293.4), on a sheer
    // strip of the bank, the walk aimed at two cells in turn, each a slide along the foot away from
    // the other; a few decimetres aside the edge is 0.1 m and the bank a walk.
    const deck = (i: number) => {
      const D = BRIDGE_DECKS.get("nabrzeze-0-1")![i]!;
      const len = Math.hypot(D.b.x - D.a.x, D.b.z - D.a.z);
      const u = { x: (D.b.x - D.a.x) / len, z: (D.b.z - D.a.z) / len };
      return (t: number, side: number): P => ({ x: D.a.x + u.x * len * t - u.z * side, z: D.a.z + u.z * len * t + u.x * side });
    };
    for (const [i, t, side] of [
      [0, 0.85, 9.5],
      [1, 0.1, 8],
    ] as const) {
      const at = deck(i);
      expect(chase(at(t, side), -Infinity, at(t, 0), Infinity, "nabrzeze-0-1", 20, 0.3), `deck ${i} at ${t}, ${side} m aside`).not.toBeNull();
    }
  }, 120_000);

  it("gets from the foot of the wall of the western abutment of Mełgiewska's lower bridge onto it, not pressed against the wall (G-762)", () => {
    // At (2415.05, 280.24) its own cell closed, the walk set out from the cell beside it on the
    // wall, 3.4 m over the feet, and pressed against the wall until the stuck check sidestepped.
    const D = BRIDGE_DECKS.get("nabrzeze-0-1")![0]!;
    const len = Math.hypot(D.b.x - D.a.x, D.b.z - D.a.z);
    const u = { x: (D.b.x - D.a.x) / len, z: (D.b.z - D.a.z) / len };
    const to = { x: D.a.x + u.x * len * 0.1, z: D.a.z + u.z * len * 0.1 };
    expect(chase({ x: 2414.5, z: 280.1 }, -Infinity, to, Infinity, "nabrzeze-0-1", 20, 0.3, true)).not.toBeNull();
  }, 120_000);
});
