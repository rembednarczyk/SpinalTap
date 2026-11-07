import { describe, expect, it } from "vitest";
import { type TerrainGrid, terrainHeightAt } from "@seki/core";
import { MAP_CHUNKS, TRASA_PODZIEMNA, TRASA_PODZIEMNA_PROPS, groundY } from "../src";
import { surfaceLiftAt } from "../src/content/lublin/roads";
import { STEP_RISE, flightGrid, shapeGrid } from "../src/content/lublin/shape";
import { FLIGHT_RAMPS, PADS, RAMPS } from "../src/content/lublin/sites";
import { topAt } from "../src/world/collision";

/**
 * The ground under Trasa Podziemna's stairs (G-252): the dig of `PADS` must keep the terrain a
 * metre or more under the stairs' collision ramp, and the Rynek's paving, draped on it in the
 * triangles of a 2.5 m grid (the renderer's `DRAPE_GRID`, edges of up to 3.5 m; checked here for
 * any of up to 5 m), under the treads. On the import's grid and on any other of up to 5 m: the
 * pad is laid out in metres, not on the grid's points.
 */

type HeightAt = (x: number, z: number) => number;

const STAIRS = TRASA_PODZIEMNA_PROPS.find((p) => p.view.kind === "block" && p.view.slope !== undefined)!;
const VIEW = STAIRS.view.kind === "block" ? STAIRS.view : null;
const SLOPE = VIEW!.slope;
const { center: C } = STAIRS;
const { size: S } = VIEW!;
const BOX = {
  min: { x: C.x - S.x / 2, y: C.y - S.y / 2, z: C.z - S.z / 2 },
  max: { x: C.x + S.x / 2, y: C.y + S.y / 2, z: C.z + S.z / 2 },
};
/** The top of the stairs' collision ramp at (x, z). */
const rampY: HeightAt = (x, z) => topAt(BOX, SLOPE, x, z);

/** Points of the stairs' footprint, 0.25 m apart along them and 0.4 across. */
const stairPoints = (): [number, number][] => {
  const out: [number, number][] = [];
  for (let x = BOX.min.x; x <= BOX.max.x + 1e-9; x += 0.25) for (let z = BOX.min.z; z <= BOX.max.z + 1e-9; z += 0.4) out.push([x, z]);
  return out;
};

/** The worst clearance of the ground under the stairs' ramp (m). */
const rampClearance = (ground: HeightAt): number => Math.min(...stairPoints().map(([x, z]) => rampY(x, z) - ground(x, z)));

/** Barycentric weights of a point in a draped triangle: the middle, by a corner, on an edge. */
const WEIGHTS: readonly (readonly [number, number, number])[] = [
  [1 / 3, 1 / 3, 1 / 3],
  [0.7, 0.15, 0.15],
  [0.15, 0.7, 0.15],
  [0.15, 0.15, 0.7],
  [0.5, 0.5, 0],
  [0, 0.5, 0.5],
  [0.5, 0, 0.5],
];

/**
 * The highest the paving can be drawn at (x, z) over the treads, as the renderer drapes it:
 * linear in triangles with edges of up to 5 m whose corners lie at `paving` (equilateral ones,
 * turned every 15°, of 2.5 and 5 m), (x, z) at various places in them.
 */
const drapedOver = (paving: HeightAt, x: number, z: number): number => {
  let worst = -Infinity;
  for (const edge of [2.5, 5]) {
    const r = edge / Math.sqrt(3);
    for (let a = 0; a < 120; a += 15) {
      const corners = [0, 120, 240].map((d) => [r * Math.cos(((a + d) * Math.PI) / 180), r * Math.sin(((a + d) * Math.PI) / 180)] as const);
      for (const w of WEIGHTS) {
        const ox = x - corners.reduce((s, c, i) => s + c[0] * w[i]!, 0);
        const oz = z - corners.reduce((s, c, i) => s + c[1] * w[i]!, 0);
        worst = Math.max(worst, corners.reduce((s, c, i) => s + paving(ox + c[0], oz + c[1]) * w[i]!, 0));
      }
    }
  }
  return worst;
};

/** The worst height of the draped paving over the stairs' ramp less a riser (m): above 0 it shows through a tread. */
const pavingOverTreads = (ground: HeightAt): number => {
  const paving: HeightAt = (x, z) => ground(x, z) + surfaceLiftAt(x, z, false);
  return Math.max(...stairPoints().map(([x, z]) => drapedOver(paving, x, z) - (rampY(x, z) - STEP_RISE)));
};

describe("the ground under Trasa Podziemna's stairs (G-252)", () => {
  it("finds the stairs: from the door's level at the vestibule down to the cellars' floor", () => {
    expect(rampY(BOX.min.x, -57)).toBeCloseTo(TRASA_PODZIEMNA.door, 6);
    expect(rampY(BOX.max.x, -57)).toBeCloseTo(TRASA_PODZIEMNA.floor, 6);
  });

  it("keeps the game's ground a metre or more under the stairs' collision ramp", () => {
    expect(rampClearance(groundY)).toBeGreaterThanOrEqual(1);
  });

  it("keeps the Rynek's paving, draped in 5 m triangles, under the treads", () => {
    expect(pavingOverTreads(groundY)).toBeLessThan(0);
  });
});

const CHUNK = MAP_CHUNKS.find((c) => c.id === "stare-miasto-0-0")!;

/** The chunk's map terrain resampled on a grid of `cell` whose points are `shift` off the chunk's corner. */
const resampled = (cell: number, shift: number): TerrainGrid => {
  const { minX, maxX, minZ, maxZ } = CHUNK.bounds;
  const [originX, originZ] = [minX - shift, minZ - shift];
  const cols = Math.ceil((maxX - originX) / cell) + 1;
  const rows = Math.ceil((maxZ - originZ) / cell) + 1;
  const heights: number[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) heights.push(terrainHeightAt(CHUNK.terrain, originX + c * cell, originZ + r * cell));
  return { originX, originZ, cell, cols, rows, heights };
};

describe.each([
  [5, 0],
  [5, 2.5],
  [4, 0],
  [2.5, 0],
  [2.5, 1.25],
  [1, 0],
  [1, 0.5],
])("the ground under Trasa Podziemna's stairs on a grid of %s m shifted %s m (G-252)", (cell, shift) => {
  // Shaped as `SHAPED_TERRAIN` shapes the import's grid.
  const shaped = shapeGrid(flightGrid(shapeGrid(resampled(cell, shift), PADS, RAMPS), FLIGHT_RAMPS), [], FLIGHT_RAMPS);
  const ground: HeightAt = (x, z) => terrainHeightAt(shaped, x, z);

  it("keeps the ground a metre or more under the stairs' collision ramp", () => {
    expect(rampClearance(ground)).toBeGreaterThanOrEqual(1);
  });

  it("keeps the Rynek's paving, draped in 5 m triangles, under the treads", () => {
    expect(pavingOverTreads(ground)).toBeLessThan(0);
  });
});
