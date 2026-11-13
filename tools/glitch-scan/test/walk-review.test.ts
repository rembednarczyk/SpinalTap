import { describe, expect, it } from "vitest";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { type WalkChunk, type WalkWorld, inChunks, walkBlocked } from "./walk-blocked";
import { distanceToBarrier } from "../../../packages/sim/src/content/lublin/barriers";
import { WORLD_BARRIERS } from "../../../packages/sim/src/content/world-barriers";
import { BARRIER_CLEAR, CITY_WALK_WORLD, onAlchemia } from "./walk-world";

/**
 * The curator's review of `walk-blocked` (ADR-0080 PR 4): of 20 squares drawn from its keys, 17
 * were no glitch. Each 10 m square is scanned with the eight round it (a pair over its side is
 * the next square's, as in the scan's keys), on the city's own world.
 */

const WORLD = CITY_WALK_WORLD;
const ON_MAP = inChunks(MAP_CHUNKS);

/** `walk-blocked`'s pairs in the square of corner `sq` ("x,z"), on `world`, with the map's edge `onMap`. */
const pairsIn = (sq: string, world: WalkWorld = WORLD, onMap = ON_MAP) => {
  const [x0, z0] = sq.split(",").map(Number) as [number, number];
  const chunks: WalkChunk[] = [];
  for (const dx of [-10, 0, 10]) {
    for (const dz of [-10, 0, 10]) {
      const [x, z] = [x0 + dx, z0 + dz];
      const owner = MAP_CHUNKS.find(({ bounds: b }) => x + 5 > b.minX && x + 5 < b.maxX && z + 5 > b.minZ && z + 5 < b.maxZ);
      if (owner) chunks.push({ id: owner.id, bounds: { minX: x, maxX: x + 10, minZ: z, maxZ: z + 10 }, ground: owner.ground });
    }
  }
  return walkBlocked(chunks, world, onMap).filter((f) => {
    const [x, z] = f.at.split(",").map(Number) as [number, number];
    return Math.floor(x / 10) * 10 === x0 && Math.floor(z / 10) * 10 === z0;
  });
};

describe("walk-blocked after the curator's review (ADR-0080 PR 4)", () => {
  it("A: takes no slope from past the map's edge, where groundY is 0", () => {
    expect(pairsIn("140,-270")).toEqual([]);
    // The ground past the map's edge taken for the map's (the scan before the review): the pairs come back.
    expect(pairsIn("140,-270", WORLD, () => true).length).toBeGreaterThan(0);
  });

  it("B: leaves Alchemia's terraces and the Hebi hollow to the model (T-186, T-217)", () => {
    const noEdge = { ...WORLD, edge: () => false };
    for (const sq of ["440,80", "450,100", "460,110"]) {
      expect(pairsIn(sq), sq).toEqual([]);
      const back = pairsIn(sq, noEdge);
      expect(back.length, sq).toBeGreaterThan(0);
      expect(back.every((f) => onAlchemia({ x: Number(f.at.split(",")[0]), z: Number(f.at.split(",")[1]) })), sq).toBe(true);
    }
  });

  it("B: leaves T-147's niche with 0.5 m round it to the model", () => {
    const rim = (f: { at: string }) => {
      const [x, z] = f.at.split(",").map(Number) as [number, number];
      return x >= 728 && x <= 735.6 && z >= 157 && z <= 164.3;
    };
    expect(pairsIn("720,150").filter(rim)).toEqual([]);
    expect(pairsIn("720,150", { ...WORLD, edge: () => false }).filter(rim).length).toBeGreaterThan(0);
  });

  it("B: takes the ground within 0.6 m of a barrier for its edge", () => {
    const item = Object.values(WORLD_BARRIERS).flat().find((b) => Number.isFinite(distanceToBarrier(b, b.x, b.z)))!;
    // Out across the piece until 0.5 m off it.
    let t = 0;
    while (distanceToBarrier(item, item.x + t * Math.cos(item.yaw), item.z - t * Math.sin(item.yaw)) < BARRIER_CLEAR - 0.1) t += 0.01;
    const [x, z] = [item.x + t * Math.cos(item.yaw), item.z - t * Math.sin(item.yaw)];
    expect(WORLD.edge({ x: x - 0.125, z }, { x: x + 0.125, z })).toBe(true);
  });
});
