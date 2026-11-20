/**
 * Which way the sculptures face (ADR-0094 stage 4): a Koziołek, a monument or an artwork never
 * faces a wall. Lublin's Koziołki are small bronzes by the tenements, on the pavement under the
 * wall, often by a door (the Koziołki's trail: Krakowskie Przedmieście 6, Narutowicza 6): their backs
 * to the wall, their fronts to the passers-by. So within `WALL_REACH` of a facade a sculpture turns its
 * back to it; standing free it faces the widest open space round it (the longest clear ray of
 * `RAYS` directions, up to `RAY_REACH`), where it is seen from: a square's middle, a street's length.
 * A direction the plan gives (`yaw`) wins over both.
 */
import type { Pt } from "./geometry.ts";
import type { Site } from "./props-site.ts";

/** Within this of a facade a sculpture stands with its back to it (m). */
export const WALL_REACH = 3;
/** How many directions the open space is looked for in, and how far (m). */
const RAYS = 24;
const RAY_REACH = 40;
const STEP = 1;

/** How far a walker sees from p along `d` before a building, water, the rails or the chunks' end (m). */
const freeRun = (site: Site, p: Pt, d: Pt): number => {
  for (let t = STEP; t <= RAY_REACH; t += STEP) {
    const q = { x: p.x + d.x * t, z: p.z + d.z * t };
    const s = site.surfaceAt(q);
    if (site.chunkAt(q) === null || s === "building" || s === "water" || s === "rail") return t - STEP;
  }
  return RAY_REACH;
};

/** The direction of the widest open space round p: the longest clear ray, the first of equals from north clockwise. */
export const openSpace = (site: Site, p: Pt): Pt | null => {
  let best: Pt | null = null;
  let bestRun = 0;
  for (let i = 0; i < RAYS; i++) {
    const a = (i * 2 * Math.PI) / RAYS;
    const d = { x: Math.sin(a), z: Math.cos(a) };
    // The open space a ray looks into, a little to each side too: a sculpture faces a square, not a slit.
    const run = Math.min(freeRun(site, p, d), freeRun(site, p, { x: Math.sin(a + 0.2), z: Math.cos(a + 0.2) }), freeRun(site, p, { x: Math.sin(a - 0.2), z: Math.cos(a - 0.2) }));
    if (run > bestRun + 0.5) {
      bestRun = run;
      best = d;
    }
  }
  return best;
};

/** The way a sculpture at p faces: its back to a wall within reach, else the widest open space. */
export const sculptureFacing = (site: Site, p: Pt): Pt | null => site.awayFromWall(p, WALL_REACH) ?? openSpace(site, p);
