import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LUBLIN_CHUNKS } from "../../../packages/sim/src/content/lublin";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import { REPO } from "../src/paths.ts";
import { loadNodeTags } from "../src/props-art.ts";
import { type BoardSpan, LANTERN, boardBehind, offBoards } from "../src/props-boards.ts";
import { type PropsPlan, generateProps } from "../src/props-gen.ts";
import { Site } from "../src/props-site.ts";
import { lublinVenueBoards } from "../src/venue-boards.ts";

/** A 100 x 60 m flat chunk: a pavement on z 22..38 and a row of houses north of it, its south wall on z = 38. */
const street = (): LublinChunkData => ({
  id: "test-0-0",
  district: "kanal",
  bounds: { minX: 0, maxX: 100, minZ: 0, maxZ: 60 },
  terrain: { originX: 0, originZ: 0, cell: 50, cols: 3, rows: 2, heights: [0, 0, 0, 0, 0, 0] },
  buildings: [{ id: "w1", x: 50, z: 45, y: 0, outline: [-50, -7, 50, -7, 50, 7, -50, 7], parts: [], height: 12, plinth: 0, levels: 3, use: "residential", look: 1, source: "default" }],
  ground: [{ surface: "sidewalk", outline: [0, 22, 100, 22, 100, 38, 0, 38] }],
  streets: [{ name: "Testowa", kind: "pedestrian", line: [0, 30, 100, 30] }],
  markings: [],
  pois: [],
});

/** A board on the houses' south wall from x0 to x1, at the venues' height. */
const board = (x0: number, x1: number, wallFrom = 0, wallTo = 100): BoardSpan => ({
  a: { x: x0, z: 38 },
  b: { x: x1, z: 38 },
  nx: 0,
  nz: -1,
  bottom: 3.5,
  top: 4.3,
  wallA: { x: wallFrom, z: 38 },
  wallB: { x: wallTo, z: 38 },
  text: "TEST",
});

const inBuilding = (site: Site) => (q: { x: number; z: number }) => site.surfaceAt(q) === "building";
/** Out from the houses' south wall. */
const SOUTH = { x: 0, z: -1 };
const south = () => SOUTH;
/** The way a piece faces, from its yaw. */
const facing = (i: { readonly yaw: number }) => ({ x: Math.sin(i.yaw), z: Math.cos(i.yaw) });
/** An arm turned along the wall, eastwards (the verifier's NIEZWYKŁA KUCHNIA, yaw −0.32 off its wall). */
const ASKEW = { x: 0.95, z: -0.31 };

describe("wall lanterns off the venues' boards (G-158)", () => {
  it("finds the board a lantern hangs in front of, at its height and along it", () => {
    const boards = [board(40, 45)];
    expect(boardBehind(boards, { x: 42, z: 37.7 }, 0, SOUTH)?.text).toBe("TEST");
    expect(boardBehind(boards, { x: 45.1, z: 37.7 }, 0, SOUTH)?.text).toBe("TEST");
    expect(boardBehind(boards, { x: 46, z: 37.7 }, 0, SOUTH)).toBeNull();
    // Hung higher or lower than the board, or out on the pavement: nothing to hide.
    expect(boardBehind(boards, { x: 42, z: 37.7 }, 2, SOUTH)).toBeNull();
    expect(boardBehind(boards, { x: 42, z: 37.7 }, -3, SOUTH)).toBeNull();
    expect(boardBehind(boards, { x: 42, z: 35 }, 0, SOUTH)).toBeNull();
  });

  it("counts a lantern whose arm runs along the wall onto the board", () => {
    const boards = [board(40, 45)];
    const p = { x: 39.4, z: 37.7 };
    expect(boardBehind(boards, p, 0, SOUTH)).toBeNull();
    expect(boardBehind(boards, p, 0, ASKEW)?.text).toBe("TEST");
  });

  it("slides a lantern along the wall past the board's nearer end, or the other one", () => {
    const site = new Site([street()]);
    const near = offBoards([board(40, 45)], { x: 44, z: 37.7 }, 0, south, inBuilding(site))!;
    expect(near.z).toBeCloseTo(37.7, 5);
    expect(near.x).toBeGreaterThanOrEqual(45 + LANTERN.half + 0.3);
    expect(near.x).toBeLessThan(46);
    // The wall ends just past the board's east end: the lantern goes west.
    const west = offBoards([board(40, 45, 0, 45.3)], { x: 44, z: 37.7 }, 0, south, inBuilding(site))!;
    expect(west.x).toBeLessThanOrEqual(40 - LANTERN.half - 0.3);
    expect(boardBehind([board(40, 45)], west, 0, SOUTH)).toBeNull();
    // An arm along the wall: slid until the lantern at its end clears the board too.
    const askew = offBoards([board(40, 45)], { x: 39.4, z: 37.7 }, 0, () => ASKEW, inBuilding(site))!;
    expect(askew.x).toBeLessThan(39.4);
    expect(boardBehind([board(40, 45)], askew, 0, ASKEW)).toBeNull();
    // Clear of every board: left where it is.
    const free = { x: 20, z: 37.7 };
    expect(offBoards([board(40, 45)], free, 0, south, inBuilding(site))).toBe(free);
  });

  it("drops a lantern with no wall or no free wall beside the board", () => {
    const site = new Site([street()]);
    expect(offBoards([board(40, 45, 39.8, 45.2)], { x: 42, z: 37.7 }, 0, south, inBuilding(site))).toBeNull();
    // Boards on both sides of the one behind it.
    expect(offBoards([board(40, 45), board(45.4, 50), board(35, 39.6)], { x: 42, z: 37.7 }, 0, south, inBuilding(site))).toBeNull();
    // Past the house's end there is no wall to hang on.
    expect(offBoards([board(96, 100, 96, 105)], { x: 99, z: 37.7 }, 0, south, inBuilding(site))).toBeNull();
  });

  it("hangs a wall lantern square out from its wall, whatever the line it came from", () => {
    const site = new Site([street()]);
    const away = site.awayFromWall({ x: 42, z: 37.7 })!;
    expect(away.x).toBeCloseTo(0, 5);
    expect(away.z).toBeCloseTo(-1, 5);
    expect(site.awayFromWall({ x: 42, z: 30 })).toBeNull();
    // A line slanting across the street: its lanterns still face square off the houses.
    const plan: PropsPlan = { items: [{ id: "t.lanterns", kind: "lamp-wall-lantern", line: [0, 27, 100, 33], spacing: 10 }] };
    const lanterns = generateProps(plan, [street()]).byChunk.get("test-0-0")!.filter((i) => i.prop === "lamp-wall-lantern" && i.z > 30);
    expect(lanterns.length).toBeGreaterThan(3);
    for (const l of lanterns) expect(Math.abs(Math.cos(l.yaw) + 1)).toBeLessThan(1e-3);
  });

  it("keeps the generated lanterns of a facade line off a board on it", () => {
    const plan: PropsPlan = { items: [{ id: "t.lanterns", kind: "lamp-wall-lantern", line: [0, 30, 100, 30], spacing: 10 }] };
    const boards = [board(23, 30)];
    const without = generateProps(plan, [street()]).byChunk.get("test-0-0")!.filter((i) => i.prop === "lamp-wall-lantern" && i.z > 30);
    expect(without.some((i) => boardBehind(boards, i, i.y, facing(i)))).toBe(true);
    const out = generateProps(plan, [street()], new Map(), boards);
    const lanterns = out.byChunk.get("test-0-0")!.filter((i) => i.prop === "lamp-wall-lantern" && i.z > 30);
    expect(lanterns.length).toBe(without.length);
    expect(lanterns.filter((i) => boardBehind(boards, i, i.y, facing(i)))).toEqual([]);
    expect(out.stats.offBoard).toBe(1);
  });

  it("leaves no lantern of Lublin in front of a venue's board", () => {
    const plan = JSON.parse(readFileSync(join(REPO, "docs/world/lublin-props.todo.json"), "utf8")) as PropsPlan;
    const boards = lublinVenueBoards();
    expect(boards.length).toBeGreaterThan(250);
    const { byChunk, stats } = generateProps(plan, LUBLIN_CHUNKS, loadNodeTags(), boards);
    const lanterns = [...byChunk.values()].flat().filter((i) => i.prop === "lamp-wall-lantern");
    expect(lanterns.filter((i) => boardBehind(boards, i, i.y, facing(i))).map((i) => `${i.x},${i.z}`)).toEqual([]);
    expect(stats.offBoard).toBeGreaterThan(10);
    expect(stats.onBoard).toBeLessThanOrEqual(2);
  });
});
