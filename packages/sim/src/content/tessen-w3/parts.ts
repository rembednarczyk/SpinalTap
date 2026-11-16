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
export const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material: BlockMaterial = "concrete", solid = true): StaticProp => ({
  center: at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
  view: { kind: "block", size: { x: x1 - x0, y: y1 - y0, z: z1 - z0 }, material },
  solid,
});

/**
 * A row of lockers along x, `count` cabinets of equal width: each hides one body (ADR-0065,
 * ADR-0082 §2 "Kryjówki ciał").
 */
export const lockers = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, count: number): StaticProp[] => {
  const w = (x1 - x0) / count;
  return Array.from({ length: count }, (_, i) => ({ ...box(x0 + i * w, x0 + (i + 1) * w, y0, y1, z0, z1, "metal"), hide: "locker" as const }));
};

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

/**
 * A shell the game walks into (ADR-0082 stage 2): its solid is only the roof slab, `slab` thick
 * under the solid's top (the walls are the interior's blocks), and its facade has openings
 * (`doorways`, world x and z, heights over the floor).
 */
export interface ShellHollow {
  readonly slab: number;
  readonly doorways?: readonly { readonly at: GroundPoint; readonly width: number; readonly bottom: number; readonly top: number }[];
}

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
export const shellPart = (outline: readonly GroundPoint[], top: number, levels: number, look: number, solidTop = top, hollow?: ShellHollow): ShellPart => {
  const ring = counterClockwise(outline);
  const xs = ring.map((p) => p.x);
  const zs = ring.map((p) => p.z);
  const c = at((Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2);
  const rel = ring.map((p) => ({ x: Math.round((p.x - c.x) * 100) / 100, z: Math.round((p.z - c.z) * 100) / 100 }));
  const doorways = (hollow?.doorways ?? []).map((d) => ({ ...d, at: { x: Math.round((d.at.x - c.x) * 100) / 100, z: Math.round((d.at.z - c.z) * 100) / 100 } }));
  const view: ViewDescriptor = { kind: "building", outline: rel, height: top, levels, use: "industrial", look, ...(doorways.length > 0 ? { doorways } : {}) };
  const prism: PrismDef = { points: rel, bottom: hollow ? solidTop - hollow.slab : 0, top: solidTop };
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

/** An opening in a wall: from `from` to `to` along it, from `bottom` (absent: the wall's foot) up to `top`. */
export interface WallGap {
  readonly from: number;
  readonly to: number;
  readonly top: number;
  readonly bottom?: number;
}

/** A door's opening in a wall along its axis: `at` its middle, `width` wide, up to `height`. */
export const doorGap = (at: number, width: number, height: number): WallGap => ({ from: at - width / 2, to: at + width / 2, top: height });

/**
 * A wall from `a0` to `a1` along its axis, `b0`..`b1` across it, from `y0` to `y1` over the floor,
 * with openings: the pieces either side of each, a lintel over it and a sill under it.
 */
const wallAlong = (axis: "x" | "z", a0: number, a1: number, b0: number, b1: number, y0: number, y1: number, gaps: readonly WallGap[], material: BlockMaterial): StaticProp[] => {
  const piece = (u0: number, u1: number, v0: number, v1: number): StaticProp => (axis === "x" ? box(u0, u1, v0, v1, b0, b1, material) : box(b0, b1, v0, v1, u0, u1, material));
  const out: StaticProp[] = [];
  let at = a0;
  for (const g of [...gaps].sort((p, q) => p.from - q.from)) {
    if (g.from > at) out.push(piece(at, g.from, y0, y1));
    if (g.top < y1) out.push(piece(g.from, g.to, g.top, y1));
    const bottom = g.bottom ?? y0;
    if (bottom > y0) out.push(piece(g.from, g.to, y0, bottom));
    at = Math.max(at, g.to);
  }
  if (at < a1) out.push(piece(at, a1, y0, y1));
  return out;
};

/** A wall along x (x0..x1) between z0 and z1, with openings along x. */
export const wallX = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, gaps: readonly WallGap[] = [], material: BlockMaterial = "concrete"): StaticProp[] =>
  wallAlong("x", x0, x1, z0, z1, y0, y1, gaps, material);

/** A wall along z (z0..z1) between x0 and x1, with openings along z. */
export const wallZ = (z0: number, z1: number, x0: number, x1: number, y0: number, y1: number, gaps: readonly WallGap[] = [], material: BlockMaterial = "concrete"): StaticProp[] =>
  wallAlong("z", z0, z1, x0, x1, y0, y1, gaps, material);

const plainBlock = (p: StaticProp): boolean => p.view.kind === "block" && !p.view.slope && !p.view.rungs && !p.mechanism;

/**
 * Parts of an interior (ADR-0038): `interior` on the prop for the minimap and on its block view.
 * They are scenery (ADR-0082 §4): the entity is the solid alone, and the renderer bakes the hall's
 * inside from `W3_INSIDE_BLOCKS` with its own detail and light. Stairs, ladders and doors stay as they are.
 */
export const indoor = (props: readonly StaticProp[]): StaticProp[] =>
  props.map((p) => (plainBlock(p) && p.view.kind === "block" ? { ...p, interior: true, scenery: true, view: { ...p.view, interior: true } } : p));

/**
 * Outdoor blocks drawn merged like an interior's (ADR-0038: one mesh per area, no moon shadow),
 * not indoor on the minimap: the low boxes' walls, the cooling units, the hatch's curb. Each
 * plain block is a mesh of its own otherwise (stage 2 would add some twenty to `w3-zewnatrz`).
 */
export const merged = (props: readonly StaticProp[]): StaticProp[] => props.map((p) => (plainBlock(p) && p.view.kind === "block" ? { ...p, view: { ...p.view, interior: true } } : p));
