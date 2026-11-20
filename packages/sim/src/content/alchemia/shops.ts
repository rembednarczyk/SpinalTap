import { type ActivityId, type StreetPropItem, type Vec3, figureVariant } from "@seki/core";
import type { CrowdSpot } from "../crowd-spot";
import { furniturePrisms } from "../lublin/furniture";
import { type Piece, box, piece } from "./plan";
import { MALL_LEVELS } from "./mall-plan";
import { FOUNTAIN_P0 } from "./landmark";
import { type Fit, type Layout, type Slot, cartons, ceiling, cup, draw, litter, model, newFit, shelves, shopHash, shopLayout } from "./shop-fittings";
import { fitTrade } from "./shop-trades";
import { FRONT_SHOPS } from "./front-shops";
import { SHOPS, type ShopDef, isOpen, shopDoorTop, shopHead } from "./shops-plan";

/*
 * The gallery's shops built (ADR-0093 O2, `docs/zasady-lokacji.md`): each unit's shell (its shopfront
 * of glass on the gallery with its door, its partitions, its back room behind a wall with a staff
 * door, the fascia its sign hangs on), its sales floor's fittings by its trade (`shop-trades.ts`),
 * the services under its ceiling, and its seller. A shut unit's shutter is down, a barred one's
 * grille over its glass, a vacant one's glass papered over and its floor strewn with what the last
 * tenant left. Deterministic: a hash of the shop and the place.
 */

const slot = (u0: number, u1: number, v0: number, v1: number): Slot => ({ u0, u1, v0, v1 });
/** The shopfront's glass is this thick, on the gallery's edge. */
const GLASS = 0.1;

/** What a shop is built of. */
export interface ShopBuild {
  readonly shop: ShopDef;
  readonly pieces: readonly Piece[];
  /** Solids not drawn (the game's models' boxes, a fixture drawn as its parts). */
  readonly solids: readonly Piece[];
  readonly props: readonly StreetPropItem[];
  /** Its sales floor's slots (in its frame), null for a shut one. */
  readonly layout: Layout | null;
  /** Its sales floor's size: along the front and in from it. */
  readonly sales: { readonly w: number; readonly s: number };
  /** Where its seller stands and where a customer does, in the world; null when it is not open. */
  readonly seller: Vec3 | null;
  readonly customer: Vec3 | null;
  readonly traces: readonly string[];
}

/** The sales floor: up to a corner unit's back room along its front, or in from the front to the back room's wall. */
const salesOf = (s: ShopDef, w: number, d: number): { w: number; s: number } => (s.sales !== undefined ? { w: s.sales, s: d } : { w, s: d >= 7 ? d - 2.0 : d - 1.2 });

/** A wall from `a0` to `a1` along one axis of a slot with a door from `g0` to `g1` in it: the two pieces and the lintel. */
const wallWithDoor = (k: Fit, full: Slot, alongU: boolean, g0: number, g1: number, top: number, kind: "partition" | "shopfront", head: number): void => {
  const [a0, a1] = alongU ? [full.u0, full.u1] : [full.v0, full.v1];
  const part = (b0: number, b1: number): Slot => (alongU ? { ...full, u0: b0, u1: b1 } : { ...full, v0: b0, v1: b1 });
  if (g0 > a0 + 0.01) draw(k, part(a0, g0), 0, top, kind, true);
  if (a1 > g1 + 0.01) draw(k, part(g1, a1), 0, top, kind, true);
  draw(k, part(g0, g1), shopDoorTop(k.shop), head, kind, true);
};

/** The shell: partitions, the shopfront with its door and fascia, the back room's wall, the state's shutter, grille or paper. */
const shell = (k: Fit, L: Layout, sales: { w: number; s: number }): void => {
  const { w, d } = k.f;
  const W = k.wall;
  const top = k.c - k.y;
  const shop = k.shop;
  draw(k, slot(0, W, GLASS, d), 0, top, "partition", true);
  draw(k, slot(w - W, w, GLASS, d), 0, top, "partition", true);
  const win = shop.window ?? { u0: 0, u1: w };
  // The front past a corner unit's window is a partition to its neighbour.
  if (win.u1 < w - 0.01) draw(k, slot(win.u1, w - W, 0, W), 0, top, "partition", true);
  if (win.u0 > 0.01) draw(k, slot(W, win.u0, 0, W), 0, top, "partition", true);
  const glass = slot(win.u0, win.u1, 0, GLASS);
  const head = shopHead(shop);
  const shutDoor = shop.state === "vacant";
  if (shutDoor) draw(k, glass, 0, head, "shopfront", true);
  else wallWithDoor(k, glass, true, L.door.u0, L.door.u1, head, "shopfront", head);
  // The fascia over the glass to the ceiling: the sign's (letters in the engine).
  draw(k, slot(win.u0, win.u1, 0, GLASS + 0.05), head, top, "sign", true);
  // A wall across its back where no glass is (O5): back to back with a café, short of a rounded corner.
  if (shop.back) draw(k, slot(W, w - W, d - W, d), 0, top, "partition", true);
  // The back room's wall with its staff door (0.85 m: staff only, no customer's way).
  if (shop.sales !== undefined) wallWithDoor(k, slot(sales.w, sales.w + W, W, d), false, L.backDoor.a0, L.backDoor.a1, top, "partition", top);
  else wallWithDoor(k, slot(W, w - W, sales.s, sales.s + W), true, L.backDoor.a0, L.backDoor.a1, top, "partition", top);
  if (shop.state === "shut") {
    // The rolling shutter down behind the glass, its box under the fascia, a padlock at its foot.
    draw(k, slot(win.u0, win.u1, GLASS, GLASS + 0.06), 0, head - 0.25, "shutter", true);
    draw(k, slot(win.u0, win.u1, GLASS, GLASS + 0.3), head - 0.25, head, "shutter", true);
    draw(k, slot(L.door.u1 - 0.1, L.door.u1 + 0.02, GLASS - 0.06, GLASS), 0.05, 0.17, "machine");
  }
  if (shop.state === "grille") draw(k, slot(win.u0, win.u1, GLASS, GLASS + 0.05), 0, head, "grille", true);
  if (shop.state === "vacant") {
    // Papered glass, sheets with gaps between them; a pale board of a letting agent's in the middle.
    for (let u = win.u0 + 0.1, i = 0; u < win.u1 - 0.5; u += 0.95, i++) {
      const g = shopHash(shop.id, 70, i);
      draw(k, slot(u, Math.min(u + 0.8 + g * 0.1, win.u1 - 0.1), GLASS, GLASS + 0.01), 0.3 + g * 0.2, 2.2 + g * 0.5, "paper");
    }
    const m = (win.u0 + win.u1) / 2;
    draw(k, slot(m - 0.45, m + 0.45, GLASS + 0.01, GLASS + 0.03), 1.3, 1.9, "plaster");
  }
};

/** The back room: stock on shelves along the glass, cartons stacked, a lamp; the servers of the technical trades' (`shop-trades.ts`). */
const backRoom = (k: Fit, sales: { w: number; s: number }): void => {
  const W = k.wall;
  // Its back wall's breadth in from the back where it has one (O5).
  const { w } = k.f;
  const d = k.shop.back ? k.f.d - W : k.f.d;
  const top = k.c - k.y;
  if (k.shop.sales !== undefined) {
    const u0 = sales.w + W;
    shelves(k, slot(u0 + 0.1, w - 0.2, d - 0.55, d - 0.05), 2.2, "v1", 80);
    cartons(k, { u: (u0 + w) / 2, v: 1.0 }, 3, 81);
    cartons(k, { u: w - 0.6, v: 2.2 }, 2, 82);
    draw(k, slot(u0 + 0.4, w - 0.4, d * 0.45 - 0.05, d * 0.45 + 0.05), top - 0.06, top - 0.02, "lamp");
    return;
  }
  const v0 = sales.s + W;
  const deep = d - v0 > 1.5;
  shelves(k, slot(W + 0.1, w - W - 0.1, d - (deep ? 0.55 : 0.45), d - 0.05), deep ? 2.2 : 1.8, "v1", 80);
  if (deep) {
    cartons(k, { u: 0.6, v: v0 + 0.55 }, 3, 81);
    cartons(k, { u: w * 0.5, v: v0 + 0.55 }, 2, 82);
  }
  draw(k, slot(0.5, w - 0.5, (v0 + d) / 2 - 0.05, (v0 + d) / 2 + 0.05), top - 0.06, top - 0.02, "lamp");
};

/**
 * A street unit's light seen from the street (ADR-0093 O5, the board's lit shops behind the front's
 * glass): a strip of lamps along its window under the fascia, a lightbox across its sales floor's
 * back wall over the counter (its brand's backdrop), one on its side wall by the door and one behind
 * its window display, warm.
 */
const streetWindow = (k: Fit, sales: { w: number; s: number }): void => {
  const W = k.wall;
  const head = shopHead(k.shop);
  draw(k, slot(0.3, k.f.w - 0.3, GLASS + 0.08, GLASS + 0.2), head - 0.14, head - 0.08, "lamp");
  if (k.shop.sales === undefined) draw(k, slot(W + 0.25, sales.w - W - 0.25, sales.s - 0.04, sales.s), 0.5, head - 0.15, "lightbox");
  // Its side wall by the door lit (seen from the street through the door), behind the wall rack there.
  draw(k, slot(W, W + 0.03, 0.4, sales.s - 0.2), 0.3, head - 0.2, "lightbox");
  // The window display's backdrop lit behind it (a shop window's light box), the door's side open.
  const L = shopLayout(sales.w, sales.s, k.shop.sales !== undefined, W);
  if (L.window) draw(k, slot(L.window.u0, L.window.u1, L.window.v1 + 0.02, L.window.v1 + 0.06), 0.15, head - 0.1, "lightbox");
};

/** A vacant unit's floor: what the last tenant left (cartons, a ladder, a paint pot, a cable from the ceiling) and somebody's coffee (§5). */
const vacant = (k: Fit, L: Layout, sales: { w: number; s: number }): void => {
  const top = k.c - k.y;
  const W = k.wall;
  cartons(k, { u: sales.w - 0.8, v: sales.s - 0.7 }, 3, 90);
  cartons(k, { u: sales.w - 1.5, v: sales.s - 0.6 }, 2, 91);
  cartons(k, { u: 0.6, v: sales.s - 0.5 }, 1, 92);
  // A stepladder against the side wall (its box a solid), a pot of paint by it.
  draw(k, slot(sales.w - W - 0.12, sales.w - W - 0.02, 1.0, 1.55), 0, 1.9, "rack", true);
  draw(k, slot(sales.w - W - 0.5, sales.w - W - 0.12, 1.0, 1.05), 0, 1.85, "rack");
  draw(k, slot(sales.w - W - 0.5, sales.w - W - 0.12, 1.5, 1.55), 0, 1.85, "rack");
  draw(k, slot(sales.w - 0.9, sales.w - 0.6, 1.9, 2.2), 0, 0.3, "goods");
  draw(k, slot(sales.w / 2, sales.w / 2 + 0.03, sales.s / 2, sales.s / 2 + 0.03), 1.6, top - 0.1, "cable");
  draw(k, slot(sales.w / 2 - 0.05, sales.w / 2 + 0.08, sales.s / 2 - 0.05, sales.s / 2 + 0.08), 1.5, 1.6, "lamp");
  cup(k, { u: 0.6, v: sales.s - 0.5 }, 0.5, true);
  litter(k, { u: (L.door.u0 + L.door.u1) / 2, v: 0.8 }, 6, 93);
};

/** The game's models as solids: the boxes of their furniture (their yaw a quarter turn's multiple). */
export const modelBoxes = (props: readonly StreetPropItem[]): Piece[] =>
  props.flatMap((p) =>
    furniturePrisms(p).map((q) => {
      const xs = q.points.map((c) => p.x + c.x);
      const zs = q.points.map((c) => p.z + c.z);
      return piece(box(Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs), p.y - 0.05, p.y + q.top), "machine", true);
    }),
  );

/** One shop built. */
export const buildShop = (shop: ShopDef): ShopBuild => {
  const k = newFit(shop);
  const sales = salesOf(shop, k.f.w, k.f.d);
  const L = shopLayout(sales.w, sales.s, shop.sales !== undefined, k.wall);
  shell(k, L, sales);
  const open = isOpen(shop);
  if (shop.state !== "shut") {
    if (shop.state === "vacant") vacant(k, L, sales);
    else fitTrade(k, L, sales.w, sales.s);
    backRoom(k, sales);
    ceiling(k, sales.w, sales.s, open ? 2 : 0);
    if (open && shop.street) streetWindow(k, sales);
  }
  const at = (p: { u: number; v: number }): Vec3 => ({ ...k.f.point(p.u, p.v), y: k.y });
  const seller = open ? at(L.seller) : null;
  if (seller) {
    const g = shopHash(shop.id, 99);
    const look = Math.floor(shopHash(shop.id, 98) * 32);
    model(k, "figure", L.seller.u, L.seller.v, L.side ? "-u" : "out", figureVariant({ pose: g < 0.6 ? "stand" : "hips", body: g * 7 % 1 < 0.5 ? "a" : "b", seat: 0, look }));
  }
  return {
    shop,
    pieces: k.pieces,
    solids: [...k.solids, ...modelBoxes(k.props)],
    props: k.props,
    layout: shop.state === "shut" ? null : L,
    sales,
    seller,
    customer: open ? at(L.customer) : null,
    traces: k.traces,
  };
};

/** Every shop of P1, P2 and P0 built, in `SHOPS`' order. */
export const SHOP_BUILDS: readonly ShopBuild[] = SHOPS.map(buildShop);

/** The front's units built (ADR-0093 O5), in `FRONT_SHOPS`' order: a prop each after every other solid of Alchemia's. */
export const FRONT_SHOP_BUILDS: readonly ShopBuild[] = FRONT_SHOPS.map(buildShop);
/** The gallery's and the front's, for the engine's colours and signs. */
export const ALL_SHOP_BUILDS: readonly ShopBuild[] = [...SHOP_BUILDS, ...FRONT_SHOP_BUILDS];

/** The shops' drawn pieces (inside the gallery: drawn near only, in the inside's mesh). */
export const SHOP_PIECES: readonly Piece[] = SHOP_BUILDS.flatMap((b) => b.pieces);
/** Their solids: the drawn ones and those of the fixtures drawn as parts and of the game's models. */
export const SHOP_SOLIDS: readonly Piece[] = SHOP_BUILDS.flatMap((b) => [...b.pieces.filter((p) => p.solid), ...b.solids]);
/** The game's models in them: drinks machines, cash machines, cabinets, ticket machines, shrubs as plastic flowers, the sellers. */
export const SHOP_PROPS: readonly StreetPropItem[] = SHOP_BUILDS.flatMap((b) => b.props);

const CHUNK = "krakowskie-2-1";
const spot = (at: Vec3, yaw: number, does: readonly [ActivityId, ...ActivityId[]]): CrowdSpot => ({ chunk: CHUNK, at, yaw, does, indoor: true });

/**
 * A customer at the counter of every other open shop of `builds` (by the hash of the shop): the still
 * crowd's (ADR-0060), indoors.
 */
export const shopCustomers = (builds: readonly ShopBuild[]): CrowdSpot[] =>
  builds.flatMap((b) => {
    if (!b.customer || !b.seller || shopHash(b.shop.id, 97) < 0.4) return [];
    return [spot(b.customer, Math.atan2(b.seller.x - b.customer.x, b.seller.z - b.customer.z), shopHash(b.shop.id, 96) < 0.5 ? ["phone", "talk"] : ["talk"])];
  });

/**
 * The gallery's still crowd (ADR-0060): its shops' customers (`shopCustomers`), a few people leaning
 * on the atrium's balustrade on P1 and P2, out of the escalators' landings and the gallery's nodes,
 * and a few by P0's fountain (O3).
 */
export const GALLERY_CROWD: readonly CrowdSpot[] = [
  ...shopCustomers(SHOP_BUILDS),
  spot({ x: 418.5, y: MALL_LEVELS.p1, z: 50.6 }, Math.PI, ["lean", "phone"]),
  spot({ x: 410.4, y: MALL_LEVELS.p1, z: 46.5 }, Math.PI / 2, ["lean"]),
  spot({ x: 425.6, y: MALL_LEVELS.p2, z: 47.5 }, -Math.PI / 2, ["lean", "smoke"]),
  spot({ x: 413.5, y: MALL_LEVELS.p2, z: 50.6 }, Math.PI, ["phone"]),
  // P0's (O3): one on the bench by the fountain, one at its rim, one waiting by it with a phone.
  spot({ x: (FOUNTAIN_P0.minX + FOUNTAIN_P0.maxX) / 2 - 0.5, y: MALL_LEVELS.p0, z: FOUNTAIN_P0.maxZ + 0.9 }, 0, ["sit"]),
  spot({ x: FOUNTAIN_P0.minX - 0.55, y: MALL_LEVELS.p0, z: (FOUNTAIN_P0.minZ + FOUNTAIN_P0.maxZ) / 2 }, Math.PI / 2, ["talk", "phone"]),
  spot({ x: FOUNTAIN_P0.maxX + 1.0, y: MALL_LEVELS.p0, z: FOUNTAIN_P0.minZ - 0.8 }, -Math.PI / 4, ["phone", "smoke"]),
];
