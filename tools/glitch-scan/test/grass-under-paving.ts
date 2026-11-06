import type { GroundSurface, Vec3, ViewDescriptor } from "../../../packages/core/src";
import { worldRing } from "../../../packages/engine/src/renderer/drones/drone-world";
import { BinIndex } from "../../../packages/engine/src/renderer/mapcity/map-index";
import { type Box2, type P2, boundsOf, pointInRing, signedArea, triangulate } from "../../../packages/engine/src/renderer/mapcity/polygon";

/**
 * `grass-under-paving` (G-421): a piece of the drawn grass with more than `MIN_AREA` of it under a
 * square's or a cobbled area's paving. The paving lies a few centimetres over the grass
 * (`SURFACE_LIFT`), so a lawn or a flowerbed mapped inside a square is drawn but never seen: Plac
 * Litewski all paving where a third of it is lawns. Read off the paving's triangles as the renderer
 * lays them (`triangulate`), so a hole it is given counts as open only if it is drawn open.
 */

type Finding = { readonly at: string; readonly what: string };
type Item = { readonly view: ViewDescriptor; readonly at: Vec3 };

/** The surfaces drawn over the grass where they overlap it and not meant to (paths and roads across a park are). */
const PAVING: ReadonlySet<GroundSurface> = new Set(["square", "cobble"]);
/** The grid the grass is sampled on (m). */
const STEP = 0.5;
/** The least area of a piece under the paving to count (m²): over a tree's pit or a sliver along a shared edge. */
export const MIN_AREA = 20;

/** The share of a paving's area on a lawn above which it is a patch of the lawn's park, not a square over it. */
const IN_LAWN = 0.9;

type Paving = { readonly tris: readonly (readonly [P2, P2, P2])[]; readonly box: Box2; readonly area: number };

const cross = (a: P2, b: P2, p: P2): number => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
const inTri = (p: P2, [a, b, c]: readonly [P2, P2, P2]): boolean => {
  const s = Math.sign(cross(a, b, c));
  return s !== 0 && cross(a, b, p) * s >= 0 && cross(b, c, p) * s >= 0 && cross(c, a, p) * s >= 0;
};
const inBox = (p: P2, b: Box2): boolean => p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ;

const pavingOf = (ring: readonly P2[]): Paving => {
  const t = triangulate(ring);
  const tris: [P2, P2, P2][] = [];
  for (let k = 0; k + 2 < t.length; k += 3) tris.push([ring[t[k]!]!, ring[t[k + 1]!]!, ring[t[k + 2]!]!]);
  return { tris, box: boundsOf(ring), area: Math.abs(signedArea(ring)) };
};

/** The area of each drawn piece of grass under the paving (m², on the `STEP` grid), with a point of it. */
export const grassUnderPaving = (items: readonly Item[]): { readonly at: P2; readonly area: number }[] => {
  const grass: P2[][] = [];
  const paving: Paving[] = [];
  const index = new BinIndex();
  for (const { view, at } of items) {
    if (view.kind !== "ground" || (view.surface !== "grass" && !PAVING.has(view.surface))) continue;
    const ring = worldRing(view.outline, at);
    if (ring.length < 3) continue;
    if (view.surface === "grass") grass.push(ring);
    else index.add(paving.push(pavingOf(ring)) - 1, boundsOf(ring));
  }
  const out: { at: P2; area: number }[] = [];
  for (const ring of grass) {
    const box = boundsOf(ring);
    const over = [...index.within(box)].map((i) => paving[i]!).filter((p) => p.box.minX < box.maxX && p.box.maxX > box.minX && p.box.minZ < box.maxZ && p.box.maxZ > box.minZ);
    if (over.length === 0) continue;
    const samples: P2[] = [];
    for (let x = Math.floor(box.minX / STEP) * STEP + STEP / 2; x < box.maxX; x += STEP) {
      for (let z = Math.floor(box.minZ / STEP) * STEP + STEP / 2; z < box.maxZ; z += STEP) if (pointInRing({ x, z }, ring)) samples.push({ x, z });
    }
    // A paving laid all in the lawn is a paved patch of a park, drawn over it as it should be.
    const covering = over.map((q) => samples.filter((p) => inBox(p, q.box) && q.tris.some((t) => inTri(p, t)))).filter((under, k) => under.length * STEP * STEP < IN_LAWN * over[k]!.area);
    const under = new Set(covering.flat());
    const first = samples.find((p) => under.has(p));
    if (first) out.push({ at: first, area: under.size * STEP * STEP });
  }
  return out;
};

/** `grass-under-paving`: one per drawn piece of grass more than `MIN_AREA` of which lies under a square's or a cobbled area's paving. */
export const grassUnderPavingFindings = (items: readonly Item[]): Finding[] =>
  grassUnderPaving(items)
    .filter((g) => g.area > MIN_AREA)
    .map((g) => ({ at: `${g.at.x.toFixed(0)},${g.at.z.toFixed(0)}`, what: `grass under paving: ${g.area.toFixed(1)} m²` }));
