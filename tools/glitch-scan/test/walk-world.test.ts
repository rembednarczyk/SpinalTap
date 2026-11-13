import { describe, expect, it } from "vitest";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { groundY } from "../../../packages/sim/src/content/lublin/terrain";
import { BRIDGE_DECKS, bridgeDeckAt } from "../../../packages/sim/src/content/lublin/decks";
import { CITY_WALK_WORLD } from "./walk-world";

/** `walk-blocked` reads the game's own ground: its chunk-at-a-time heights are `groundY`'s. */
describe("the city as walk-blocked reads it", () => {
  it("has groundY's heights in every chunk, on and off the bridges", () => {
    const decks = [...BRIDGE_DECKS.values()].flat();
    const points = [
      ...MAP_CHUNKS.flatMap((c) => [0.13, 0.5, 0.87].map((t) => ({ c, x: c.bounds.minX + t * (c.bounds.maxX - c.bounds.minX), z: c.bounds.minZ + (1 - t) * (c.bounds.maxZ - c.bounds.minZ) }))),
      ...decks.map((d) => ({ c: MAP_CHUNKS.find((c) => d.a.x >= c.bounds.minX && d.a.x <= c.bounds.maxX && d.a.z >= c.bounds.minZ && d.a.z <= c.bounds.maxZ), x: (d.box.minX + d.box.maxX) / 2, z: (d.box.minZ + d.box.maxZ) / 2 })),
    ];
    let checked = 0;
    for (const { c, x, z } of points) {
      if (!c) continue;
      expect(CITY_WALK_WORLD.height(c)(x, z)).toBeCloseTo(groundY(x, z), 9);
      checked++;
    }
    expect(checked).toBeGreaterThan(MAP_CHUNKS.length * 3);
  });

  it("knows the deck that is the ground", () => {
    const d = [...BRIDGE_DECKS.values()].flat().find((e) => {
      const [x, z] = [(e.a.x + e.b.x) / 2, (e.a.z + e.b.z) / 2];
      return bridgeDeckAt(x, z) !== null && bridgeDeckAt(x, z) === groundY(x, z);
    })!;
    const [x, z] = [(d.a.x + d.b.x) / 2, (d.a.z + d.b.z) / 2];
    expect(CITY_WALK_WORLD.deck(x, z, groundY(x, z))).not.toBeNull();
    expect(CITY_WALK_WORLD.deck(x, z, groundY(x, z) - 1)).toBeNull();
  });
});
