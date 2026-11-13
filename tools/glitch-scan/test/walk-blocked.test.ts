import { describe, expect, it } from "vitest";
import type { GroundSurface } from "../../../packages/core/src";
import { type WalkChunk, type WalkDeck, type WalkWorld, walkBlocked } from "./walk-blocked";

/**
 * The glitch scan's check `walk-blocked` (ADR-0080) on a chunk x 0..20, z 0..10: a bridge's deck
 * x 5..15, z 3..7 along x at y `deckY`, a street on the terrain along it (`street`), the terrain
 * at `terrain(x, z)` elsewhere.
 */

type Pt = { x: number; z: number };
const rect = (x0: number, z0: number, x1: number, z1: number) => [x0, z0, x1, z0, x1, z1, x0, z1];
const deck: WalkDeck = { ring: [{ x: 5, z: 3 }, { x: 15, z: 3 }, { x: 15, z: 7 }, { x: 5, z: 7 }], a: { x: 5, z: 5 }, b: { x: 15, z: 5 } };
const onDeck = (x: number, z: number) => x > 5 && x < 15 && z > 3 && z < 7;

interface Scene {
  readonly ground: readonly { surface: GroundSurface; outline: number[] }[];
  readonly terrain: (x: number, z: number) => number;
  readonly deckY?: number;
  readonly edge?: (a: Pt, b: Pt) => boolean;
  readonly decks?: (x: number, z: number) => boolean;
  readonly along?: (a: Pt, b: Pt) => boolean;
}

const scan = (s: Scene) => {
  const chunks: WalkChunk[] = [
    { id: "a", bounds: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, ground: s.ground },
    { id: "b", bounds: { minX: 10, maxX: 20, minZ: 0, maxZ: 10 }, ground: s.ground },
  ];
  const decks = s.decks ?? onDeck;
  const height = (x: number, z: number) => (s.deckY !== undefined && decks(x, z) ? Math.max(s.deckY, s.terrain(x, z)) : s.terrain(x, z));
  const world: WalkWorld = {
    height: () => height,
    deck: (x, z, y) => (s.deckY !== undefined && decks(x, z) && y === s.deckY ? deck : null),
    headroom: 2,
    edge: s.edge ?? (() => false),
    along: s.along ?? (() => true),
  };
  return walkBlocked(chunks, world);
};
const kinds = (found: { what: string }[]) => [...new Set(found.map((f) => f.what.replace(/^\S+ /, "").replace(/[-\d.]+/g, "#")))];

describe("walk-blocked (ADR-0080)", () => {
  it("finds nothing on level ground, nor on a slope a walker climbs", () => {
    expect(scan({ ground: [{ surface: "road", outline: rect(0, 0, 20, 10) }], terrain: () => 0 })).toEqual([]);
    expect(scan({ ground: [{ surface: "road", outline: rect(0, 0, 20, 10) }], terrain: (x) => 0.6 * x })).toEqual([]);
  });

  it("finds a bank steeper than tg 35° on a street, but not on a flight of steps", () => {
    const steep = (x: number) => 0.8 * x;
    expect(kinds(scan({ ground: [{ surface: "footway", outline: rect(0, 0, 20, 10) }], terrain: steep }))).toEqual(["steep # at #"]);
    expect(scan({ ground: [{ surface: "steps", outline: rect(0, 0, 20, 10) }], terrain: steep })).toEqual([]);
  });

  it("finds a ledge over 0.45 m up, or over 0.35 m down, once a pair, across a chunk's seam too", () => {
    const ledge = (h: number) => scan({ ground: [{ surface: "sidewalk", outline: rect(0, 0, 20, 10) }], terrain: (x) => (x < 10 ? 0 : h) });
    expect(ledge(0.3)).toEqual([]);
    const found = ledge(0.4);
    // One pair a row of cells across x = 10: 40 rows of 0.25 m.
    expect(found).toHaveLength(40);
    expect(found[0]).toEqual({ at: "10.00,0.13", what: "a step down 0.40 m, ground at 0.40" });
  });

  it("leaves out the edges the model means", () => {
    const wall = (x: number) => (x < 10 ? 0 : 1);
    expect(scan({ ground: [{ surface: "square", outline: rect(0, 0, 20, 10) }], terrain: wall, edge: (a, b) => a.x < 10 !== b.x < 10 })).toEqual([]);
  });

  it("finds the step at a deck's end onto a street, not the deck's sides over lower ground", () => {
    const ground = [
      { surface: "road" as const, outline: rect(0, 4, 20, 6) },
      { surface: "road" as const, outline: rect(5, 3, 15, 7) },
      { surface: "sidewalk" as const, outline: rect(5, 1, 15, 3) },
    ];
    // The deck at 0, the terrain 0.6 m under it all round: the street off its ends steps down, its sides drop to the sidewalk under.
    const found = scan({ ground, terrain: () => -0.6, deckY: 0 });
    expect(kinds(found)).toEqual(["ledge # m, deck end at #"]);
    expect(new Set(found.map((f) => f.at.split(",")[0]))).toEqual(new Set(["5.00", "15.00"]));
    expect(scan({ ground, terrain: () => -0.2, deckY: 0 })).toEqual([]);
  });

  it("leaves a deck over a way under it alone", () => {
    const ground = [
      { surface: "road" as const, outline: rect(5, 3, 15, 7) },
      { surface: "road" as const, outline: rect(0, 0, 20, 3) },
      { surface: "road" as const, outline: rect(0, 7, 20, 10) },
    ];
    expect(scan({ ground, terrain: () => -5, deckY: 0 })).toEqual([]);
  });

  it("finds a slot between two decks of a bridge the walker falls through (G-340)", () => {
    const ground = [
      { surface: "road" as const, outline: rect(5, 3, 15, 4.5) },
      { surface: "sidewalk" as const, outline: rect(5, 5, 15, 7) },
    ];
    const slot = (x: number, z: number) => onDeck(x, z) && (z < 4.5 || z > 5);
    const found = scan({ ground, terrain: () => -3, deckY: 0, decks: slot });
    expect(kinds(found)).toEqual(["ledge # m, slot between decks at #"]);
    // The decks touching: no slot.
    expect(scan({ ground: [ground[0]!, { surface: "sidewalk", outline: rect(5, 4.5, 15, 7) }], terrain: () => -3, deckY: 0 })).toEqual([]);
  });

  it("keeps the heights a cell past the east seam apart from the next row's west ones", () => {
    // The east neighbour of a pair's cell over the seam (x 10.375) is two cells past the chunk; its
    // height once read the cache's place of the next row's west neighbour (x -0.125), here 0.3 higher.
    const found = scan({ ground: [{ surface: "footway", outline: rect(0, 0, 20, 10) }], terrain: (x) => (x < 0 ? 0.6 : x < 10 ? 0 : 0.3) });
    expect(found.filter((f) => Math.abs(Number(f.at.split(",")[0]) - 10) < 1)).toEqual([]);
  });

  it("leaves the ground off the map out of a cell's slope (A: groundY is 0 there)", () => {
    // The map's ground from -0.3 sloping 0.2 down north; past its south edge (z < 0) `groundY` gives 0,
    // within a step of the edge's cells: taken in, their slope came out 0.75.
    const terrain = (_x: number, z: number) => (z < 0 ? 0 : -0.3 - 0.2 * z);
    expect(scan({ ground: [{ surface: "footway", outline: rect(0, 0, 20, 10) }], terrain })).toEqual([]);
    // A bank on the map at its edge is still one.
    expect(kinds(scan({ ground: [{ surface: "footway", outline: rect(0, 0, 20, 10) }], terrain: (x, z) => (z < 0 ? 0 : 0.8 * x) }))).toEqual(["steep # at #"]);
  });

  it("counts a blocked pair along a way blocked there itself, not across a bank beside a way (C)", () => {
    const steep = { ground: [{ surface: "footway" as const, outline: rect(0, 0, 20, 10) }], terrain: (x: number) => 0.8 * x };
    const found = scan({ ...steep, along: (a, b) => (a.z + b.z) / 2 < 2 });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((f) => Number(f.at.split(",")[1]) < 2)).toBe(true);
    expect(scan({ ...steep, along: () => false })).toEqual([]);
  });
});
