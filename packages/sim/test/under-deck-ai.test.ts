import { describe, expect, it } from "vitest";
import { Simulation, gangerEntity } from "../src";
import { BRIDGE_DECKS } from "../src/content/lublin/decks";
import { deckHeight } from "../src/world/deck";
import { teleportPlayer } from "./helpers";

type P = { readonly x: number; readonly z: number };

/** The embankment path w307943890 (OSM) under the lower bridge of Mełgiewska. */
const UNDER = { x: 2445.9, z: 302.2 };
/** The lower bridge of Mełgiewska, its first carriageway: over the embankment path, then the river. */
const DECK = BRIDGE_DECKS.get("nabrzeze-0-1")![1]!;
const onDeck = (t: number): P => ({ x: DECK.a.x + (DECK.b.x - DECK.a.x) * t, z: DECK.a.z + (DECK.b.z - DECK.a.z) * t });

/**
 * An alerted brawler (ADR-0021) at `from` after the player at `target`, both standing on the
 * floor under them for `reach` (the terrain under a deck, the deck on it). How long it takes to
 * get within reach of the player, or null within `seconds`; the lowest its feet go below the
 * deck while over the deck's outline.
 */
const chase = (from: P, target: P, reach: number, seconds = 10) => {
  const sim = Simulation.create({ seed: 3 });
  teleportPlayer(sim, { x: target.x, y: 0, z: target.z });
  sim.step();
  const ground = sim.streamer.ground;
  const p = sim.player()!;
  p.position = { x: target.x, y: ground.heightAt(target.x, target.z, reach), z: target.z };
  p.prevPosition = p.position;
  const g = gangerEntity(9001, { key: "g068-brawler", position: { x: from.x, y: ground.heightAt(from.x, from.z, reach), z: from.z }, yaw: 0 }, null, 200, "nabrzeze-0-1", undefined, "hebi_brawler");
  g.ai!.alerted = true;
  sim.world.add(g);
  let drop = 0;
  for (let i = 0; i < 60 * seconds; i++) {
    sim.step();
    const deck = ground.heightAt(g.position.x, g.position.z);
    if (deck > ground.heightAt(g.position.x, g.position.z, -Infinity)) drop = Math.max(drop, deck - g.position.y);
    if (Math.hypot(g.position.x - p.position.x, g.position.z - p.position.z) < 2.5) return { at: i / 60, drop };
  }
  return { at: null, drop };
};

describe("NPCs and the way under a bridge's deck (G-068, ADR-0053)", () => {
  it("an alerted brawler reaches the player under the lower bridge of Mełgiewska from the south", () => {
    expect(chase({ x: 2449, z: 318 }, UNDER, -Infinity).at).not.toBeNull();
  });

  it("and from the north, along the embankment path", () => {
    expect(chase({ x: 2443.6, z: 286 }, UNDER, -Infinity).at).not.toBeNull();
  });

  it("a brawler under the bridge follows the player out of it, to the south and to the north", () => {
    const from = { x: 2446.5, z: 306 };
    expect(chase(from, { x: 2449, z: 330 }, -Infinity).at).not.toBeNull();
    expect(chase(from, { x: 2443.6, z: 286 }, -Infinity).at).not.toBeNull();
  });

  it("a brawler on the deck chases the player along the deck and stays on it over the way under", () => {
    for (const [from, to] of [
      [onDeck(0.25), onDeck(0.6)],
      [onDeck(0.6), onDeck(0.2)],
    ] as const) {
      expect(deckHeight(DECK, from.x, from.z)).toBeGreaterThan(-28);
      const { at, drop } = chase(from, to, Infinity);
      expect(at).not.toBeNull();
      expect(drop).toBeLessThan(0.3);
    }
  });
});
