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
 * floor under them for `reach` (the terrain under a deck, the deck on it; the brawler for
 * `fromReach`, by default the same). How long it takes to
 * get within reach of the player on its floor, or null within `seconds`; the lowest its feet go below the
 * deck while over the deck's outline.
 */
const chase = (from: P, target: P, reach: number, seconds = 10, fromReach = reach) => {
  const sim = Simulation.create({ seed: 3 });
  teleportPlayer(sim, { x: target.x, y: 0, z: target.z });
  sim.step();
  const ground = sim.streamer.ground;
  const p = sim.player()!;
  p.position = { x: target.x, y: ground.heightAt(target.x, target.z, reach), z: target.z };
  p.prevPosition = p.position;
  const g = gangerEntity(9001, { key: "g068-brawler", position: { x: from.x, y: ground.heightAt(from.x, from.z, fromReach), z: from.z }, yaw: 0 }, null, 200, "nabrzeze-0-1", undefined, "hebi_brawler");
  g.ai!.alerted = true;
  sim.world.add(g);
  let drop = 0;
  for (let i = 0; i < 60 * seconds; i++) {
    sim.step();
    const deck = ground.heightAt(g.position.x, g.position.z);
    if (deck > ground.heightAt(g.position.x, g.position.z, -Infinity)) drop = Math.max(drop, deck - g.position.y);
    // On the player's floor: over the player on the deck is no reach (G-072).
    if (Math.abs(g.position.y - p.position.y) < 1 && Math.hypot(g.position.x - p.position.x, g.position.z - p.position.z) < 2.5) return { at: i / 60, drop };
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

  it("an alerted brawler on the deck over the path comes down off its end to the player under it in < 20 s (G-072)", () => {
    expect(chase(onDeck(0.3), UNDER, -Infinity, 20, Infinity).at).not.toBeNull();
  });

  it("and one on the street by the bridge's end goes down to the path, not onto the deck over the player (G-072)", () => {
    expect(chase({ x: 2461, z: 302.2 }, UNDER, -Infinity, 20, Infinity).at).not.toBeNull();
  });

  it("an alerted brawler on the path under the deck goes up off its end to the player on it over him in < 20 s (G-885)", () => {
    // Not to the ground under the player, nor to and fro by the deck's edge at (2449.6, 298.9).
    expect(chase(UNDER, { x: 2444.9, z: 307.5 }, Infinity, 20, -Infinity).at).not.toBeNull();
  });

  it("an alerted brawler on the viaduct of Zamkowa comes down to the player on Podwale under it (G-072)", () => {
    expect(chase({ x: 748.9, z: 173.4 }, { x: 745, z: 169.8 }, -Infinity, 20, Infinity).at).not.toBeNull();
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

  it("a brawler off the viaduct of Zamkowa crosses it on the deck after a player beyond its far end", () => {
    const zamkowa = BRIDGE_DECKS.get("stare-miasto-1-1")![0]!;
    const len = Math.hypot(zamkowa.b.x - zamkowa.a.x, zamkowa.b.z - zamkowa.a.z);
    const u = { x: (zamkowa.b.x - zamkowa.a.x) / len, z: (zamkowa.b.z - zamkowa.a.z) / len };
    for (const s of [3, 10]) {
      const from = { x: zamkowa.a.x - u.x * s, z: zamkowa.a.z - u.z * s };
      const to = { x: zamkowa.b.x + u.x * s, z: zamkowa.b.z + u.z * s };
      const { at, drop } = chase(from, to, Infinity, 20);
      expect(at).not.toBeNull();
      expect(drop).toBeLessThan(0.3);
    }
  });

  // The tunnel's mouths, NE and SW of Zamkowa's deck 3.3 m over the footway: both ends off the deck.
  const [ne, sw] = [{ x: 787, z: 193.5 }, { x: 775.5, z: 204 }];
  for (const [way, from, to] of [
    ["NE to SW", ne, sw],
    ["SW to NE", sw, ne],
    ["aslant", { x: 792, z: 190 }, { x: 772, z: 208 }],
  ] as const) {
    it(`a brawler chases the player through the footway's tunnel under Zamkowa's deck, ${way} (G-088)`, () => {
      expect(chase(from, to, -Infinity).at).not.toBeNull();
    });
  }
});
