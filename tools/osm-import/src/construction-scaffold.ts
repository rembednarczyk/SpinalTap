/**
 * The scaffold of a building site (ADR-0087 step 5, stage 2): along the longest wall of a
 * neighbour that lies on the site's outline, on the site's side of it, `SITE_SCAFFOLD.gap` off the
 * wall and `SITE_SCAFFOLD.depth` deep, over free ground inside the outline, up to the neighbour's
 * top and a metre over it. Its mesh carries a neon banner of the building of 2077 (the design
 * from the seed). The fence's panels in its way give way to it: the scaffold closes the site there.
 * A wall with a venue's board on it takes none (G-893): the scaffold would hide the board.
 */
import { type StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { SITE_SCAFFOLD, siteScaffoldVariant } from "../../../packages/core/src/world/sites.ts";
import { type SiteGround, lineDistance } from "./construction-ground.ts";
import { type Pt, pointInRing } from "./geometry.ts";

/** How near the site's outline a neighbour's wall lies to count as on it (m). */
const ADJACENT = 1.5;
/** Step of the samples along a wall (m). */
const STEP = 0.5;
/** The scaffold's height: the neighbour's top and this much (m), up to `TALLEST`. */
const OVER = 1;
const TALLEST = 30;

export interface ScaffoldPlan {
  /** The wall's side of the scaffold: from `a` to `b`, `n` the unit normal into the site. */
  readonly a: Pt;
  readonly b: Pt;
  readonly n: Pt;
  readonly length: number;
  readonly height: number;
}

const round = (v: number, k = 100): number => Math.round(v * k) / k + 0;
const same = (p: Pt, q: Pt): boolean => Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.z - q.z) < 1e-6;

/** The scaffold's box in the world, grown by `by` (m) on every side. */
export const scaffoldBox = (s: ScaffoldPlan, by = 0): Pt[] => {
  const d = { x: (s.b.x - s.a.x) / s.length, z: (s.b.z - s.a.z) / s.length };
  const at = (u: number, w: number): Pt => ({ x: s.a.x + d.x * u + s.n.x * w, z: s.a.z + d.z * u + s.n.z * w });
  return [at(-by, -by), at(s.length + by, -by), at(s.length + by, SITE_SCAFFOLD.depth + by), at(-by, SITE_SCAFFOLD.depth + by)];
};

/** A sample of the scaffold's footprint across, `u` along the wall's side: free ground inside the outline. */
const fits = (outline: readonly Pt[], g: SiteGround, p: Pt, n: Pt): boolean => {
  for (let w = 0; w <= SITE_SCAFFOLD.depth + 1e-9; w += SITE_SCAFFOLD.depth / 4) {
    const q = { x: p.x + n.x * w, z: p.z + n.z * w };
    if (!pointInRing(q, outline) || !g.free(q)) return false;
  }
  return true;
};

/**
 * The scaffold along the longest stretch of a neighbour's wall on the site's outline with room
 * for it, `SITE_SCAFFOLD.least` m or longer; null with none.
 */
export const planScaffold = (outline: readonly Pt[], g: SiteGround): ScaffoldPlan | null => {
  const closed = [...outline, outline[0]!];
  let best: ScaffoldPlan | null = null;
  for (const nb of g.neighbours) {
    for (let i = 0; i < nb.ring.length; i++) {
      const [a, b] = [nb.ring[i]!, nb.ring[(i + 1) % nb.ring.length]!];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      // No scaffold before a venue's board (G-893): another wall, or none.
      if (len < SITE_SCAFFOLD.least || nb.boardWalls?.some(([p, q]) => same(p, a) && same(q, b))) continue;
      const d = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
      // The side away from the building: the one whose point a metre off the wall's middle is not in it.
      const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      const left = { x: -d.z, z: d.x };
      const n = pointInRing({ x: mid.x + left.x, z: mid.z + left.z }, nb.ring) ? { x: -left.x, z: -left.z } : left;
      const k = Math.floor(len / STEP);
      let from: number | null = null;
      const run = (u0: number, u1: number) => {
        if (u1 - u0 < SITE_SCAFFOLD.least - 1e-9 || (best && u1 - u0 <= best.length + 1e-9)) return;
        const pa = { x: a.x + d.x * u0 + n.x * SITE_SCAFFOLD.gap, z: a.z + d.z * u0 + n.z * SITE_SCAFFOLD.gap };
        const pb = { x: a.x + d.x * u1 + n.x * SITE_SCAFFOLD.gap, z: a.z + d.z * u1 + n.z * SITE_SCAFFOLD.gap };
        const foot = g.heightAt({ x: (pa.x + pb.x) / 2, z: (pa.z + pb.z) / 2 });
        const height = Math.min(TALLEST, Math.max(SITE_SCAFFOLD.lift * 2, nb.top - foot + OVER));
        best = { a: pa, b: pb, n, length: u1 - u0, height };
      };
      for (let j = 0; j <= k; j++) {
        const u = j * STEP;
        const w = { x: a.x + d.x * u, z: a.z + d.z * u };
        const p = { x: w.x + n.x * SITE_SCAFFOLD.gap, z: w.z + n.z * SITE_SCAFFOLD.gap };
        const ok = lineDistance(w, closed) <= ADJACENT && fits(outline, g, p, n);
        if (ok) from ??= u;
        else if (from !== null) {
          run(from, u - STEP);
          from = null;
        }
      }
      if (from !== null) run(from, k * STEP);
    }
  }
  return best;
};

/** The scaffold as a piece: its foot on the wall's side in the middle, local +x along the wall, +z into the site. */
export const scaffoldPiece = (s: ScaffoldPlan, g: SiteGround, banner: number): StreetPropItem => {
  const mid = { x: (s.a.x + s.b.x) / 2, z: (s.a.z + s.b.z) / 2 };
  // Local x is (cos yaw, -sin yaw) and local z (sin yaw, cos yaw): +z is `n`, so +x is n turned clockwise.
  const yaw = Math.atan2(s.n.x, s.n.z);
  const dx = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  const half = s.length / 2;
  const rise = g.heightAt({ x: mid.x + dx.x * half, z: mid.z + dx.z * half }) - g.heightAt({ x: mid.x - dx.x * half, z: mid.z - dx.z * half });
  return {
    prop: "site-scaffold",
    x: round(mid.x),
    y: round(g.heightAt(mid)),
    z: round(mid.z),
    yaw: round(yaw, 1e4),
    variant: siteScaffoldVariant({ length: s.length, height: s.height, rise, banner }),
  };
};
