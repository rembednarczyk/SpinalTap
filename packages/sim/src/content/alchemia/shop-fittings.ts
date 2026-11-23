import { type StreetPropItem, type StreetPropKind, roomDetailShape } from "@seki/core";
import { type Piece, type PieceKind, piece } from "./plan";
import { SHOP_DOOR, type ShopDef, type ShopFrame, shopCeiling, shopFloor, shopFrame, shopWall } from "./shops-plan";
import type { ShopTrade } from "./shop-types";

/*
 * A shop's fittings in its frame (ADR-0093 O2, `docs/zasady-lokacji.md` §2): where its wall racks, its
 * island, its window display, its counter and its back shelf stand on its sales floor (`shopLayout`),
 * and the builders that put a fixture there: what is at a body's height and stops someone a solid of
 * its box, what is on it or over the head drawn only (goods on the shelves, cups, pipes, cables).
 * Deterministic: a hash of the shop and the place, never `Math.random`.
 */

/** A rectangle of a shop's frame: `u` along its front, `v` in from it. */
export interface Slot {
  readonly u0: number;
  readonly u1: number;
  readonly v0: number;
  readonly v1: number;
}
export interface Spot {
  readonly u: number;
  readonly v: number;
}

/**
 * The slots of a sales floor `w` wide and `s` deep, its door on the left: the way in from the door
 * to the counter stays clear (at least 1.5 m, an NPC's way), the counter shuts off the seller's side
 * (its gaps under 0.76 m, a body's breadth), the seller stands behind it and a customer before it.
 */
export interface Layout {
  readonly door: { readonly u0: number; readonly u1: number };
  /** The way from the door to the customer's place before the counter. */
  readonly aisle: Slot;
  readonly counter: Slot;
  readonly seller: Spot;
  readonly customer: Spot;
  /** The back-of-house door from the seller's side (`u` in a rear wall, `v` in a side wall). */
  readonly backDoor: { readonly a0: number; readonly a1: number };
  readonly leftRack: Slot | null;
  readonly rightRack: Slot | null;
  readonly islands: readonly Slot[];
  readonly window: Slot | null;
  readonly back: Slot | null;
  /** Along the counter (`side`) or across the back of the sales floor. */
  readonly side: boolean;
}

const slot = (u0: number, u1: number, v0: number, v1: number): Slot => ({ u0, u1, v0, v1 });

/** The sales floor's layout: deep (7.9 m strips), shallow (4.9 m ones) or narrow (under 4.3 m wide, its counter along the side); its partitions `W` thick. */
export const shopLayout = (w: number, s: number, corner: boolean, W: number): Layout => {
  if (w < 4.3) {
    const counter = slot(w - 1.75, w - 1.0, 0.75, s - 0.55);
    const mid = (counter.v0 + counter.v1) / 2;
    return {
      door: { u0: 0.4, u1: 0.4 + SHOP_DOOR },
      aisle: slot(0.55, w - 1.75, 0, s),
      counter,
      seller: { u: w - W - 0.42, v: mid },
      customer: { u: w - 2.3, v: mid },
      backDoor: { a0: w - 1.0, a1: w - 0.2 },
      leftRack: slot(W, 0.55, 2.1, s - 0.1),
      rightRack: null,
      islands: [],
      window: null,
      back: null,
      side: true,
    };
  }
  if (s < 4.5) {
    const counter = slot(0.55, w - 0.75, s - 1.6, s - 0.9);
    const mid = (2.3 + counter.u1) / 2;
    return {
      door: { u0: 0.5, u1: 0.5 + SHOP_DOOR },
      aisle: slot(W, 2.3, 0, counter.v0),
      counter,
      seller: { u: mid, v: s - 0.45 },
      customer: { u: mid, v: counter.v0 - 0.7 },
      backDoor: { a0: w - 1.1, a1: w - 0.2 },
      leftRack: slot(W, 0.55, counter.v0, s - 0.1),
      rightRack: null,
      islands: [],
      window: w - 1.3 - mid >= 0.6 ? slot(w - 1.3, w - 0.2, 0.15, 0.6) : null,
      back: null,
      side: false,
    };
  }
  const counter = slot(0.6, w - 0.75, s - 2.1, s - 1.35);
  const mid = (2.4 + counter.u1) / 2;
  // No island where it would leave the customer under a metre before the counter (a shallower unit of the front's, ADR-0093 O5).
  const islands = w - 0.9 - 2.9 >= 0.6 && counter.v0 - 2.1 >= 0.95 ? [slot(2.9, w - 0.9, 1.0, 2.1), ...(s >= 7 ? [slot(2.9, w - 0.9, 3.0, 4.1)] : [])] : [];
  return {
    door: { u0: 0.75, u1: 0.75 + SHOP_DOOR },
    aisle: slot(0.6, 2.4, 0, counter.v0),
    counter,
    seller: { u: mid, v: s - 0.87 },
    customer: { u: mid, v: counter.v0 - 0.6 },
    backDoor: corner ? { a0: s - 1.3, a1: s - 0.45 } : { a0: w - 1.2, a1: w - 0.3 },
    leftRack: slot(W, 0.6, 0.9, counter.v0 - 0.1),
    rightRack: counter.v0 - 0.25 - 0.9 >= 0.8 ? slot(w - 0.6, w - W, 0.9, counter.v0 - 0.25) : null,
    islands,
    window: slot(2.6, w - 0.3, 0.15, 0.6),
    back: slot(2.4, w - 1.3, s - 0.4, s),
    side: false,
  };
};

/** A hash of a string and two numbers into [0, 1): the shop's own variation. */
export const shopHash = (key: string, a = 0, b = 0): number => {
  let h = 2166136261 ^ Math.round(a * 97 + b * 131);
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

/** What one shop's fittings put into the world. */
export interface Fit {
  readonly shop: ShopDef;
  readonly f: ShopFrame;
  readonly y: number;
  readonly c: number;
  /** Its partitions' thickness. */
  readonly wall: number;
  /** Drawn pieces (some of them solid). */
  readonly pieces: Piece[];
  /** Solids not drawn: the box of a fixture drawn as its parts. */
  readonly solids: Piece[];
  /** The game's models (street furniture) in it. */
  readonly props: StreetPropItem[];
  /** The rooms' detail built by Blender (ADR-0098): the goods on its shelves. Drawn only. */
  readonly detail: StreetPropItem[];
  /** The marks of somebody just gone (`docs/zasady-lokacji.md` §5), by name. */
  readonly traces: string[];
}

export const newFit = (shop: ShopDef): Fit => ({ shop, f: shopFrame(shop), y: shopFloor(shop), c: shopCeiling(shop), wall: shopWall(shop), pieces: [], solids: [], props: [], detail: [], traces: [] });

/** A drawn box of the shop's frame, `y0`..`y1` over its floor; solid when `solid`. */
export const draw = (k: Fit, s: Slot, y0: number, y1: number, kind: PieceKind, solid = false): void => {
  k.pieces.push(piece(k.f.box(s.u0, s.u1, s.v0, s.v1, k.y + y0, k.y + y1), kind, true, solid));
};
/** A solid not drawn (a fixture drawn as its parts), from a little under the floor. */
export const block = (k: Fit, s: Slot, top: number): void => {
  k.solids.push(piece(k.f.box(s.u0, s.u1, s.v0, s.v1, k.y - 0.05, k.y + top), "rack", true));
};

/** Which way a model faces: out of the shop, into it, or along +u / -u. */
export type Facing = "out" | "in" | "+u" | "-u";
export const yawOf = (k: Fit, to: Facing): number => (to === "out" ? k.f.out : to === "in" ? k.f.out + Math.PI : to === "+u" ? k.f.along : k.f.along + Math.PI);

/** One of the game's models at (u, v) on the floor (or `up` over it). */
export const model = (k: Fit, prop: StreetPropKind, u: number, v: number, to: Facing, variant = 0, up = 0): void => {
  const p = k.f.point(u, v);
  k.props.push({ prop, x: p.x, y: k.y + up, z: p.z, yaw: yawOf(k, to), variant });
};

/** A model of the rooms' detail (ADR-0098) at (u, v), its foot `up` over the floor, its front (+z) turned `to`. */
export const detail = (k: Fit, key: string, u: number, v: number, up: number, to: Facing): void => {
  const p = k.f.point(u, v);
  const [du, dv] = to === "out" ? [0, -1] : to === "in" ? [0, 1] : to === "+u" ? [1, 0] : [-1, 0];
  const q = k.f.point(u + du, v + dv);
  // A model's front is +z at yaw 0, (sin yaw, cos yaw) turned.
  k.detail.push({ prop: "room-detail", x: p.x, y: k.y + up, z: p.z, yaw: Math.atan2(q.x - p.x, q.z - p.z), variant: roomDetailShape(key) });
};

/** Half a metre of a shelf's goods, one model a trade (`tools/blender/rooms/alchemia_gallery.py`). */
const GOODS_RUN = 0.52;
/** What lies in a glass case by trade (a florist's or a clothes shop's has none: the pawn's odds and ends). */
const CASE_GOODS: Readonly<Record<ShopTrade, string>> = {
  implants: "rd-gl-case-implants",
  electronics: "rd-gl-case-electronics",
  clothing: "rd-gl-case-pawn",
  pharmacy: "rd-gl-case-pharmacy",
  arms: "rd-gl-case-arms",
  repair: "rd-gl-case-repair",
  pawn: "rd-gl-case-pawn",
  tattoo: "rd-gl-case-pawn",
  "synth-food": "rd-gl-case-pharmacy",
  vr: "rd-gl-case-electronics",
  crypto: "rd-gl-case-crypto",
  florist: "rd-gl-case-pawn",
};
const SHELF_GOODS: Readonly<Record<ShopTrade, string>> = {
  implants: "rd-gl-implants",
  electronics: "rd-gl-electronics",
  clothing: "rd-gl-stock",
  pharmacy: "rd-gl-pharmacy",
  arms: "rd-gl-arms",
  repair: "rd-gl-repair",
  pawn: "rd-gl-pawn",
  tattoo: "rd-gl-tattoo",
  "synth-food": "rd-gl-food",
  vr: "rd-gl-vr",
  crypto: "rd-gl-stock",
  florist: "rd-gl-florist",
};

/**
 * A shelf unit on a slot, `h` high, its back on the side away from the customers (`backAt`): uprights
 * at its ends, a back panel, shelves every 0.45 m, goods on each by the shop's trade (Blender's models, drawn only;
 * the back room's `stock`, cartons), its box a solid.
 */
export const shelves = (k: Fit, s: Slot, h: number, backAt: "u0" | "u1" | "v0" | "v1", key: number, stock = false): void => {
  block(k, s, h);
  const alongU = backAt === "v0" || backAt === "v1";
  const t = 0.04;
  const back: Slot =
    backAt === "u0" ? { ...s, u1: s.u0 + t } : backAt === "u1" ? { ...s, u0: s.u1 - t } : backAt === "v0" ? { ...s, v1: s.v0 + t } : { ...s, v0: s.v1 - t };
  draw(k, back, 0, h, "rack");
  const ends: Slot[] = alongU ? [{ ...s, u1: s.u0 + t }, { ...s, u0: s.u1 - t }] : [{ ...s, v1: s.v0 + t }, { ...s, v0: s.v1 - t }];
  for (const e of ends) draw(k, e, 0, h, "rack");
  const len = alongU ? s.u1 - s.u0 : s.v1 - s.v0;
  const goods = stock ? "rd-gl-stock" : SHELF_GOODS[k.shop.trade];
  const n = Math.floor((len - 0.08) / GOODS_RUN);
  const pad = (len - n * GOODS_RUN) / 2;
  const to: Facing = backAt === "v1" ? "out" : backAt === "v0" ? "in" : backAt === "u0" ? "+u" : "-u";
  for (let y = 0.12, i = 0; y < h - 0.3; y += 0.45, i++) {
    draw(k, s, y, y + 0.03, "rack");
    // The goods half a metre at a time, their fronts to the customers, a gap now and then (a sold-out place), the model or its mirror.
    for (let j = 0; j < n; j++) {
      if (shopHash(k.shop.id, key * 31 + i, j * 10 + 3) < 0.12) continue;
      const a = pad + (j + 0.5) * GOODS_RUN;
      detail(k, shopHash(k.shop.id, key * 37 + i, j * 10 + 7) < 0.5 ? goods : `${goods}-b`, alongU ? s.u0 + a : (s.u0 + s.u1) / 2, alongU ? (s.v0 + s.v1) / 2 : s.v0 + a, y + 0.03, to);
    }
  }
};

/** A glass case on a slot: a solid base 0.55 high, its lit top with the trade's goods (Blender's) under a glass lid, 1.0 high in all. */
export const glassCase = (k: Fit, s: Slot, key: number): void => {
  draw(k, s, 0, 0.55, "counter", true);
  block(k, s, 1.0);
  const n = Math.max(2, Math.round(Math.max(s.u1 - s.u0, s.v1 - s.v0) / 0.35));
  const alongU = s.u1 - s.u0 >= s.v1 - s.v0;
  for (let i = 0; i < n; i++) {
    if (shopHash(k.shop.id, key * 17 + i) < 0.2) continue;
    // Blender's piece of the trade on the lit top under the lid, its long side across the case.
    const t = (i + 0.475) / n;
    detail(k, CASE_GOODS[k.shop.trade], alongU ? s.u0 + (s.u1 - s.u0) * t : (s.u0 + s.u1) / 2, alongU ? (s.v0 + s.v1) / 2 : s.v0 + (s.v1 - s.v0) * t, 0.58, alongU ? "out" : "+u");
  }
  draw(k, { u0: s.u0 + 0.03, u1: s.u1 - 0.03, v0: s.v0 + 0.03, v1: s.v1 - 0.03 }, 0.56, 0.58, "lamp");
  draw(k, s, 0.97, 1.0, "vitrine");
};

/** A clothes rail on a slot: two posts and a bar 1.5 high, garments hanging off it (Blender's, drawn), its box a solid. */
export const rail = (k: Fit, s: Slot, key: number): void => {
  block(k, s, 1.6);
  const alongU = s.u1 - s.u0 >= s.v1 - s.v0;
  const [mu, mv] = [(s.u0 + s.u1) / 2, (s.v0 + s.v1) / 2];
  const posts: Slot[] = alongU
    ? [slot(s.u0, s.u0 + 0.04, mv - 0.02, mv + 0.02), slot(s.u1 - 0.04, s.u1, mv - 0.02, mv + 0.02)]
    : [slot(mu - 0.02, mu + 0.02, s.v0, s.v0 + 0.04), slot(mu - 0.02, mu + 0.02, s.v1 - 0.04, s.v1)];
  for (const p of posts) draw(k, p, 0, 1.55, "rack");
  draw(k, alongU ? slot(s.u0, s.u1, mv - 0.015, mv + 0.015) : slot(mu - 0.015, mu + 0.015, s.v0, s.v1), 1.5, 1.55, "rack");
  const len = alongU ? s.u1 - s.u0 : s.v1 - s.v0;
  // Half a metre of garments at a time on their hangers (Blender's), hanging from the bar; a gap where they sold.
  const n = Math.floor((len - 0.1) / 0.5);
  for (let j = 0; j < n; j++) {
    if (shopHash(k.shop.id, key * 13, j * 10 + 1) < 0.15) continue;
    const a = (len - n * 0.5) / 2 + (j + 0.5) * 0.5;
    detail(k, "rd-gl-garments", alongU ? s.u0 + a : mu, alongU ? mv : s.v0 + a, 1.5, alongU ? "out" : "+u");
  }
};

/** A flat screen on a wall or in a window (drawn): a dark bezel the slot's size, the lit picture inset in it and a hair proud of it both ways. */
export const screen = (k: Fit, s: Slot, y0: number, y1: number): void => {
  draw(k, s, y0, y1, "machine");
  const alongU = s.u1 - s.u0 >= s.v1 - s.v0;
  const inset = Math.min(0.04, (y1 - y0) / 6);
  const pic = alongU ? slot(s.u0 + inset, s.u1 - inset, s.v0 - 0.008, s.v1 + 0.008) : slot(s.u0 - 0.008, s.u1 + 0.008, s.v0 + inset, s.v1 - inset);
  draw(k, pic, y0 + inset, y1 - inset, "display");
};

/** Cartons in a stack on the floor (drawn only: small things lie and stand where they fall, §7). */
export const cartons = (k: Fit, at: Spot, n: number, key: number): void => {
  let y = 0;
  for (let i = 0; i < n; i++) {
    const g = shopHash(k.shop.id, key * 7 + i);
    const half = 0.22 + g * 0.14;
    const du = (shopHash(k.shop.id, key, i) - 0.5) * 0.12;
    const h = 0.25 + g * 0.2;
    draw(k, slot(at.u - half + du, at.u + half + du, at.v - half * 0.8, at.v + half * 0.8), y, y + h, "carton");
    y += h;
    if (y > 1.2) break;
  }
};

/** A cup on a top `top` over the floor at (u, v); steaming (somebody was just here, §5) when `hot`. */
export const cup = (k: Fit, at: Spot, top: number, hot: boolean): void => {
  draw(k, slot(at.u - 0.04, at.u + 0.04, at.v - 0.04, at.v + 0.04), top, top + 0.11, "cup");
  if (!hot) return;
  draw(k, slot(at.u - 0.01, at.u + 0.02, at.v - 0.015, at.v + 0.015), top + 0.14, top + 0.3, "steam");
  draw(k, slot(at.u + 0.01, at.u + 0.035, at.v - 0.01, at.v + 0.015), top + 0.3, top + 0.42, "steam");
  k.traces.push("steaming cup");
};

/** Flyers and wrappers on the floor by the door (drawn, flat). */
export const litter = (k: Fit, near: Spot, n: number, key: number): void => {
  for (let i = 0; i < n; i++) {
    const g = shopHash(k.shop.id, key * 11 + i);
    const [u, v] = [near.u + (g - 0.5) * 1.1, near.v + (shopHash(k.shop.id, i, key) - 0.5) * 0.8];
    draw(k, slot(u - 0.1, u + 0.1, v - 0.14, v + 0.14), 0.003, 0.008, i % 2 === 0 ? "paper" : "goods");
  }
};

/**
 * The ceiling's services over the sales floor (`docs/zasady-lokacji.md` §2, the architecture's layer):
 * two pipes and a duct on hangers, cables in a sagging bundle, the light strips (none in a dark shop).
 */
export const ceiling = (k: Fit, w: number, s: number, lit: number): void => {
  const top = k.c - k.y;
  const W = k.wall;
  for (const [i, v] of [s * 0.28, s * 0.62].entries()) {
    draw(k, slot(W, w - W, v - 0.07, v + 0.07), top - 0.32 - i * 0.12, top - 0.18 - i * 0.12, "pipe");
  }
  draw(k, slot(w * 0.55 - 0.25, w * 0.55 + 0.25, W, s - 0.05), top - 0.4, top - 0.08, "duct");
  draw(k, slot(W, w - W, s * 0.45 - 0.03, s * 0.45 + 0.03), top - 0.1, top - 0.06, "cable");
  draw(k, slot(w * 0.3, w * 0.3 + 0.03, W, s), top - 0.16, top - 0.12, "cable");
  for (let i = 0; i < lit; i++) {
    const v = s * (0.2 + (0.6 * i) / Math.max(1, lit - 1));
    draw(k, slot(0.5, w - 0.5, v - 0.06, v + 0.06), top - 0.06, top - 0.02, "lamp");
  }
};
