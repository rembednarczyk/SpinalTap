import { describe, expect, it } from "vitest";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { groundY } from "../../../packages/sim/src/content/lublin/terrain";
import { BRIDGE_DECKS, bridgeDeckAt } from "../../../packages/sim/src/content/lublin/decks";
import { ARKADY_PAVEMENT, arkadyLocal, arkadyPoint } from "../../../packages/sim/src/content/alchemia/arkady";
import { inBuilding } from "../../../packages/sim/src/content/lublin/places";
import { floorOver } from "./scene-solids";
import { inChunks, walkBlocked } from "./walk-blocked";
import { cityWalkWorld } from "./walk-world";

const CITY_WALK_WORLD = cityWalkWorld([]);

/** `walk-blocked` reads the game's own ground: its chunk-at-a-time heights are `groundY`'s, raised onto the scenes' solids (`floorOver`). */
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
      expect(CITY_WALK_WORLD.height(c)(x, z)).toBeCloseTo(floorOver(x, z, groundY(x, z)), 9);
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

/** The Arkady's pavement slabs and landing (`arkady.ts`): the ground lowered under them is not what a walker walks there (G-759). */
describe("the Arkady's slabs as walk-blocked reads them (G-759)", () => {
  const chunkOf = (x: number, z: number) => MAP_CHUNKS.find((c) => x > c.bounds.minX && x < c.bounds.maxX && z > c.bounds.minZ && z < c.bounds.maxZ)!;
  /** The slab (x, z) lies on, in the building's frame, or -1. */
  const slabAt = (x: number, z: number) => {
    const { a, c } = arkadyLocal(x, z);
    return ARKADY_PAVEMENT.findIndex(({ box: b }) => a >= b.x0 && a <= b.x1 && c >= b.z0 && c <= b.z1);
  };

  it("walks the slabs' tops, not the terrain under them", () => {
    let sunk = 0;
    for (const { box: b } of ARKADY_PAVEMENT) {
      const { x, z } = arkadyPoint((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
      expect(CITY_WALK_WORLD.height(chunkOf(x, z))(x, z)).toBeCloseTo(b.y1, 6);
      if (groundY(x, z) < b.y1 - 0.05) sunk++;
    }
    // The case of the glitch: the terrain lies under the slabs' tops.
    expect(sunk).toBeGreaterThan(0);
  });

  it("finds no blocked pair on the slabs, Alchemia's zone not excused", () => {
    const ids = new Set(ARKADY_PAVEMENT.flatMap(({ box: b }) => [arkadyPoint(b.x0, b.z0), arkadyPoint(b.x1, b.z1)].map((p) => chunkOf(p.x, p.z).id)));
    const chunks = MAP_CHUNKS.filter((c) => ids.has(c.id));
    // Every pair counted, no edge meant: what is left is the heights alone.
    const found = walkBlocked(chunks, { ...CITY_WALK_WORLD, edge: () => false, along: () => true }, inChunks(MAP_CHUNKS));
    // A pair with both cells and their slopes' neighbours on one slab, half a metre round its
    // middle: a ledge between two slabs is the slabs' own, not the terrain's under them.
    const under = found.filter((f) => {
      const [x, z] = f.at.split(",").map(Number) as [number, number];
      const k = slabAt(x, z);
      return k >= 0 && [-0.5, 0.5].every((dx) => [-0.5, 0.5].every((dz) => slabAt(x + dx, z + dz) === k));
    });
    expect(under.map((f) => `${f.at} ${f.what}`)).toEqual([]);
  });
});

/** A map building is no floor (the review of G-778): its roof is not walked onto from the street. */
describe("the map's buildings as walk-blocked reads them (G-759)", () => {
  const chunk = MAP_CHUNKS.find((c) => c.id === "stare-miasto-0-1")!;

  it("takes no roof of a map building for the ground in its outline", () => {
    // The building north of the Arkady, y -9.1..-2.3.
    expect(inBuilding(468, 124.2)).toBe(true);
    expect(CITY_WALK_WORLD.height(chunk)(468, 124.2)).toBeCloseTo(groundY(468, 124.2), 9);
  });

  it("finds no pair from a building's roof to the street by it, no edge excused", () => {
    const found = walkBlocked([chunk], { ...CITY_WALK_WORLD, edge: () => false, along: () => true }, inChunks(MAP_CHUNKS));
    const height = CITY_WALK_WORLD.height(chunk);
    // The pair's cells: a pair along x has its middle on the raster's lines of x (a multiple of 0.25 m).
    const across = found.filter((f) => {
      const [x, z] = f.at.split(",").map(Number) as [number, number];
      const alongX = Math.abs(x * 4 - Math.round(x * 4)) < 1e-6;
      const [a, b] = alongX ? [{ x: x - 0.125, z }, { x: x + 0.125, z }] : [{ x, z: z - 0.125 }, { x, z: z + 0.125 }];
      const [hi, lo] = height(a.x, a.z) > height(b.x, b.z) ? [a, b] : [b, a];
      return inBuilding(hi.x, hi.z) && !inBuilding(lo.x, lo.z) && height(hi.x, hi.z) - height(lo.x, lo.z) > 2;
    });
    expect(across.map((f) => `${f.at} ${f.what}`)).toEqual([]);
  });
});
