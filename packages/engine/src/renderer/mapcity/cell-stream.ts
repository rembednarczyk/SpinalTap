import type { Vec3 } from "@seki/core";
import type { Cell } from "./map-cells";
import { distanceToBox } from "./polygon";

/** Distances (m, from the camera to a cell) per quality: detail, any building, ground, signs. */
export interface MapLod {
  readonly near: number;
  readonly far: number;
  readonly ground: number;
  readonly signs: number;
}

/** Near meshes built per frame at most: streaming detail in never stalls a frame for long. */
const NEAR_BUILDS_PER_FRAME = 2;

/**
 * Levels of detail of the cells from the camera (ADR-0044): near meshes built a few per frame
 * and dropped far behind, the rest shown by distance. Returns the near cells still waiting.
 */
export const streamCells = (cells: Iterable<Cell>, eye: Vec3, lod: MapLod, buildNear: (cell: Cell) => void): number => {
  let builds = 0;
  let waiting = 0;
  for (const cell of cells) {
    const d = Math.hypot(distanceToBox(eye.x, eye.z, cell.bounds), Math.max(eye.y - 2, 0));
    const wantNear = d < lod.near + (cell.lod === "near" ? 15 : 0);
    if (wantNear && (cell.nearDirty || !cell.near) && cell.frames.length > 0) {
      if (builds < NEAR_BUILDS_PER_FRAME) {
        buildNear(cell);
        builds++;
      } else waiting++;
    }
    if (!wantNear && cell.near && d > lod.near * 2) {
      cell.near.dispose(false, false);
      cell.near = null;
    }
    const near = wantNear && cell.near !== null && !cell.nearDirty;
    cell.lod = near ? "near" : d < lod.far ? "far" : "off";
    cell.near?.setEnabled(near);
    cell.far?.setEnabled(cell.lod === "far");
    cell.signs?.setEnabled(d < lod.signs);
    cell.ground?.setEnabled(d < lod.ground);
    cell.water?.setEnabled(d < lod.ground);
  }
  return waiting;
};
