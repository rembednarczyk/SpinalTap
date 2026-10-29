import { type GroundPoint, type TerrainGrid, type Vec3, terrainHeightAt } from "@seki/core";
import { type ChunkDef, Simulation, type StaticProp } from "../src";
import { teleportPlayer } from "./helpers";

/**
 * A small test world for ADR-0043: two chunks meeting at x = 0, each with its own terrain
 * sampled from one height function (so the seam agrees), on a regular grid of `cell` metres.
 *
 * - A slope rising 20 m over 200 m to the north (z 0..200), about 5.7°.
 * - A bank east of x = 80: 8 m up over 4 m (63°), then a plateau.
 * - West of x = -40, a ridge 3 m high along z = -20 (half width 4 m).
 * - A 10 × 6 m building at (30, 60) turned by 17°, given by its outline (one prism).
 * - An L-shaped building split into two prisms: a bar x -30..-10, z 100..106 and a leg
 *   x -30..-24, z 106..126.
 */
export const hill = (x: number, z: number): number => {
  const slope = 20 * Math.min(1, Math.max(0, z / 200));
  const bank = 8 * Math.min(1, Math.max(0, (x - 80) / 4));
  const ridge = x < -40 ? 3 * Math.max(0, 1 - Math.abs(z + 20) / 4) : 0;
  return slope + bank + ridge;
};

export const BOUNDS = { minX: -150, maxX: 150, minZ: -50, maxZ: 250 } as const;

export const gridOf = (originX: number, originZ: number, cell: number, cols: number, rows: number, h: (x: number, z: number) => number): TerrainGrid => {
  const heights: number[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) heights.push(h(originX + c * cell, originZ + r * cell));
  return { originX, originZ, cell, cols, rows, heights };
};

/** Lowest terrain under an outline: where a building on a slope stands. */
const baseUnder = (grid: TerrainGrid, pts: readonly GroundPoint[]): number => Math.min(...pts.map((p) => terrainHeightAt(grid, p.x, p.z)));

const turned = (w: number, d: number, deg: number): GroundPoint[] => {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ].map(([x = 0, z = 0]) => ({ x: x * c - z * s, z: x * s + z * c }));
};

export const TURNED_AT = { x: 30, z: 60 } as const;
export const TURNED_OUTLINE = turned(10, 6, 17);

const rect = (x0: number, x1: number, z0: number, z1: number, cx: number, cz: number): GroundPoint[] => [
  { x: x0 - cx, z: z0 - cz },
  { x: x1 - cx, z: z0 - cz },
  { x: x1 - cx, z: z1 - cz },
  { x: x0 - cx, z: z1 - cz },
];

/** The two chunks of the test world, on a grid of `cell` metres. */
export const testChunks = (cell = 2): ChunkDef[] => {
  const cols = Math.round(150 / cell) + 1;
  const rows = Math.round(300 / cell) + 1;
  const west = gridOf(-150, -50, cell, cols, rows, hill);
  const east = gridOf(0, -50, cell, cols, rows, hill);
  const world = (p: GroundPoint, at: { x: number; z: number }) => ({ x: p.x + at.x, z: p.z + at.z });
  const turnedBase = baseUnder(east, TURNED_OUTLINE.map((p) => world(p, TURNED_AT)));
  const turnedBuilding: StaticProp = {
    center: { x: TURNED_AT.x, y: turnedBase, z: TURNED_AT.z },
    view: { kind: "building", outline: TURNED_OUTLINE, height: 12, levels: 4, use: "residential", look: 1 },
    solid: true,
  };
  const lAt = { x: -20, z: 113 };
  const lOutline: GroundPoint[] = [
    { x: -30, z: 100 },
    { x: -10, z: 100 },
    { x: -10, z: 106 },
    { x: -24, z: 106 },
    { x: -24, z: 126 },
    { x: -30, z: 126 },
  ].map((p) => ({ x: p.x - lAt.x, z: p.z - lAt.z }));
  const lBase = baseUnder(west, lOutline.map((p) => world(p, lAt)));
  const lBuilding: StaticProp = {
    center: { x: lAt.x, y: lBase, z: lAt.z },
    view: { kind: "building", outline: lOutline, height: 15, levels: 5, use: "commercial", look: 2 },
    solid: true,
    prisms: [
      { points: rect(-30, -10, 100, 106, lAt.x, lAt.z), bottom: 0, top: 15 },
      { points: rect(-30, -24, 106, 126, lAt.x, lAt.z), bottom: 0, top: 15 },
    ],
  };
  return [
    { id: "test-west", district: "shinsekai-7", bounds: { ...BOUNDS, maxX: 0 }, props: [lBuilding], actors: [], terrain: west },
    { id: "test-east", district: "shinsekai-7", bounds: { ...BOUNDS, minX: 0 }, props: [turnedBuilding], actors: [], terrain: east },
  ];
};

/** A new game in the test world with the player at `at` on the ground, after one step to load the chunks. */
export const terrainSim = (at: { x: number; z: number }, yaw = 0, cell = 2, seed = 5): Simulation => {
  const sim = Simulation.create({ seed, chunks: testChunks(cell) });
  const p: Vec3 = { x: at.x, y: hill(at.x, at.z), z: at.z };
  teleportPlayer(sim, p, yaw);
  sim.step();
  return sim;
};
