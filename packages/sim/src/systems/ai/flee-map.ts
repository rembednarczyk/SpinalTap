import type { Vec3 } from "@seki/core";
import type { World } from "miniplex";
import type { Entity } from "../../world/components";
import { FAR, NEAR_WINDOW, inMask } from "./nav-field";
import { type Field, STEPS, cellIndex } from "./nav-raster";
import { planDetour } from "./steering";

/**
 * The safety map of an escape (G-980): where a runner is safest from a threat, by the walk and not
 * the straight line. The pattern is Brogue's "safety map" (B. Walker, the Dijkstra maps of
 * roguelikes): the walking distance from the threat, times −1.2, relaxed again over the walkable
 * cells. A cell far from the threat is safe; a cell in a pocket of walls is less safe than its
 * distance says, because the way out of the pocket leads back past the threat.
 *
 * Where it differs: the runner does not walk down the map. `fleeTurn` keeps choosing its way from
 * probes a few metres ahead, tuned over a dozen glitches (G-317 to G-928), and the map only breaks
 * the tie its list's order broke blindly: of the two slants off the way away, both open, the safer
 * (`safestTurn`). At a facade at a slant to the threat the list put the slant into the wall first;
 * the runner ran into it, swung to the other slant and back (1.56 and 2.35 rad).
 *
 * Integer tenths of the field's half cells: 12 a half cell of the distance, 10 a half cell walked.
 * The same on every machine: a binary heap ordered by the value, then by the cell. A map is made
 * only when a runner faces that tie, once per field (the threat's cell) and kept with it.
 */

const SCALE = 12;
const WALK = 10;

const maps = new WeakMap<Field, Int32Array>();

/**
 * How much safer the mirror slant has to be to take over from the first (in the map's tenths of
 * half cells, under a cell walked): at the facade the slant along it was 18 safer; with nothing
 * the two swapped back and forth as the runner moved.
 */
const MIRROR_MARGIN = 16;
/** The slant turns off the way away (radians): `FLEE_TURNS`' ±π/4. */
const SLANT = Math.PI / 4;
/** Steps back along a probe to a cell the map knows (m): half a cell. */
const ALONG = 0.25;

/** The relaxed map of a field grown from the threat's cell: lower is safer, `FAR` where the threat cannot reach. */
export const safetyOf = (field: Field): Int32Array => {
  const known = maps.get(field);
  if (known) return known;
  const { raster, dist } = field;
  const cells = raster.cells;
  const out = new Int32Array(cells * cells).fill(FAR);
  // A heap of (value, cell) pairs, smallest first.
  const heap: number[] = [];
  const less = (a: number, b: number) => (heap[2 * a]! < heap[2 * b]! || (heap[2 * a] === heap[2 * b] && heap[2 * a + 1]! < heap[2 * b + 1]!));
  const swap = (a: number, b: number) => {
    [heap[2 * a], heap[2 * b]] = [heap[2 * b]!, heap[2 * a]!];
    [heap[2 * a + 1], heap[2 * b + 1]] = [heap[2 * b + 1]!, heap[2 * a + 1]!];
  };
  const push = (v: number, c: number) => {
    heap.push(v, c);
    for (let i = heap.length / 2 - 1; i > 0 && less(i, (i - 1) >> 1); i = (i - 1) >> 1) swap(i, (i - 1) >> 1);
  };
  const pop = (): [number, number] => {
    const top: [number, number] = [heap[0]!, heap[1]!];
    const n = heap.length / 2 - 1;
    swap(0, n);
    heap.length -= 2;
    for (let i = 0; ; ) {
      const [l, r] = [2 * i + 1, 2 * i + 2];
      let m = i;
      if (l < n && less(l, m)) m = l;
      if (r < n && less(r, m)) m = r;
      if (m === i) break;
      swap(i, m);
      i = m;
    }
    return top;
  };
  for (let c = 0; c < dist.length; c++) {
    const d = dist[c]!;
    if (d >= FAR) continue;
    out[c] = -SCALE * d;
    push(out[c]!, c);
  }
  while (heap.length > 0) {
    const [v, c] = pop();
    if (v !== out[c]) continue;
    // The cells a step leads into `c` from: the runner there may step on to `c`.
    const bits = inMask(raster, c);
    for (let i = 0; i < STEPS.length; i++) {
      if (!(bits & (1 << i))) continue;
      const [dx, dz, cost] = STEPS[i]!;
      const n = c + dz * cells + dx;
      const nv = v + WALK * cost;
      if (nv < out[n]!) {
        out[n] = nv;
        push(nv, n);
      }
    }
  }
  maps.set(field, out);
  return out;
};

/**
 * The safety at a point for a runner at `from` from a threat at `threat` (lower is safer), or null
 * where the map does not reach: another floor, outside the window round the threat, a closed cell.
 */
export const safetyFrom = (world: World<Entity>, from: Vec3, threat: Vec3): ((p: { x: number; z: number }) => number | null) | null => {
  const detour = planDetour(world, from, threat, [], NEAR_WINDOW);
  if (!detour) return null;
  const map = safetyOf(detour.field);
  return (p) => {
    const c = cellIndex(detour.field.raster, p.x, p.z);
    const v = c < 0 ? FAR : (map[c] ?? FAR);
    return v >= FAR ? null : v;
  };
};

/**
 * Of a turn and its mirror, both open (the first of `turns` and its opposite), the one whose
 * probe's end (`probe` metres on) is safer from `threat`; else the first of `turns`. Only there:
 * the list's order put the turn into a facade at a slant before the one along it, and the runner
 * swung across to the other side a few steps on (G-980). The rest of the choice is `fleeTurn`'s.
 */
export const safestTurn = (world: World<Entity>, from: Vec3, away: number, turns: readonly number[], probe: number, threat: Vec3 | undefined): number | undefined => {
  const first = turns[0];
  // Only the two slants: a turn square to the way away and its mirror lead along a wall either way,
  // and the safer of those in a blind alley is the way out past the player (G-317 keeps it in).
  if (first === undefined || Math.abs(first) !== SLANT || !threat || !turns.includes(-first)) return first;
  const safety = safetyFrom(world, from, threat);
  if (!safety) return first;
  // The last cell along the probe the map knows: its end may lie in a cell closed within a body of a wall.
  const at = (t: number) => {
    for (let r = probe; r > 0; r -= ALONG) {
      const v = safety({ x: from.x + Math.sin(away + t) * r, z: from.z + Math.cos(away + t) * r });
      if (v !== null) return v;
    }
    return null;
  };
  // Either unknown: the list's order stands.
  const [a, b] = [at(first), at(-first)];
  return a !== null && b !== null && b < a - MIRROR_MARGIN ? -first : first;
};
