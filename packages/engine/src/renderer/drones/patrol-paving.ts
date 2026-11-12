import { SURFACE_LIFT, type Vec3, type ViewDescriptor } from "@seki/core";
import { drapeHeightAt } from "../mapcity/ground-plan";
import { BinIndex } from "../mapcity/map-index";
import { type P2, boundsOf, triangulate } from "../mapcity/polygon";
import { worldRing } from "./drone-world";

type Item = { readonly view: ViewDescriptor; readonly at: Vec3 };

/** The cells a piece's triangles are sorted into for point queries (m): the pool reads its paving 585 times each time it is laid. */
const CELL = 2;
/** A number for a pair of whole numbers of up to ten million either way (10 km in millimetres): a map's key without a string. */
const pairKey = (i: number, k: number): number => (i + 1e7) * 4e7 + (k + 1e7);
const cellOf = (x: number, z: number): number => pairKey(Math.floor(x / CELL), Math.floor(z / CELL));
/** At most this many corners' ground heights are kept. */
const CORNERS_KEPT = 50_000;

/**
 * A ring's triangles (`triangulate`, three corners each) by the cells their boxes touch. Not core's
 * `SpatialHash`, on purpose: it is laid lazily, a piece's when a point first falls on it, a cell
 * holds the corners themselves, flat, and one cell key serves every piece under the point, so the
 * pool's 585 reads walk the lists as they are, with no boxes, handles or array per read.
 */
const trianglesByCell = (ring: readonly P2[]): Map<number, number[]> => {
  const tris = triangulate(ring);
  const cells = new Map<number, number[]>();
  for (let t = 0; t + 2 < tris.length; t += 3) {
    const corners = [tris[t], tris[t + 1], tris[t + 2]] as [number, number, number];
    const b = boundsOf(corners.map((i) => ring[i] as P2));
    for (let i = Math.floor(b.minX / CELL); i <= Math.floor(b.maxX / CELL); i++) {
      for (let k = Math.floor(b.minZ / CELL); k <= Math.floor(b.maxZ / CELL); k++) {
        const list = cells.get(pairKey(i, k));
        if (list) list.push(...corners);
        else cells.set(pairKey(i, k), [...corners]);
      }
    }
  }
  return cells;
};

/**
 * The paving's height as the map city draws it (G-293): each ground surface of the scenery draped
 * as `drape` lays it, straight across the triangles of its 2.5 m grid (`drapeY`) at the ground's
 * height and the surface's lift, the highest where several overlap; `off` where none is drawn. Not the ground at
 * the point and the lift (`surfaceY`): in a hollow of the terrain the drawn paving runs a few
 * centimetres over that, and the low patrol's pool laid on it sank into the paving, its middle dark.
 */
export const drawnPavingOf = (items: readonly Item[], groundAt: (x: number, z: number) => number, off: (x: number, z: number) => number): ((x: number, z: number) => number) => {
  const pieces: { readonly ring: P2[]; readonly lift: number; cells: Map<number, number[]> | null }[] = [];
  const index = new BinIndex();
  // The ground under the drape's corners, read once: a pool laid again a step on reads the same ones.
  const corners = new Map<number, number>();
  const cornerAt = (x: number, z: number): number => {
    const key = pairKey(Math.round(x * 1000), Math.round(z * 1000));
    let y = corners.get(key);
    if (y === undefined) {
      if (corners.size >= CORNERS_KEPT) corners.clear();
      corners.set(key, (y = groundAt(x, z)));
    }
    return y;
  };
  for (const { view, at } of items) {
    if (view.kind !== "ground") continue;
    const ring = worldRing(view.outline, at);
    if (ring.length >= 3) index.add(pieces.push({ ring, lift: SURFACE_LIFT[view.surface], cells: null }) - 1, boundsOf(ring));
  }
  return (x, z) => {
    let top: number | null = null;
    const key = cellOf(x, z);
    for (const i of index.at(x, z)) {
      const p = pieces[i] as (typeof pieces)[number];
      // Triangulated once, when first under a point asked for: most of the city's paving never is.
      p.cells ??= trianglesByCell(p.ring);
      const tris = p.cells.get(key);
      const y = tris ? drapeHeightAt(p.ring, tris, cornerAt, p.lift, x, z) : null;
      if (y !== null && (top === null || y > top)) top = y;
    }
    return top ?? off(x, z);
  };
};
