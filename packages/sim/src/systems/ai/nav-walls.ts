import type { Vec3 } from "@seki/core";
import { STEP_HEIGHT } from "../movement-system";
import { LEDGE, NAV_CELL, type Raster, cellCentre, cellIndex, walled } from "./nav-raster";

/*
 * Walls between the cells of a raster on the line of a walk (G-740): a wall in the terrain or a
 * low deck sheer to its foot is steep only on a strip narrower than a cell, which the open cells
 * either side of it do not show (`Raster.walls` marks it between them).
 */

/**
 * Up a wall (`walled`) from cell `from` to the next one the line from `a` to `b` reaches, `to`:
 * past a corner, by the cell it crosses between them, which the samples may step over.
 */
const upWall = (r: Raster, a: Vec3, b: Vec3, from: number, to: number): boolean => {
  const { cells } = r;
  const [fx, tx] = [from % cells, to % cells];
  const [fz, tz] = [(from - fx) / cells, (to - tx) / cells];
  if (fx === tx || fz === tz) return walled(r, from, to, cells);
  // The line's crossings of the column's and the row's edges between them, 0..1 along it.
  const sx = (r.x0 + Math.max(fx, tx) * NAV_CELL - a.x) / (b.x - a.x);
  const sz = (r.z0 + Math.max(fz, tz) * NAV_CELL - a.z) / (b.z - a.z);
  const by = sx < sz ? fz * cells + tx : tz * cells + fx;
  return walled(r, from, by, cells) || walled(r, by, to, cells);
};

/** Is the middle of cell `c` higher than the feet at `a` more than a walk climbs to it, as the movement sees the ground (a deck high overhead none)? */
const aboveFeet = (r: Raster, a: Vec3, c: number): boolean => {
  const at = cellCentre(r, c, a.y);
  const rise = r.ground.heightAt(at.x, at.z, a.y + STEP_HEIGHT) - a.y;
  return rise > (LEDGE / NAV_CELL) * Math.max(NAV_CELL, Math.hypot(at.x - a.x, at.z - a.z));
};

/**
 * Does the line from `a` to `b`, sampled every `sample` metres, go up a wall from a cell it goes
 * through to the next (`upWall`)? Feet lower than their own cell's middle by more than a walk
 * climbs stand at the foot of a wall through it: the next cell is measured from the feet
 * themselves (`aboveFeet`). By the tip of the deck over the abutment's ramp of Mełgiewska's lower
 * bridge (G-740) the cell of feet on the ramp lies on the deck, and the way from it led along the
 * deck's top.
 */
export const wallOnWay = (r: Raster, a: Vec3, b: Vec3, sample: number): boolean => {
  if (!r.walls) return false;
  const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / sample);
  const start = cellIndex(r, a.x, a.z);
  const under = start >= 0 && (r.base?.[start] ?? a.y) - a.y > LEDGE;
  let prev = start;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const c = cellIndex(r, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
    if (c >= 0 && prev >= 0 && c !== prev && (prev === start && under ? aboveFeet(r, a, c) : upWall(r, a, b, prev, c))) return true;
    prev = c;
  }
  return false;
};
