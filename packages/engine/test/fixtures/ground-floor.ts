import type { GroundSurface, RoadMarkingKind, TerrainGrid, Vec3 } from "@seki/core";
import type { GroundHole } from "../../src/renderer/mapcity/ground-cut";
import type { Box2, P2 } from "../../src/renderer/mapcity/polygon";

/**
 * The ground golden's floor (decision of 16.11, ADR-0088): a small town square of its own, far
 * outside the city (about x, z = -2048; the city is x -200..2700, z -270..580), so no table of
 * Lublin and no content of the map reaches it. It holds what the four chunks of Lublin gave the
 * test before: paving over paving (setts across a square, a square and a footway inside it, a
 * lawn), kerbs (sidewalks along a carriageway split by a zebra, road markings on it), a fountain,
 * a flight of steps down a river's bank, the river itself, a rail strip, a footbridge's deck over
 * the river and the map's edge at the terrain's end. Its corner (0; 0) is a corner of four of the
 * map city's 128 m cells, so pieces lie in four cells and cross their edges. Shafts (`FLOOR_SHAFTS`)
 * are cut out of the ground as the metro's are. Changing the floor changes the golden hash in
 * `map-ground-golden.test.ts`; the map's content never does.
 */

/** Where the floor's own coordinates stand in the world: a corner of four map cells. */
export const FLOOR_PLACE = { x: -2048, z: -2048 } as const;

const at = (x: number, z: number): P2 => ({ x: FLOOR_PLACE.x + x, z: FLOOR_PLACE.z + z });

const rect = (x0: number, z0: number, x1: number, z1: number): P2[] => [at(x0, z0), at(x1, z0), at(x1, z1), at(x0, z1)];

const box = (x0: number, z0: number, x1: number, z1: number): Box2 => ({ minX: FLOOR_PLACE.x + x0, maxX: FLOOR_PLACE.x + x1, minZ: FLOOR_PLACE.z + z0, maxZ: FLOOR_PLACE.z + z1 });

/** The ground's height in the floor's coordinates: a slope, a ripple and the river's valley along z = 27. */
const height = (x: number, z: number): number => 0.04 * x + 0.03 * z + 0.3 * Math.sin(x * 0.15) * Math.cos(z * 0.1) - 3 * Math.exp(-(((z - 27) / 5) ** 2));

const CELL = 2.5;

/** Two chunks of terrain sharing the edge x = 0, each 60 by 80 m. */
const terrain = (x0: number): TerrainGrid => {
  const [cols, rows, z0] = [25, 33, -40];
  const heights: number[] = [];
  for (let k = 0; k < rows; k++) for (let i = 0; i < cols; i++) heights.push(height(x0 + i * CELL, z0 + k * CELL));
  const o = at(x0, z0);
  return { originX: o.x, originZ: o.z, cell: CELL, cols, rows, heights };
};

export const FLOOR_TERRAINS: readonly TerrainGrid[] = [terrain(-60), terrain(0)];

export interface FloorPiece {
  readonly surface: GroundSurface;
  readonly outline: readonly P2[];
  readonly deck?: { readonly a: Vec3; readonly b: Vec3 };
}

const octagon = (cx: number, cz: number, r: number): P2[] => Array.from({ length: 8 }, (_, i) => at(cx + r * Math.cos((i * Math.PI) / 4), cz + r * Math.sin((i * Math.PI) / 4)));

/** The footbridge's deck 0.6 m over its banks at z = 19 and z = 35. */
const deckAt = (x: number, z: number): Vec3 => ({ ...at(x, z), y: height(x, z) + 0.6 });

export const FLOOR_PIECES: readonly FloorPiece[] = [
  // A square across the four cells, setts across it, a smaller square and a footway in it, a lawn and a fountain.
  { surface: "square", outline: rect(-40, -35, 20, 10) },
  { surface: "cobble", outline: [at(-25, -38), at(-20, -38), at(-12, 12), at(-17, 12)] },
  { surface: "square", outline: [at(-10, -28), at(5, -26), at(3, -14), at(-12, -16)] },
  { surface: "footway", outline: rect(8, -30, 14, -24) },
  { surface: "grass", outline: rect(-38, -8, -28, 4) },
  { surface: "basin", outline: octagon(10, 0, 3) },
  // A carriageway from edge to edge of the terrain, split by a zebra, its sidewalks on either side.
  { surface: "sidewalk", outline: rect(-60, 10, 60, 12) },
  { surface: "road", outline: rect(-60, 12, -5, 18) },
  { surface: "crossing", outline: rect(-5, 12, -1, 18) },
  { surface: "road", outline: rect(-1, 12, 60, 18) },
  { surface: "sidewalk", outline: rect(-60, 18, 60, 20) },
  // Steps down the bank to the river, the river, a lawn on the far bank and a rail strip past it.
  { surface: "steps", outline: rect(-30, 20, -27, 24.5) },
  { surface: "water", outline: rect(-60, 24.5, 60, 30) },
  { surface: "grass", outline: rect(20, 30, 60, 38) },
  { surface: "rail", outline: rect(-60, 36, 0, 38.5) },
  // A footbridge over the river on its deck.
  { surface: "footway", outline: rect(30, 19, 33, 35), deck: { a: deckAt(31.5, 19), b: deckAt(31.5, 35) } },
];

export interface FloorMarking {
  readonly marking: RoadMarkingKind;
  readonly line: readonly P2[];
}

export const FLOOR_MARKINGS: readonly FloorMarking[] = [
  { marking: "centre-dash", line: [at(-60, 15), at(-6, 15)] },
  { marking: "stop", line: [at(-6, 12.2), at(-6, 15)] },
  { marking: "edge", line: [at(0, 12.3), at(60, 12.3)] },
];

/** Shafts cut out of the ground: across the setts and the square, across a kerb, across the cells' edge. */
export const FLOOR_SHAFTS: readonly GroundHole[] = [box(-20, -5, -14, -1), box(40, 9, 43, 14), box(-2, -32, 2, -29)];

/** The cells of the drape the glitch scan asks for: across the setts, the road, the steps and the river. */
export const FLOOR_SCAN: Box2 = box(-26, -10, 12, 26);
