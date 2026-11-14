import { FillRule, type Path64, area, difference, isPositive, union } from "clipper2-ts";
import type { ChunkFills } from "./fill-on-green";

/** The widest hole between the bare ground rule's pieces counted (m²): under the rule's least hole a tile is split by (`FILL.minHole`). */
export const FILL_GAP_MAX = 0.5;
/** The least bare area a gap shows to count (m²): Clipper's 1 cm grid leaves crumbs. */
export const FILL_GAP_MIN = 0.005;

/** Clipper's integer grid (1 cm), as the import cuts the fills on. */
const SCALE = 100;
const pathOf = (flat: readonly number[]): Path64 => Array.from({ length: flat.length >> 1 }, (_, k) => ({ x: Math.round(flat[2 * k]! * SCALE), y: Math.round(flat[2 * k + 1]! * SCALE) }));

interface Box {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}
const boxOf = (p: Path64): Box => {
  const [xs, ys] = [p.map((q) => q.x), p.map((q) => q.y)];
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
};
const overlap = (a: Box, b: Box) => a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;

/** A chunk's other surfaces: its pieces of the map (world x, z) and its buildings (outline relative to their x, z). */
export interface ChunkSolids {
  readonly ground: readonly { readonly outline: readonly number[]; readonly bridge?: true }[];
  readonly buildings: readonly { readonly x: number; readonly z: number; readonly outline: readonly number[] }[];
}

/**
 * `fill-gap` (G-769): a hole in the ground the bare ground rule laid, under `FILL_GAP_MAX`, that
 * no piece of the map and no building covers either: dark terrain showing between two fills
 * whose outlines were traced apart (a tile's or a split's edge crossing a lawn's corner on the
 * slant). A hole the rule leaves on purpose (asphalt, a speck joined to nothing) is at least
 * `FILL.speck` cells, over 2 m². One finding a hole, at its middle.
 */
export const fillGap = (fills: readonly ChunkFills[], solids: readonly ChunkSolids[]): { readonly at: string; readonly what: string }[] => {
  const laid = union(
    fills.flatMap((c) => c.fills.map((f) => pathOf(f.outline))),
    FillRule.NonZero,
  );
  const fillKeys = new Set(fills.flatMap((c) => c.fills.map((f) => f.outline.join(","))));
  const others = solids
    .flatMap((c) => [
      ...c.ground.filter((g) => !g.bridge && !fillKeys.has(g.outline.join(","))).map((g) => g.outline),
      ...c.buildings.map((b) => b.outline.map((v, k) => v + (k % 2 === 0 ? b.x : b.z))),
    ])
    .map(pathOf)
    .filter((p) => p.length >= 3)
    .map((p) => ({ p: isPositive(p) ? p : [...p].reverse(), box: boxOf(p) }));
  const out: { at: string; what: string }[] = [];
  for (const h of laid) {
    if (isPositive(h) || -area(h) > FILL_GAP_MAX * SCALE * SCALE) continue;
    const box = boxOf(h);
    const hole = [...h].reverse();
    const over = others.filter((o) => overlap(o.box, box)).map((o) => o.p);
    const bare = over.length > 0 ? difference([hole], over, FillRule.NonZero) : [hole];
    const m2 = bare.reduce((s, p) => s + area(p), 0) / (SCALE * SCALE);
    if (m2 < FILL_GAP_MIN) continue;
    const [x, z] = [(box.minX + box.maxX) / 2 / SCALE, (box.minY + box.maxY) / 2 / SCALE];
    out.push({ at: `${x.toFixed(1)},${z.toFixed(1)}`, what: `${m2.toFixed(3)} m² of bare terrain between fills at ${x.toFixed(2)},${z.toFixed(2)}` });
  }
  return out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
};
