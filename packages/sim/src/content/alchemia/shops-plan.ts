import { type Box, HALL, HALL_INNER, box } from "./plan";
import { MAIN_DOORS, MALL, MALL_GLASS_THICK, MALL_LEVELS } from "./mall-plan";
import type { Rectangle } from "./rounded";

/*
 * The shops of the gallery's P1 and P2 (ADR-0093 O2) and of P0, the old food hall's floor (O3): the ring of units between the gallery round
 * the atrium and the glass, as the board's scheme of storeys has it ("PASAŻE / SKLEPY"). Pattern:
 * the shopping mall's in-line unit (a shopfront on the mall, partitions to its neighbours, a back of
 * house behind the sales floor) in the outer ring round a central atrium. Pure numbers, world metres:
 * `shops.ts` builds each unit's shell, `shop-fittings.ts` its fittings by its trade.
 *
 * A unit is laid out in its own frame: `u` along its front, to the right of one looking in from the
 * gallery, `v` its depth from the front in. Its door is on the left (`u` small) unless `door` is "r",
 * the frame mirrored then.
 */

/** What a shop sells: its fittings, its light and its sign's colour in the engine. */
export type ShopTrade = "implants" | "electronics" | "clothing" | "pharmacy" | "arms" | "repair" | "pawn" | "tattoo" | "synth-food" | "vr" | "crypto" | "florist";

/**
 * Open, its shutter down (`shut`: a rolling shutter, or bars over its glass with `grille`), or
 * `vacant`: to let, its glass papered over, cartons on its floor.
 */
export type ShopState = "open" | "shut" | "grille" | "vacant";

/** Which side of its rectangle is its front, on the gallery. */
export type ShopFront = "n" | "s" | "e" | "w";

export interface ShopDef {
  readonly id: string;
  readonly floor: "p0" | "p1" | "p2";
  readonly rect: Rectangle;
  readonly front: ShopFront;
  /** The part of the front on the gallery (`u` from-to), for a corner unit; the rest of that side is a partition. */
  readonly window?: { readonly u0: number; readonly u1: number };
  /** A corner unit's sales floor up to this `u`; past it, behind a partition with a door, its back room. */
  readonly sales?: number;
  readonly trade: ShopTrade;
  readonly state: ShopState;
  /** The sign over its front: a proper name in the world's language, the same in every language (ADR-0056). */
  readonly sign: string;
  readonly door?: "r";
}

/** The glass's inner faces (its panes `MALL_GLASS_THICK` deep inside the body's line, `mall.ts`). */
export const GLASS_IN: Rectangle = { x0: MALL.x0 + MALL_GLASS_THICK, x1: MALL.x1 - MALL_GLASS_THICK, z0: MALL.z0 + MALL_GLASS_THICK, z1: MALL.z1 - MALL_GLASS_THICK };
const G = GLASS_IN;
const r = (x0: number, x1: number, z0: number, z1: number): Rectangle => ({ x0, x1, z0, z1 });

/** The main doors' hall through P1's south strip, a partition's breadth either side of the doors (ADR-0093 O2b). */
export const MAIN_HALL = { x0: MAIN_DOORS.x0 - 0.2, x1: MAIN_DOORS.x1 + 0.2 } as const;
/** The east door's lobby's west end on P1: its way north to the gallery between it and FIXPOINT is 2.2 m wide. */
const EAST_LOBBY_X = 425.8;

/**
 * The ring of P1 (19 numbers from the gallery's 3 m round the atrium out to the glass): west 7.9 m
 * deep north of the south-west core's corridor (z 37.9-39.8), north 4.9 m deep west of the north-east
 * core's corridor (x 425-427.5), east 7.9 m between the east door's lobby (z 32-35.6) and the
 * north-east lift's (z 49.4-51.9), south 4.9 m either side of the hall's lift's back (x 412.2-414.8)
 * and the main doors' hall (x 418.6-423.4). The hall widened with the doors (ADR-0093 O2b, 2.8 m
 * before): VOLTAGE moved west into SAKURA's unit, SAKURA, shut, into a narrow one east of the hall.
 */
const P1_SHOPS: readonly ShopDef[] = [
  { id: "p1-w1", floor: "p1", rect: r(G.x0, 408, 39.8, 44.2), front: "e", trade: "pharmacy", state: "open", sign: "MEDIFARM" },
  { id: "p1-w2", floor: "p1", rect: r(G.x0, 408, 44.2, 48.6), front: "e", trade: "tattoo", state: "open", sign: "IREZUMI", door: "r" },
  { id: "p1-w3", floor: "p1", rect: r(G.x0, 408, 48.6, G.z1), front: "e", window: { u0: 0, u1: 4.4 }, sales: 6.5, trade: "pawn", state: "open", sign: "LOMBARD" },
  { id: "p1-n1", floor: "p1", rect: r(408, 413.67, 53, G.z1), front: "s", trade: "synth-food", state: "open", sign: "SYNTHMART" },
  { id: "p1-n2", floor: "p1", rect: r(413.67, 419.33, 53, G.z1), front: "s", trade: "electronics", state: "vacant", sign: "" },
  { id: "p1-n3", floor: "p1", rect: r(419.33, 425, 53, G.z1), front: "s", trade: "florist", state: "open", sign: "PLASTIFLORA", door: "r" },
  { id: "p1-e1", floor: "p1", rect: r(428, G.x1, 35.6, 40.2), front: "w", trade: "repair", state: "open", sign: "FIXPOINT" },
  { id: "p1-e2", floor: "p1", rect: r(428, G.x1, 40.2, 44.8), front: "w", trade: "synth-food", state: "shut", sign: "MEGABOX" },
  { id: "p1-e3", floor: "p1", rect: r(428, G.x1, 44.8, 49.4), front: "w", trade: "implants", state: "open", sign: "NEUROTEK", door: "r" },
  { id: "p1-s1", floor: "p1", rect: r(408, 412.2, G.z0, 37), front: "n", trade: "crypto", state: "open", sign: "BITKANTOR", door: "r" },
  { id: "p1-s2", floor: "p1", rect: r(414.8, MAIN_HALL.x0, G.z0, 37), front: "n", trade: "electronics", state: "open", sign: "VOLTAGE" },
  { id: "p1-s3", floor: "p1", rect: r(MAIN_HALL.x1, EAST_LOBBY_X, G.z0, 37), front: "n", trade: "clothing", state: "shut", sign: "SAKURA" },
];

/**
 * P2's ring as P1's, but for its south-east corner (no east door on this floor: a corner unit to the
 * glass, its window on the gallery's east side) and the south strip east of the lift's door (no main
 * doors either), two units of 6.6 m.
 */
const P2_SHOPS: readonly ShopDef[] = [
  { id: "p2-w1", floor: "p2", rect: r(G.x0, 408, 39.8, 44.2), front: "e", trade: "vr", state: "open", sign: "DREAMDECK" },
  { id: "p2-w2", floor: "p2", rect: r(G.x0, 408, 44.2, 48.6), front: "e", trade: "clothing", state: "open", sign: "KAWAII WEAR", door: "r" },
  { id: "p2-w3", floor: "p2", rect: r(G.x0, 408, 48.6, G.z1), front: "e", window: { u0: 0, u1: 4.4 }, sales: 6.5, trade: "arms", state: "open", sign: "HAGANE ARMS" },
  { id: "p2-n1", floor: "p2", rect: r(408, 413.67, 53, G.z1), front: "s", trade: "implants", state: "open", sign: "CHROMEDOC" },
  { id: "p2-n2", floor: "p2", rect: r(413.67, 419.33, 53, G.z1), front: "s", trade: "synth-food", state: "grille", sign: "MOGUMOGU" },
  { id: "p2-n3", floor: "p2", rect: r(419.33, 425, 53, G.z1), front: "s", trade: "repair", state: "open", sign: "REBOOT", door: "r" },
  { id: "p2-e0", floor: "p2", rect: r(428, G.x1, G.z0, 40.2), front: "w", window: { u0: 0, u1: 3.2 }, sales: 5.6, trade: "electronics", state: "open", sign: "OMNIBYTE" },
  { id: "p2-e2", floor: "p2", rect: r(428, G.x1, 40.2, 44.8), front: "w", trade: "crypto", state: "open", sign: "KOINEX" },
  { id: "p2-e3", floor: "p2", rect: r(428, G.x1, 44.8, 49.4), front: "w", trade: "florist", state: "vacant", sign: "" },
  { id: "p2-s1", floor: "p2", rect: r(408, 412.2, G.z0, 37), front: "n", trade: "pharmacy", state: "open", sign: "MEDIX", door: "r" },
  { id: "p2-s2", floor: "p2", rect: r(414.8, 421.4, G.z0, 37), front: "n", trade: "clothing", state: "shut", sign: "TOKYO DRIP" },
  { id: "p2-s3", floor: "p2", rect: r(421.4, 428, G.z0, 37), front: "n", trade: "tattoo", state: "open", sign: "INKSPOT", door: "r" },
];

/** The hall's walls' inner faces, P0's outer bounds (its front onto T1, its back wall onto P-1 and the car park). */
const I: Rectangle = { x0: HALL_INNER.minX, x1: HALL_INNER.maxX, z0: HALL_INNER.minZ, z1: HALL_INNER.maxZ };

/**
 * P0's ring (ADR-0093 O3, where the food hall's units stood): the walls instead of glass, the same
 * strips as P1's. West 7.6 m deep from the hall's stairs' partition (z 34.8) to Fumiko's second place
 * in the north-west corner (`fumiko-p0.ts`); north 4.6 m deep either side of the way in from T1 (x
 * 413-419), short of the north-east core's corridor with the east door (x 425-427.5); east 7.2 m deep
 * from the back wall to the north-east lift's lobby, its corner unit's window west onto the alcove
 * before it (x 424.4-428); south 4.6 m deep between the hall's lift's lobby and that alcove. The
 * back aisle to the stairs and the door onto P-1 (x 408-412.3) stays clear.
 */
const P0_SHOPS: readonly ShopDef[] = [
  { id: "p0-w1", floor: "p0", rect: r(I.x0, 408, 34.8, 39.6), front: "e", trade: "repair", state: "open", sign: "CHIPFIX" },
  { id: "p0-w2", floor: "p0", rect: r(I.x0, 408, 39.6, 44.2), front: "e", trade: "clothing", state: "open", sign: "NEONSKIN", door: "r" },
  { id: "p0-w3", floor: "p0", rect: r(I.x0, 408, 44.2, 48.8), front: "e", trade: "pharmacy", state: "open", sign: "APTEKA NOVA" },
  { id: "p0-w4", floor: "p0", rect: r(I.x0, 408, 48.8, 53.4), front: "e", trade: "electronics", state: "shut", sign: "DATAKOM" },
  { id: "p0-n1", floor: "p0", rect: r(408, 413, 53, I.z1), front: "s", trade: "synth-food", state: "open", sign: "SOYA MAX" },
  { id: "p0-n2", floor: "p0", rect: r(419, 425, 53, I.z1), front: "s", trade: "pawn", state: "open", sign: "SKUP", door: "r" },
  { id: "p0-e0", floor: "p0", rect: r(428, I.x1, I.z0, 37), front: "w", trade: "arms", state: "open", sign: "TETSU" },
  { id: "p0-e1", floor: "p0", rect: r(428, I.x1, 37, 41.2), front: "w", trade: "vr", state: "open", sign: "HOLODROM" },
  { id: "p0-e2", floor: "p0", rect: r(428, I.x1, 41.2, 45.4), front: "w", trade: "implants", state: "vacant", sign: "" },
  { id: "p0-e3", floor: "p0", rect: r(428, I.x1, 45.4, 49.4), front: "w", trade: "crypto", state: "open", sign: "KANTOR", door: "r" },
  { id: "p0-s1", floor: "p0", rect: r(414.8, 419.6, I.z0, 37), front: "n", trade: "tattoo", state: "open", sign: "SUMI INK", door: "r" },
  { id: "p0-s2", floor: "p0", rect: r(419.6, 424.4, I.z0, 37), front: "n", trade: "florist", state: "grille", sign: "FLORA" },
];

/** P1's and P2's first (their ids and solids as O2 left them), P0's after them (O3). */
export const SHOPS: readonly ShopDef[] = [...P1_SHOPS, ...P2_SHOPS, ...P0_SHOPS];

/** A shop's floor, and the underside of the slab over it (on P0 the hall's old roof, 0.4 m thick). */
export const shopFloor = (s: ShopDef): number => MALL_LEVELS[s.floor];
export const shopCeiling = (s: ShopDef): number => (s.floor === "p0" ? HALL.ceiling : (s.floor === "p1" ? MALL_LEVELS.p2 : MALL_LEVELS.p3) - 0.3);

/** Is a shop open to its customers? */
export const isOpen = (s: ShopDef): boolean => s.state === "open";

/** A shop's frame: its width along the front, its depth, boxes and points of its `u`, `v` in the world, which way is out (to the gallery) and which `u`. */
export interface ShopFrame {
  readonly w: number;
  readonly d: number;
  readonly box: (u0: number, u1: number, v0: number, v1: number, y0: number, y1: number) => Box;
  readonly point: (u: number, v: number) => { readonly x: number; readonly z: number };
  /** The yaw facing out of the shop onto the gallery (`atan2(x, z)`, the renderer's). */
  readonly out: number;
  /** The yaw facing along +u. */
  readonly along: number;
}

/** The yaw of `+u` and of the way out, by the front (u to the right of one looking in). */
const YAWS: Readonly<Record<ShopFront, { readonly out: number; readonly along: number }>> = {
  e: { out: Math.PI / 2, along: 0 },
  w: { out: -Math.PI / 2, along: Math.PI },
  n: { out: 0, along: -Math.PI / 2 },
  s: { out: Math.PI, along: Math.PI / 2 },
};

/** The frame of a shop; mirrored along `u` when its door is on the right, so its fittings are laid out with the door on the left. */
export const shopFrame = (s: ShopDef): ShopFrame => {
  const q = s.rect;
  const across = s.front === "e" || s.front === "w";
  const w = across ? q.z1 - q.z0 : q.x1 - q.x0;
  const d = across ? q.x1 - q.x0 : q.z1 - q.z0;
  const flip = s.door === "r";
  const point = (u0: number, v: number) => {
    const u = flip ? w - u0 : u0;
    if (s.front === "e") return { x: q.x1 - v, z: q.z0 + u };
    if (s.front === "w") return { x: q.x0 + v, z: q.z1 - u };
    if (s.front === "n") return { x: q.x1 - u, z: q.z1 - v };
    return { x: q.x0 + u, z: q.z0 + v };
  };
  const yaw = YAWS[s.front];
  return {
    w,
    d,
    point,
    box: (u0, u1, v0, v1, y0, y1) => {
      const [a, b] = [point(u0, v0), point(u1, v1)];
      return box(Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.z, b.z), Math.max(a.z, b.z), y0, y1);
    },
    out: yaw.out,
    along: flip ? yaw.along + Math.PI : yaw.along,
  };
};

/** The shop over (x, y, z), between its floor and its ceiling, or null (the engine's colours of a shop's light, goods and sign). */
export const shopAt = (x: number, y: number, z: number): ShopDef | null =>
  SHOPS.find((s) => x >= s.rect.x0 - 0.3 && x <= s.rect.x1 + 0.3 && z >= s.rect.z0 - 0.3 && z <= s.rect.z1 + 0.3 && y >= shopFloor(s) - 0.1 && y <= shopCeiling(s) + 0.05) ?? null;

/**
 * The ways through the ring kept clear of shops, on each floor (ADR-0093 O1's doors and cores): the
 * south-west core's corridor, the north-east core's, the north-east lift's lobby, and on P1 the main
 * doors' hall, the east door's lobby and the hall's lift's back; on P2 the hall's lift's lobby.
 */
export const RING_WAYS: Readonly<Record<ShopDef["floor"], readonly Rectangle[]>> = {
  // P0 (O3): the back aisle to the stairs and the door onto P-1, the hall's lift's lobby, the way in from T1, the north-east core's corridor, its lift's lobby, the alcove before the corner unit.
  p0: [r(408, 412.3, I.z0, 37), r(412.3, 414.8, 34.8, 37), r(413, 419, 53, I.z1), r(425, 427.5, 53, I.z1), r(428, I.x1, 49.4, 51.9), r(424.4, 428, I.z0, 37)],
  p1: [r(G.x0, 408, 37.9, 39.8), r(425, 427.5, 53, G.z1), r(428, G.x1, 49.4, 51.9), r(MAIN_HALL.x0, MAIN_HALL.x1, G.z0, 37), r(EAST_LOBBY_X, G.x1, G.z0, 35.6), r(412.2, 414.8, 34.8, 37)],
  p2: [r(G.x0, 408, 37.9, 39.8), r(425, 427.5, 53, G.z1), r(428, G.x1, 49.4, 51.9), r(412.2, 414.8, 34.8, 37)],
};

/** A partition's thickness, the shopfront's glass head and the door's head over the floor, the door's width. */
export const SHOP_WALL = 0.15;
/**
 * A shop's partitions: P0's (O3) 0.2 m, as a room's wall, so a crouched, aimed shoulder by one starts
 * its shot inside it (G-275); P1's and P2's as O2 built them.
 */
export const shopWall = (s: ShopDef): number => (s.floor === "p0" ? 0.2 : SHOP_WALL);
export const SHOPFRONT_HEAD = 3.0;
export const SHOP_DOOR_TOP = 2.4;
export const SHOP_DOOR = 1.5;
