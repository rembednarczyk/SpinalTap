import type { GroundPoint, StreetPropItem, StreetPropKind, ViewDescriptor } from "@seki/core";
import type { PrismDef } from "../../world/prism";
import type { StaticProp } from "../builders";

/**
 * Street furniture as solids of the simulation (ADR-0050). The renderer draws every piece of
 * `LUBLIN_STREET_PROPS` as scenery (ADR-0047); here the pieces a body really stumbles on get
 * cheap convex prisms in the piece's own frame (front +z, foot at the origin, turned by its
 * yaw like the renderer's models): benches, bollards, bins, lamp posts, tree trunks, kiosks,
 * bus shelters, machines, columns and monuments, bike racks with their bikes, hydrants, food
 * carts and containers, the market's stock and the food booths. Small things (manholes, plates, signs, planters, shrubs, wall lanterns
 * on facades) have none.
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
const SHAPES: Partial<Record<StreetPropKind, number>> = { bench: 2, tree: 3, monument: 6, artwork: 6, flagpole: 2, "bike-rack": 4, container: 2, "market-goods": 4 };
const shapeOf = (kind: StreetPropKind, variant: number): number => variant % (SHAPES[kind] ?? 1);
/** Trees grow 0.8 to 1.25 (bits 4 to 7), like the renderer's `scaleOf`. */
const treeScale = (variant: number): number => 0.8 + 0.45 * (((variant >> 4) % 16) / 15);

/**
 * A granite bollard of the old town (G-032), as the renderer draws it: `side` square, `height`
 * to the tip of its cap, `chain` the radius of its chain. Its `variant` holds its chains
 * (`bollardChains` in `bollards.ts`).
 */
export const BOLLARD = { side: 0.34, height: 1.05, chain: 0.018 } as const;

/** Monument and artwork solids by shape: obelisk, figure on a plinth, Koziołek, abstract, stele, wayside shrine. */
const MONUMENT_PARTS: readonly Box[] = [box(0, 0, 1.4, 1.4, 11), box(0, 0, 0.9, 0.9, 3.5), box(0, 0, 0.45, 0.3, 1.2), box(0, 0, 0.5, 0.5, 2.6), box(0, 0, 0.65, 0.35, 1.65), box(0, 0, 0.45, 0.45, 3.1)];

/**
 * The market's stock beside a stall (ADR-0058 stage 3), by shape: cartons on a pallet, barrels,
 * crates of produce, goods under a canvas on posts.
 */
const MARKET_GOODS: readonly Box[] = [box(0, 0, 0.6, 0.4, 1.0), box(0, 0, 0.62, 0.32, 0.95), box(0, 0, 0.55, 0.4, 0.9), box(0, 0, 0.7, 0.5, 1.4)];

/**
 * A food booth (yatai, ADR-0058 stage 3) in its frame, front +z where the customers sit: the counter
 * 2.1 x 0.6 m, the roof on four posts 2.4 m tall over it and the cook behind it, three stools.
 */
export const FOOD_STALL = {
  counter: { x: 0, z: 0.1, hx: 1.05, hz: 0.3, top: 1.05 },
  posts: [
    [-1.05, -0.7],
    [1.05, -0.7],
    [-1.05, 0.4],
    [1.05, 0.4],
  ] as const,
  roof: 2.4,
  stools: [-0.65, 0, 0.65] as const,
  stoolZ: 0.85,
} as const;

/** The parts of each solid kind, by shape. Heights are above the foot. */
const PARTS: Partial<Record<StreetPropKind, (shape: number, variant: number) => readonly Part[]>> = {
  // Shape 0 the long ława of the squares (no back), 1 the bench with a back.
  bench: (s) => (s === 0 ? [box(0, 0, 1.1, 0.27, 0.55)] : [box(0, -0.03, 0.9, 0.3, 1.0)]),
  bollard: () => [box(0, 0, BOLLARD.side / 2, BOLLARD.side / 2, BOLLARD.height)],
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
  "street-cabinet": () => [box(0, 0, 0.4, 0.18, 1.15)],
  // The counter at the front and the four posts of the canvas roof; open at the back.
  "market-stall": () => [box(0, 0.55, 1.05, 0.25, 1.05), ...[-1, 1].flatMap((x) => [post(0.06, 2.3, x, -0.7), post(0.06, 2.3, x, 0.7)])],
  "ticket-machine": () => [box(0, 0, 0.28, 0.2, 1.75)],
  "bike-station": () => [box(-1.6, 0, 0.21, 0.15, 2.2)],
  "traffic-signal": () => [post(0.09, 3.3)],
  "trolley-pole": () => [post(0.15, 8)],
  flagpole: (s) => [post(s === 1 ? 0.36 : 0.11, s === 1 ? 35 : 8.5)],
  monument: (s) => [MONUMENT_PARTS[s] ?? MONUMENT_PARTS[3]!],
  artwork: (s) => [MONUMENT_PARTS[s] ?? MONUMENT_PARTS[3]!],
  // ADR-0058 stage 2. The rack's three hoops with the bikes and scooters parked across them
  // (1.66 m long), a free-standing cash machine, a fire hydrant, a food cart 3.9 x 1.5 m under
  // its roof and a 20 ft shipping container.
  "bike-rack": () => [box(0, 0, 0.85, 0.83, 1.1)],
  atm: () => [box(0, 0, 0.35, 0.3, 1.75)],
  hydrant: () => [post(0.17, 0.9)],
  "food-cart": () => [box(0, 0, 1.95, 0.75, 2.65)],
  container: () => [box(0, 0, 3.03, 1.22, 2.6)],
  // ADR-0058 stage 3. The market's stock by shape (`MARKET_GOODS`), and a food booth: its counter,
  // the four posts of its roof and three stools in front.
  "market-goods": (s) => [MARKET_GOODS[s] ?? MARKET_GOODS[0]!],
  "food-stall": () => [
    box(FOOD_STALL.counter.x, FOOD_STALL.counter.z, FOOD_STALL.counter.hx, FOOD_STALL.counter.hz, FOOD_STALL.counter.top),
    ...FOOD_STALL.posts.map(([x, z]) => post(0.06, FOOD_STALL.roof, x, z)),
    ...FOOD_STALL.stools.map((x) => post(0.18, 0.75, x, FOOD_STALL.stoolZ)),
  ],
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

/**
 * The chains of the bollards (G-032). A bollard holds up to two chains, read from its
 * `variant`: bits 0-8 where its chain along its +x ends (cm from its centre, at the next post's
 * face or a lamp's shaft), bits 9-17 where a second chain ends, behind it, towards a lamp of the
 * row, and bits 18-24 that chain's turn off its -x (degrees + 64); 0 for none.
 */

/** Radius of a pole's shaft at the chain's height, as the renderer draws it: the poles a row of bollards may run its chain through (G-032). */
export const POLE_SHAFT: Readonly<Partial<Record<StreetPropKind, number>>> = {
  "lamp-pastoral": 0.09,
  "lamp-road": 0.11,
  "lamp-modern-pole": 0.07,
  "lamp-candelabra": 0.13,
  "lamp-park": 0.055,
  "traffic-signal": 0.07,
  "trolley-pole": 0.135,
};

/** A chain a bollard holds: the yaw that turns the post's +x along it (the renderer's frame) and where it ends (m from the centre). */
export interface BollardChain {
  readonly yaw: number;
  readonly end: number;
  /** The chain behind the post, back to a lamp. */
  readonly back: boolean;
}

const cm = (m: number): number => Math.max(0, Math.min(0x1ff, Math.round(m * 100)));

/** The variant of a bollard with a chain ending `fwd` metres along its +x, and one `back` metres behind it, turned `turn` radians off its -x (towards +z). */
export const chainVariant = (fwd: number, back = 0, turn = 0): number => {
  const deg = Math.max(-64, Math.min(63, Math.round((turn * 180) / Math.PI)));
  return cm(fwd) + (back > 0 ? cm(back) * 0x200 + (deg + 64) * 0x40000 : 0);
};

/** A bollard's chains; none for other kinds. */
export const bollardChains = (item: StreetPropItem): BollardChain[] => {
  if (item.prop !== "bollard") return [];
  const v = item.variant;
  const out: BollardChain[] = [];
  const fwd = (v & 0x1ff) / 100;
  const back = ((v >> 9) & 0x1ff) / 100;
  if (fwd > BOLLARD.side / 2) out.push({ yaw: item.yaw, end: fwd, back: false });
  if (back > BOLLARD.side / 2) {
    const turn = ((((v >> 18) & 0x7f) - 64) * Math.PI) / 180;
    const d = turnLocal(item.yaw, -Math.cos(turn), Math.sin(turn));
    out.push({ yaw: Math.atan2(-d.z, d.x), end: back, back: true });
  }
  return out;
};

/** A bollard without some of its chains (whose far end the game left out). */
export const dropChains = (item: StreetPropItem, drop: readonly BollardChain[]): StreetPropItem => {
  const fwd = drop.some((c) => !c.back) ? 0 : item.variant & 0x1ff;
  const back = drop.some((c) => c.back) ? 0 : item.variant & ~0x1ff;
  return { ...item, variant: fwd + back };
};

/** The world direction a chain's yaw turns a post's +x to. */
export const chainDir = (yaw: number): GroundPoint => ({ x: Math.cos(yaw), z: -Math.sin(yaw) });

/** A bollard's chains in the world, from its face to their ends. */
export const chainSegments = (item: StreetPropItem): { from: GroundPoint; to: GroundPoint }[] =>
  bollardChains(item).map((c) => {
    const d = chainDir(c.yaw);
    return { from: { x: item.x + d.x * (BOLLARD.side / 2), z: item.z + d.z * (BOLLARD.side / 2) }, to: { x: item.x + d.x * c.end, z: item.z + d.z * c.end } };
  });

/** Points along a segment every `step` metres or less, both ends included. */
export const alongSegment = (a: GroundPoint, b: GroundPoint, step: number): GroundPoint[] => {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step));
  return Array.from({ length: n + 1 }, (_, k) => ({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n }));
};

/** Is `piece` what a chain ending at `end` hangs on: a pole whose shaft it reaches? */
export const anchors = (piece: StreetPropItem, end: GroundPoint): boolean => {
  const r = POLE_SHAFT[piece.prop];
  return r !== undefined && Math.hypot(piece.x - end.x, piece.z - end.z) <= r + 0.2;
};

/**
 * Does a chain from `a` to `b` (its two ends) run through the solid of `piece`? Sampled every
 * 5 cm within the chain's radius, a few centimetres short of either end.
 */
export const chainThrough = (a: GroundPoint, b: GroundPoint, piece: StreetPropItem): boolean => {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  if (len <= 0.1) return false;
  const u = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
  return alongSegment({ x: a.x + u.x * 0.05, z: a.z + u.z * 0.05 }, { x: b.x - u.x * 0.05, z: b.z - u.z * 0.05 }, 0.05).some((p) => distanceToPiece(piece, p.x, p.z) <= BOLLARD.chain);
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
