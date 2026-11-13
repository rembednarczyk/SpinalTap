import type { GroundSurface } from "../../../packages/core/src";
import { SNAP_DOWN, STEP_HEIGHT } from "../../../packages/sim/src/systems/movement-system";
import { type WalkBlock, type WalkCell, walkBoth } from "../../../packages/sim/src/world/walk";

/**
 * The scan's one check of walking over the ground (ADR-0080, point 5): `walk-blocked`. A raster
 * of 0.25 m over the surfaces a walker walks (streets, sidewalks, squares, cobbles, paths,
 * crossings, the bridges' pieces, flights of steps); a finding is a pair of neighbouring cells,
 * along x or z, both on them, between which `walkStep` (`packages/sim/src/world/walk.ts`) does not
 * let a walker through either way: a ledge over `STEP_HEIGHT` up or `SNAP_DOWN` down, or a bank
 * steeper than ADR-0043's `MAX_WALK_SLOPE` off a flight. The edges the model means as such are no
 * finding: the walls of buildings, barriers (ADR-0077), the sides of a bridge's deck over lower
 * ground (closed to the AI too, G-741), a deck over a way under it (G-062), the niche of T-147.
 * It goes beside the six older checks of steps it is to replace (ADR-0080, PR 4); the drawing's
 * own checks (`ground-over-deck`, `paving-overlap-step`, `marking-step`) stay apart.
 */

type Pt = { readonly x: number; readonly z: number };
type Finding = { readonly at: string; readonly what: string };
type Bounds = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };

/** A chunk's ground as the tables hold it: flat outlines, `[x0, z0, x1, z1, …]`. */
export interface WalkChunk {
  readonly id: string;
  readonly bounds: Bounds;
  readonly ground: readonly { readonly surface: GroundSurface; readonly outline: readonly number[] }[];
}

/** A bridge's piece or a flight hung off one, as the scan needs it (`GroundDeck`). */
export interface WalkDeck {
  readonly ring: readonly Pt[];
  readonly a: Pt;
  readonly b: Pt;
}

/** What the check reads off the world. */
export interface WalkWorld {
  /** The ground the game walks, for the cells of one chunk (`groundY`, its terrain and decks). */
  readonly height: (chunk: WalkChunk) => (x: number, z: number) => number;
  /** The deck that is the ground at (x, z) at height y, or null on the terrain there. */
  readonly deck: (x: number, z: number, y: number) => WalkDeck | null;
  /** A deck this far over the ground beside it leaves a way under it, not an abutment (m, G-062). */
  readonly headroom: number;
  /** Is the way between the two spots an edge the model means (a building's wall, a barrier, T-147)? */
  readonly edge: (a: Pt, b: Pt) => boolean;
}

/** Raster cell (m), as in ADR-0078's measurement and the AI's raster. */
export const WALK_CELL = 0.25;
/** The surfaces a walker walks on. */
export const WALK_SURFACES: ReadonlySet<GroundSurface> = new Set(["road", "sidewalk", "square", "cobble", "footway", "crossing", "steps"]);

/** A chunk's raster: `w` × `h` cells from its least corner, row by row along z. */
export interface WalkRaster {
  readonly w: number;
  readonly h: number;
  readonly cells: Uint8Array;
}

/** How wide a slot between two decks the walker is taken across (cells): 1.25 m, the reach of `ground-strip-gap`. */
export const SLOT_CELLS = 5;

const WALK = 1;
const STEPS = 2;

const pointsOf = (flat: readonly number[]): Pt[] => Array.from({ length: flat.length >> 1 }, (_, i) => ({ x: flat[2 * i]!, z: flat[2 * i + 1]! }));

/** Which cells of the chunk lie on a walked surface (`WALK`), and which on steps too (`STEPS`): the outlines filled at the cells' centres. */
export const walkRaster = (chunk: WalkChunk): WalkRaster => {
  const b = chunk.bounds;
  const w = Math.round((b.maxX - b.minX) / WALK_CELL);
  const h = Math.round((b.maxZ - b.minZ) / WALK_CELL);
  const cells = new Uint8Array(w * h);
  for (const g of chunk.ground) {
    if (!WALK_SURFACES.has(g.surface) || g.outline.length < 6) continue;
    const mark = g.surface === "steps" ? WALK | STEPS : WALK;
    const ring = pointsOf(g.outline);
    let [z0, z1] = [Infinity, -Infinity];
    for (const p of ring) [z0, z1] = [Math.min(z0, p.z), Math.max(z1, p.z)];
    const r0 = Math.max(0, Math.floor((z0 - b.minZ) / WALK_CELL));
    const r1 = Math.min(h - 1, Math.ceil((z1 - b.minZ) / WALK_CELL));
    for (let row = r0; row <= r1; row++) {
      const z = b.minZ + (row + 0.5) * WALK_CELL;
      const xs: number[] = [];
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [p, q] = [ring[i]!, ring[j]!];
        if (p.z > z !== q.z > z) xs.push(p.x + ((z - p.z) * (q.x - p.x)) / (q.z - p.z));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.ceil((xs[k]! - b.minX) / WALK_CELL - 0.5));
        const c1 = Math.min(w - 1, Math.ceil((xs[k + 1]! - b.minX) / WALK_CELL - 0.5) - 1);
        for (let c = c0; c <= c1; c++) cells[row * w + c]! |= mark;
      }
    }
  }
  return { w, h, cells };
};

/**
 * The slope at a cell from central differences over 0.5 m (ADR-0043), each neighbour more than
 * `SNAP_DOWN` off the cell left out (a one-sided difference, as the ground does by a shaft): a
 * ledge is the pair's own finding, a rise or a drop, not a bank on both of its sides.
 */
const slopeOf = (here: number, east: number, west: number, north: number, south: number): number => {
  const axis = (plus: number, minus: number) => {
    const p = Math.abs(plus - here) <= SNAP_DOWN;
    const m = Math.abs(minus - here) <= SNAP_DOWN;
    if (p && m) return (plus - minus) / (2 * WALK_CELL);
    if (p) return (plus - here) / WALK_CELL;
    return m ? (here - minus) / WALK_CELL : 0;
  };
  return Math.hypot(axis(east, west), axis(north, south));
};

const orient = (a: Pt, b: Pt, c: Pt) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
const crosses = (a: Pt, b: Pt, c: Pt, d: Pt) => orient(a, b, c) * orient(a, b, d) <= 0 && orient(c, d, a) * orient(c, d, b) <= 0;

/** Does the way from `on` (on the deck) to `off` leave it over one of its sides, along its axis, not over an end? */
export const overSide = (d: WalkDeck, on: Pt, off: Pt): boolean => {
  const len = Math.hypot(d.b.x - d.a.x, d.b.z - d.a.z);
  if (len < 1e-6) return false;
  const [ux, uz] = [(d.b.x - d.a.x) / len, (d.b.z - d.a.z) / len];
  for (let i = 0; i < d.ring.length; i++) {
    const [p, q] = [d.ring[i]!, d.ring[(i + 1) % d.ring.length]!];
    const e = Math.hypot(q.x - p.x, q.z - p.z);
    if (e < 1e-6 || !crosses(on, off, p, q)) continue;
    return Math.abs(((q.x - p.x) * ux + (q.z - p.z) * uz) / e) > Math.SQRT1_2;
  }
  const s = Math.hypot(off.x - on.x, off.z - on.z);
  return Math.abs(((off.x - on.x) * ux + (off.z - on.z) * uz) / s) < Math.SQRT1_2;
};

/** One chunk's findings. */
const chunkFindings = (chunk: WalkChunk, raster: WalkRaster, world: WalkWorld, flagAt: (x: number, z: number) => number): Finding[] => {
  const { w, h, cells } = raster;
  const b = chunk.bounds;
  const heightAt = world.height(chunk);
  // Heights on the raster and a cell round it, worked out where a walked cell needs them.
  const W = w + 2;
  const ys = new Float64Array(W * (h + 2)).fill(Number.NaN);
  const cx = (i: number) => b.minX + (i + 0.5) * WALK_CELL;
  const cz = (j: number) => b.minZ + (j + 0.5) * WALK_CELL;
  const y = (i: number, j: number): number => {
    const k = (j + 1) * W + i + 1;
    const v = ys[k]!;
    return Number.isNaN(v) ? (ys[k] = heightAt(cx(i), cz(j))) : v;
  };
  const cell = (i: number, j: number): WalkCell => {
    const here = y(i, j);
    return { y: here, slope: slopeOf(here, y(i + 1, j), y(i - 1, j), y(i, j + 1), y(i, j - 1)), flight: (flag(i, j) & STEPS) !== 0 };
  };
  // A cell past the east or north seam is the next chunk's: the pairs across a seam count once.
  const flag = (i: number, j: number): number => (i < w && j < h ? cells[j * w + i]! : flagAt(cx(i), cz(j)));
  const out: Finding[] = [];
  const centre = (i: number, j: number): Pt => ({ x: cx(i), z: cz(j) });
  /** The pair (i, j)-(ni, nj): a finding when blocked, unless its edge is meant (not across a slot, `slot`). */
  const pair = (i: number, j: number, ni: number, nj: number, slot: boolean): void => {
    const [a, n] = [cell(i, j), cell(ni, nj)];
    const block = walkBoth(a, n);
    if (!block) return;
    const [pa, pn] = [centre(i, j), centre(ni, nj)];
    const what = slot ? (world.edge(pa, pn) ? null : `${stepText(a, n, block)}, slot between decks at ${Math.max(a.y, n.y).toFixed(2)}`) : intended(world, pa, a, pn, n, block);
    if (what !== null) out.push({ at: `${((pa.x + pn.x) / 2).toFixed(2)},${((pa.z + pn.z) / 2).toFixed(2)}`, what: `${chunk.id} ${what}` });
  };
  /** The deck cell (i, j) whose next cell along (di, dj) is off the walked surfaces: across a slot to another deck within `SLOT_CELLS`, the cells of the slot walked (G-340). */
  const acrossSlot = (i: number, j: number, di: number, dj: number): void => {
    if (!world.deck(cx(i), cz(j), y(i, j))) return;
    for (let k = 2; k <= SLOT_CELLS + 1; k++) {
      const [mi, mj] = [i + di * k, j + dj * k];
      if (!flag(mi, mj)) continue;
      if (!world.deck(cx(mi), cz(mj), y(mi, mj))) return;
      for (let s = 0; s < k; s++) pair(i + di * s, j + dj * s, i + di * (s + 1), j + dj * (s + 1), true);
      return;
    }
  };
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (!cells[j * w + i]) continue;
      for (const [di, dj] of [[1, 0], [0, 1]] as const) {
        if (flag(i + di, j + dj)) pair(i, j, i + di, j + dj, false);
        else acrossSlot(i, j, di, dj);
      }
    }
  }
  return out;
};

/** The finding's text for a blocked pair, or null when its edge is one the model means. */
const intended = (world: WalkWorld, pa: Pt, a: WalkCell, pn: Pt, n: WalkCell, block: WalkBlock): string | null => {
  if (world.edge(pa, pn)) return null;
  const dy = Math.abs(n.y - a.y);
  if (block === "steep") return `${stepText(a, n, block)} at ${Math.max(a.y, n.y).toFixed(2)}`;
  const [hi, lo, ph, pl] = n.y > a.y ? [n, a, pn, pa] : [a, n, pa, pn];
  const top = world.deck(ph.x, ph.z, hi.y);
  const under = world.deck(pl.x, pl.z, lo.y);
  if (top && !under && (dy > world.headroom || overSide(top, ph, pl))) return null;
  const where = top ? (under ? "deck by deck" : "deck end") : under ? "under a deck" : hi.flight || lo.flight ? "steps" : "ground";
  return `${stepText(a, n, block)}, ${where} at ${hi.y.toFixed(2)}`;
};

/** A blocked pair in words, the same whichever cell comes first: a bank, a ledge no way over, or a step only climbed up. */
const stepText = (a: WalkCell, n: WalkCell, block: WalkBlock): string => {
  const dy = Math.abs(n.y - a.y);
  if (block === "steep") return `steep ${Math.max(a.slope, n.slope).toFixed(2)}`;
  return `${dy > STEP_HEIGHT ? "ledge" : "step down"} ${dy.toFixed(2)} m`;
};

/** `walk-blocked` over the chunks. */
export const walkBlocked = (chunks: readonly WalkChunk[], world: WalkWorld): Finding[] => {
  const rasters = chunks.map(walkRaster);
  const flagAt = (x: number, z: number): number => {
    for (let k = 0; k < chunks.length; k++) {
      const b = chunks[k]!.bounds;
      if (x <= b.minX || x >= b.maxX || z <= b.minZ || z >= b.maxZ) continue;
      const r = rasters[k]!;
      return r.cells[Math.floor((z - b.minZ) / WALK_CELL) * r.w + Math.floor((x - b.minX) / WALK_CELL)] ?? 0;
    }
    return 0;
  };
  return chunks.flatMap((c, k) => chunkFindings(c, rasters[k]!, world, flagAt));
};
