import type { StreetPropItem } from "@seki/core";
import { ALL_SHOP_BUILDS, type ShopBuild } from "./alchemia/shops";
import { shopFloor, shopFrame, shopWall } from "./alchemia/shops-plan";
import type { Box } from "./alchemia/plan";
import { type DressTaken, type DressWall, type GroundRect, type RoomLayout, dressRoom } from "./room-dressing";

/*
 * Alchemia's shops as rooms of the dressing generator (ADR-0099): each open shop's sales floor in its frame (`u` along
 * its front, `v` in from it, `shopFrame`), its side walls and its back one, its counter's top a surface, its way in from
 * the door, the seller's and the customer's places kept clear, its fit-out's solids and the things on its counter taken.
 * The technical trades get the kit with a laptop. Pure data.
 */

/** The trades whose counter has a laptop on it. */
const TECH = new Set(["electronics", "repair", "crypto", "vr", "implants"]);
/** The counter's top over the floor (`shop-trades.ts`: drawn to 1.0 m). */
const COUNTER_TOP = 1.0;

const rectOf = (b: Box): GroundRect => ({ minX: b.x0, maxX: b.x1, minZ: b.z0, maxZ: b.z1 });

export const shopDressingLayout = (b: ShopBuild): RoomLayout | null => {
  const L = b.layout;
  if (!L || b.shop.state !== "open") return null;
  const f = shopFrame(b.shop);
  const floor = shopFloor(b.shop);
  const W = shopWall(b.shop);
  const { w, s } = b.sales;
  const r = (u0: number, u1: number, v0: number, v1: number): GroundRect => rectOf(f.box(Math.min(u0, u1), Math.max(u0, u1), Math.min(v0, v1), Math.max(v0, v1), 0, 0));
  const dir = (du: number, dv: number) => {
    const o = f.point(0, 0);
    const p = f.point(du, dv);
    return { x: p.x - o.x, z: p.z - o.z };
  };
  const wall = (u0: number, v0: number, u1: number, v1: number, inward: { x: number; z: number }): DressWall => ({ a: f.point(u0, v0), b: f.point(u1, v1), inward });
  const c = L.counter;
  const top = r(c.u0, c.u1, c.v0, c.v1);
  // What stands on the counter (the till, its cup, a meal): taken on its top.
  const onCounter: DressTaken[] = b.pieces
    .filter((p) => p.box.y0 >= floor + COUNTER_TOP - 0.05 && p.box.y0 <= floor + COUNTER_TOP + 0.1)
    .map((p) => ({ ...rectOf(p.box), onTop: true }))
    .filter((t) => t.maxX > top.minX && t.minX < top.maxX && t.maxZ > top.minZ && t.minZ < top.maxZ);
  const solids: DressTaken[] = [...b.pieces.filter((p) => p.solid), ...b.solids]
    .filter((p) => p.box.y0 < floor + 1.5 && p.box.y1 > floor + 0.05)
    .map((p) => rectOf(p.box));
  const detail: DressTaken[] = b.detail.map((p) => ({ minX: p.x - 0.3, maxX: p.x + 0.3, minZ: p.z - 0.3, maxZ: p.z + 0.3, onTop: p.y > floor + 0.5 }));
  return {
    id: `alchemia-shop-${b.shop.id}`,
    kind: TECH.has(b.shop.trade) ? "shop-tech" : "shop",
    floor,
    bounds: r(W, w - W, 0.3, s - 0.02),
    walls: [wall(W, 0.3, W, s - 0.1, dir(1, 0)), wall(w - W, 0.3, w - W, s - 0.1, dir(-1, 0)), wall(W + 0.1, s, w - W - 0.1, s, dir(0, -1))],
    surfaces: [{ ...top, top: floor + COUNTER_TOP, yaw: f.out }],
    doors: [r(L.door.u0, L.door.u1, 0, 0.3)],
    clear: [
      r(L.aisle.u0, L.aisle.u1, L.aisle.v0, L.aisle.v1),
      r(L.door.u0, L.door.u1, 0, 1.5),
      r(L.seller.u - 0.5, L.seller.u + 0.5, L.seller.v - 0.5, L.seller.v + 0.5),
      r(L.customer.u - 0.5, L.customer.u + 0.5, L.customer.v - 0.5, L.customer.v + 0.5),
    ],
    taken: [...solids, ...onCounter, ...detail],
  };
};

/** The dressing of every open shop of Alchemia's (the gallery's and the front's), in `ALL_SHOP_BUILDS`' order. */
export const SHOP_DRESSING: readonly StreetPropItem[] = ALL_SHOP_BUILDS.flatMap((b) => {
  const layout = shopDressingLayout(b);
  return layout ? dressRoom(layout) : [];
});
