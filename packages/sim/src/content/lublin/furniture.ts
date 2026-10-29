import type { GroundPoint, StreetPropItem, StreetPropKind, ViewDescriptor } from "@seki/core";
import type { PrismDef } from "../../world/prism";
import type { StaticProp } from "../builders";

/**
 * Street furniture as solids of the simulation (ADR-0050). The renderer draws every piece of
 * `LUBLIN_STREET_PROPS` as scenery (ADR-0047); here the pieces a body really stumbles on get
 * cheap convex prisms in the piece's own frame (front +z, foot at the origin, turned by its
 * yaw like the renderer's models): benches, bollards, bins, lamp posts, tree trunks, kiosks,
 * bus shelters, machines, columns and monuments. Small things (manholes, plates, signs,
 * planters, shrubs, wall lanterns on facades) have none.
 */

/** A box in the piece's frame: centre (x, z), half extents, height. */
interface Box {
  readonly x: number;
  readonly z: number;
  readonly hx: number;
  readonly hz: number;
  readonly top: number;
}

/** A round post in the piece's frame: centre, radius, height (an octagon). */
interface Post {
  readonly x: number;
  readonly z: number;
  readonly r: number;
  readonly top: number;
}

type Part = Box | Post;

const box = (x: number, z: number, hx: number, hz: number, top: number): Box => ({ x, z, hx, hz, top });
const post = (r: number, top: number, x = 0, z = 0): Post => ({ x, z, r, top });

/** Shape counts per kind, as the renderer's `PROP_SHAPES` (the low bits of `variant`). */
const SHAPES: Partial<Record<StreetPropKind, number>> = { bench: 2, tree: 3, monument: 4, artwork: 4, flagpole: 2 };
const shapeOf = (kind: StreetPropKind, variant: number): number => variant % (SHAPES[kind] ?? 1);
/** Trees grow 0.8 to 1.25 (bits 4 to 7), like the renderer's `scaleOf`. */
const treeScale = (variant: number): number => 0.8 + 0.45 * (((variant >> 4) % 16) / 15);

/** The parts of each solid kind, by shape. Heights are above the foot. */
const PARTS: Partial<Record<StreetPropKind, (shape: number, variant: number) => readonly Part[]>> = {
  // Shape 0 the long ława of the squares (no back), 1 the bench with a back.
  bench: (s) => (s === 0 ? [box(0, 0, 1.1, 0.27, 0.55)] : [box(0, -0.03, 0.9, 0.3, 1.0)]),
  bollard: () => [box(0, 0, 0.14, 0.14, 0.95)],
  "waste-bin": () => [post(0.28, 0.95)],
  "lamp-pastoral": () => [post(0.2, 4)],
  "lamp-candelabra": () => [box(0, 0, 0.32, 0.32, 3.4)],
  "lamp-modern-pole": () => [box(0, 0, 0.17, 0.17, 7.5)],
  "lamp-road": () => [box(0, 0, 0.19, 0.19, 8)],
  "lamp-park": () => [post(0.12, 3.5)],
  tree: (_s, variant) => [post(0.28 * treeScale(variant), 3)],
  kiosk: () => [box(0, 0, 1.3, 1.0, 2.7)],
  // The glass back and side, the ad screen and the bench; open at the front.
  "bus-shelter": () => [box(0, -0.66, 1.74, 0.05, 2.5), box(-1.7, -0.05, 0.05, 0.6, 2.5), box(1.72, -0.05, 0.05, 0.55, 2.2), box(0, -0.4, 1.1, 0.19, 0.5)],
  "advertising-column": () => [post(0.68, 3)],
  "vending-machine": () => [box(0, 0, 0.5, 0.38, 1.9)],
  "ticket-machine": () => [box(0, 0, 0.28, 0.2, 1.75)],
  "bike-station": () => [box(-1.6, 0, 0.21, 0.15, 2.2)],
  "traffic-signal": () => [post(0.09, 3.3)],
  "trolley-pole": () => [post(0.15, 8)],
  flagpole: (s) => [post(s === 1 ? 0.36 : 0.11, s === 1 ? 35 : 8.5)],
  // Obelisk, figure on a plinth, Koziołek, abstract.
  monument: (s) => [s === 0 ? box(0, 0, 1.4, 1.4, 11) : s === 1 ? box(0, 0, 0.9, 0.9, 3.5) : s === 2 ? box(0, 0, 0.45, 0.3, 1.2) : box(0, 0, 0.5, 0.5, 2.6)],
  artwork: (s) => [s === 0 ? box(0, 0, 1.4, 1.4, 11) : s === 1 ? box(0, 0, 0.9, 0.9, 3.5) : s === 2 ? box(0, 0, 0.45, 0.3, 1.2) : box(0, 0, 0.5, 0.5, 2.6)],
};

/** Kinds that are solids. */
export const SOLID_FURNITURE: ReadonlySet<StreetPropKind> = new Set(Object.keys(PARTS) as StreetPropKind[]);

/** Below the foot, so a piece on a slope still meets the ground on its low side (m). */
const SINK = 0.3;

/** A point of the piece's frame turned by its yaw (the renderer's convention: +z towards +x). */
export const turnLocal = (yaw: number, x: number, z: number): GroundPoint => {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: x * c + z * s, z: -x * s + z * c };
};

const prismOf = (yaw: number, part: Part): PrismDef => {
  const corners: GroundPoint[] = [];
  if ("r" in part) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      corners.push(turnLocal(yaw, part.x + Math.cos(a) * part.r, part.z + Math.sin(a) * part.r));
    }
  } else {
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      corners.push(turnLocal(yaw, part.x + sx * part.hx, part.z + sz * part.hz));
    }
  }
  return { points: corners, bottom: -SINK, top: part.top };
};

/** The prisms of one piece, relative to its foot; none for a kind without a solid. */
export const furniturePrisms = (item: StreetPropItem): PrismDef[] => {
  const parts = PARTS[item.prop]?.(shapeOf(item.prop, item.variant), item.variant) ?? [];
  return parts.map((p) => prismOf(item.yaw, p));
};

/** The footprint radius of a piece's solid (the farthest corner from its foot), 0 without one. */
export const furnitureRadius = (item: StreetPropItem): number => {
  let r = 0;
  for (const p of furniturePrisms(item)) for (const q of p.points) r = Math.max(r, Math.hypot(q.x, q.z));
  return r;
};

/** Distance from (x, z) to the footprint of a piece's solid (0 inside; Infinity without one). */
export const distanceToPiece = (item: StreetPropItem, x: number, z: number): number => {
  let best = Infinity;
  for (const p of furniturePrisms(item)) {
    const pts = p.points;
    let inside = true;
    let edge = Infinity;
    let sign = 0;
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k] as GroundPoint;
      const b = pts[(k + 1) % pts.length] as GroundPoint;
      const ax = item.x + a.x;
      const az = item.z + a.z;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const cross = dx * (z - az) - dz * (x - ax);
      if (sign === 0 && cross !== 0) sign = Math.sign(cross);
      else if (cross * sign < 0) inside = false;
      const len2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
      edge = Math.min(edge, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
    }
    best = Math.min(best, inside ? 0 : edge);
  }
  return best;
};

/** Seen nowhere: the renderer draws the piece from the scenery's `street-props` view. */
const NO_VIEW: ViewDescriptor = { kind: "street-props", items: [] };

/** The solid pieces of a chunk's furniture as scenery props of the game, in table order. */
export const furnitureProps = (items: readonly StreetPropItem[]): StaticProp[] =>
  items.flatMap((item) => {
    const prisms = furniturePrisms(item);
    if (prisms.length === 0) return [];
    return [{ center: { x: item.x, y: item.y, z: item.z }, view: NO_VIEW, solid: true, prisms, scenery: true, seeThrough: true } satisfies StaticProp];
  });
