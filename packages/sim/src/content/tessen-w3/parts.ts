import { type BarrierKind, type BarrierMaterial, type GroundPoint, type StreetPropItem, type Vec3, type ViewDescriptor, barrierVariant } from "@seki/core";
import type { BlockMaterial, StaticProp } from "../builders";
import type { PrismDef } from "../../world/prism";
import { barrierPieces, barrierProps } from "../lublin/barriers";
import { W3_Y } from "./site";

/**
 * Building parts of W-3 (ADR-0082) in world metres, heights over the halls' floor `W3_Y`: boxes,
 * the map city's industrial buildings for the walls the eye sees from afar, and the fences laid
 * as the map's barriers (ADR-0077), drawn with the furniture.
 */

const at = (x: number, y: number, z: number): Vec3 => ({ x, y: W3_Y + y, z });

/** A box over the ranges (y over the floor), solid by default. */
export const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material: BlockMaterial, solid = true): StaticProp => ({
  center: at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
  view: { kind: "block", size: { x: x1 - x0, y: y1 - y0, z: z1 - z0 }, material },
  solid,
});

/** A walkable slab whose top is at `top` over the floor. */
export const slabTop = (x0: number, x1: number, z0: number, z1: number, top: number, thickness = 0.3, material: BlockMaterial = "concrete"): StaticProp =>
  box(x0, x1, top - thickness, top, z0, z1, material);

/** A railing on a floor at `floor` over the halls' floor. */
export const railing = (x0: number, x1: number, z0: number, z1: number, floor: number, height = 1.05): StaticProp => box(x0, x1, floor, floor + height, z0, z1, "metal");

/** Seen nowhere: the renderer draws the city's buildings and the fences from the scenery. */
const NO_VIEW: ViewDescriptor = { kind: "street-props", items: [] };

const signedArea = (ring: readonly GroundPoint[]): number => {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i] as GroundPoint;
    const q = ring[(i + 1) % ring.length] as GroundPoint;
    a += p.x * q.z - q.x * p.z;
  }
  return a / 2;
};

/** The ring counter-clockwise seen from above, as the map city's outlines are. */
export const counterClockwise = (ring: readonly GroundPoint[]): readonly GroundPoint[] => (signedArea(ring) >= 0 ? ring : [...ring].reverse());

/** A W-3 building drawn by the map city: its solid (a prism over a convex outline) and its view. */
export interface ShellPart {
  readonly prop: StaticProp;
  readonly view: ViewDescriptor;
  readonly at: Vec3;
}

/**
 * An industrial building of the map city over a convex outline (world points), from the floor
 * to `top`; its solid ends at `solidTop`. The renderer lays a parapet inside the top of the
 * walls, its roof `atticHeight` under the top: the looks are chosen so that is 1.2 m and the
 * drawn roof meets the solid's (`packages/engine/test/w3-shell.test.ts`).
 */
export const shellPart = (outline: readonly GroundPoint[], top: number, levels: number, look: number, solidTop = top): ShellPart => {
  const ring = counterClockwise(outline);
  const xs = ring.map((p) => p.x);
  const zs = ring.map((p) => p.z);
  const c = at((Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2);
  const rel = ring.map((p) => ({ x: Math.round((p.x - c.x) * 100) / 100, z: Math.round((p.z - c.z) * 100) / 100 }));
  const view: ViewDescriptor = { kind: "building", outline: rel, height: top, levels, use: "industrial", look };
  const prism: PrismDef = { points: rel, bottom: 0, top: solidTop };
  return { prop: { center: c, view, solid: true, prisms: [prism], scenery: true }, view, at: c };
};

/** A rectangle's corners. */
export const rectRing = (x0: number, x1: number, z0: number, z1: number): GroundPoint[] => [
  { x: x0, z: z0 },
  { x: x1, z: z0 },
  { x: x1, z: z1 },
  { x: x0, z: z1 },
];

/** A barrier along a line on a given ground: the pieces to draw. */
export const barrierLine = (kind: BarrierKind, height: number, line: readonly GroundPoint[], groundAt: (x: number, z: number) => number, material: BarrierMaterial = "metal"): StreetPropItem[] =>
  barrierPieces(kind, height, line, groundAt, material);

/**
 * A wall along a line that nobody sees, from `floor` (world y) up `height`: the invisible fence
 * over the water's edge, as the docks' was, till Seki can swim (ADR-0082). A body stops at it;
 * the eye, a shot and the camera pass.
 */
export const unseenWall = (line: readonly GroundPoint[], floor: number, height: number): StaticProp[] =>
  barrierProps(barrierPieces("fence", height, line, () => floor)).map((p): StaticProp => ({ ...p, view: NO_VIEW }));

/** The solids of drawn barrier pieces. */
export const barrierSolids = (items: readonly StreetPropItem[]): StaticProp[] => barrierProps(items);

/** One drawn piece of a given kind standing at (x, y, z) world, `length` along yaw. */
export const barrierPiece = (kind: BarrierKind, x: number, y: number, z: number, yaw: number, length: number, height: number, material: BarrierMaterial = "metal"): StreetPropItem => ({
  prop: "barrier",
  x: Math.round(x * 100) / 100,
  y: Math.round(y * 100) / 100,
  z: Math.round(z * 100) / 100,
  yaw,
  variant: barrierVariant({ kind, length, height, rise: 0, material }),
});
