import type { Vec3 } from "@seki/core";
import { ALCHEMIA_UNITS, ALL_GALLERY_SHOPS, EXIT_SIGNS, ATRIUM, FOODHALL_CEILING, FOODHALL_FLOOR, FRONT_ROOMS, GALLERY, MALL_LEVELS, galleryShopCeiling, galleryShopFloor } from "@seki/sim";
import { type LightClip, type PointLightDef, mixHex } from "../../npr/lighting";
import { shopWall } from "./shop-geometry";

/**
 * Alchemia's lamps in its interior mode (the user's note of 22.11: a moodier light in it). Pattern:
 * lighting by practicals (every light comes from a source one sees: a shop's window, the gallery's
 * sodium fittings, the atrium's LED strips, the food hall's lanterns) with W-3's room-scoped lamps
 * (ADR-0082 §4): the toon shader's lights pass through walls and slabs (G-263), so each is clipped to
 * its room and its storey, and only the few nearest the eye are on. Each one hangs 5 cm over its
 * room's ceiling (the slab's underside never lit from the floor, G-509), lighting down. Pure data.
 */

export interface AlchemiaLamp {
  readonly key: string;
  readonly light: PointLightDef & { readonly clip: Required<LightClip> };
}

/** The lamps' keys begin with this: in Alchemia's interior mode only they are on (`ToonMaterials.setLightFocus`). */
export const ALCHEMIA_LAMP_PREFIX = "alchemia-lamp-";
/** How many are on at once: the shader has 8 slots, the player's muzzle and the street's need none inside. */
export const ALCHEMIA_LAMPS_ON = 7;

/**
 * A shop's lamp's strength by its walls' paint (`docs/zasady-lokacji.md` §13, the 60-30-10 rule of light): the darker
 * the paint, the stronger the light, so a tattoo parlour's violet walls and a pharmacy's white ones read alike lit
 * (the cinematographer's exposure to the set's key, a fixed ratio of light to the surfaces' albedo). `SHOP_KEY` is the
 * mid-grey paint the old strength 0.95 suited, a little under; the strength stays within `SHOP_LIGHT`.
 */
const SHOP_KEY = 0.5;
const SHOP_LIGHT = [0.4, 2.0] as const;
const luma = (hex: string): number => {
  const c = (i: number) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
  return 0.2126 * c(0) + 0.7152 * c(1) + 0.0722 * c(2);
};
export const shopLightStrength = (trade: Parameters<typeof shopWall>[0]): number =>
  Math.min(SHOP_LIGHT[1], Math.max(SHOP_LIGHT[0], (0.95 * SHOP_KEY) / Math.max(luma(shopWall(trade)), 0.05)));

/** The shops' light by trade (§4 of `docs/zasady-lokacji.md`: hard artificial light, each trade its colour). */
const TRADE_LIGHT: Readonly<Record<string, string>> = {
  pharmacy: "#6dffa8",
  tattoo: "#ff3d8a",
  pawn: "#ffaa48",
  "synth-food": "#ffd06a",
  electronics: "#55b4ff",
  florist: "#ff78cc",
  repair: "#ffe08a",
  implants: "#5af0ff",
  crypto: "#9f7aff",
  clothing: "#ff68b0",
  vr: "#8566ff",
  arms: "#ff4a3a",
};
/**
 * A shop's fittings: warm white tinted by its trade's colour, so its goods keep their own colours; a dark-walled one's
 * (a tattoo parlour, a VR booth, a crypto exchange) lit by its colour itself, the mood light of such places.
 */
const tradeLight = (trade: Parameters<typeof shopWall>[0]): string => mixHex(TRADE_LIGHT[trade] ?? "#ffd8b0", "#ffe6cc", luma(shopWall(trade)) < 0.4 ? 0.3 : 0.5);
/** The gallery's fittings over its strips round the atrium: low sodium. */
const SODIUM = "#ffa45c";
/** The atrium's LED strips under the balustrades' edges. */
const STRIP = "#38d4ff";
/** The food hall's paper lanterns over its tables. */
const LANTERN = "#ffb470";
/** The food hall's kitchens: the heat lamps over the pass and the stoves' glow. */
const KITCHEN = "#ff7c46";
/**
 * A counter of the game's people (Fumiko, Kenta, Goro, Sachiko, Oyaji): a whiter, brighter pool over the
 * counter itself (§13's functional contrast: where she has business stands out of the hall).
 */
const KEEPER = "#ffe4c2";
/** The way out's green (§13, the exit signs over the cores' doors). */
const EXIT = "#3dff86";

type Rect = { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number };

const lamp = (name: string, color: string, x: number, z: number, top: number, bottom: number, range: number, intensity: number, r: Rect): AlchemiaLamp => ({
  key: `${ALCHEMIA_LAMP_PREFIX}${name}`,
  light: { color, range, intensity, position: { x, y: top + 0.05, z }, clip: { minX: r.x0, maxX: r.x1, minZ: r.z0, maxZ: r.z1, minY: bottom - 0.05, maxY: top + 0.1 } },
});

/** A shop's spill onto the gallery before its front: its pool of colour on the floor outside. */
const SPILL = 1.8;

const shopLamps = (): AlchemiaLamp[] =>
  ALL_GALLERY_SHOPS.filter((s) => s.state === "open").map((s) => {
    const q = s.rect;
    const r: Rect = {
      x0: q.x0 - (s.front === "w" ? SPILL : 0),
      x1: q.x1 + (s.front === "e" ? SPILL : 0),
      z0: q.z0 - (s.front === "s" ? SPILL : 0),
      z1: q.z1 + (s.front === "n" ? SPILL : 0),
    };
    const reach = Math.max(q.x1 - q.x0, q.z1 - q.z0) / 2 + 3.5;
    return lamp(`shop-${s.id}`, tradeLight(s.trade), (q.x0 + q.x1) / 2, (q.z0 + q.z1) / 2, galleryShopCeiling(s), galleryShopFloor(s), reach, shopLightStrength(s.trade), r);
  });

/** The food hall's kitchens on P3 (ADR-0093 O3), the open ones, their light out over their counters. */
const kitchenLamps = (): AlchemiaLamp[] =>
  ALCHEMIA_UNITS.filter((u) => !u.shut).map((u) => {
    const q = u.rect;
    const r: Rect = {
      x0: q.minX - (u.open === "w" ? SPILL : 0),
      x1: q.maxX + (u.open === "e" ? SPILL : 0),
      z0: q.minZ - (u.open === "s" ? SPILL : 0),
      z1: q.maxZ + (u.open === "n" ? SPILL : 0),
    };
    const reach = Math.max(q.maxX - q.minX, q.maxZ - q.minZ) / 2 + 3;
    if (!u.keeper) return lamp(`kitchen-${u.id}`, KITCHEN, (q.minX + q.maxX) / 2, (q.minZ + q.maxZ) / 2, FOODHALL_CEILING, FOODHALL_FLOOR, reach, 1.0, r);
    // A keeper's: over the middle of the counter, 0.6 m in from the open side (along its opening, where it has one).
    const [s0, s1] = u.opening ?? (u.open === "n" || u.open === "s" ? [q.minX, q.maxX] : [q.minZ, q.maxZ]);
    const mid = (s0 + s1) / 2;
    const at =
      u.open === "n" ? { x: mid, z: q.maxZ - 0.6 } : u.open === "s" ? { x: mid, z: q.minZ + 0.6 } : u.open === "e" ? { x: q.maxX - 0.6, z: mid } : { x: q.minX + 0.6, z: mid };
    return lamp(`kitchen-${u.id}`, KEEPER, at.x, at.z, FOODHALL_CEILING, FOODHALL_FLOOR, 6, 1.7, r);
  });

/** A green pool before each core's door under its exit sign, a metre and a half each way, on its floor. */
const exitLamps = (): AlchemiaLamp[] =>
  EXIT_SIGNS.map((p, i) => {
    const x = (p.box.x0 + p.box.x1) / 2;
    const z = (p.box.z0 + p.box.z1) / 2;
    const floor = p.box.y0 - 2.18;
    // At the sign itself, up to its top: the glow stays under the ceiling (G-509), on the door, the wall and the floor before it.
    return lamp(`exit-${i}`, EXIT, x, z, p.box.y1, floor, 3.2, 0.55, { x0: x - 1.6, x1: x + 1.6, z0: z - 1.6, z1: z + 1.6 });
  });

/** The gallery's storeys round the atrium: P0 (the old hall), P1 and P2, and P3 the food hall. */
const STOREYS = [
  { name: "p0", bottom: MALL_LEVELS.p0, top: MALL_LEVELS.p1 - 0.4 },
  { name: "p1", bottom: MALL_LEVELS.p1, top: MALL_LEVELS.p2 - 0.3 },
  { name: "p2", bottom: MALL_LEVELS.p2, top: MALL_LEVELS.p3 - 0.3 },
  { name: "p3", bottom: MALL_LEVELS.p3, top: MALL_LEVELS.roof - 0.3 },
] as const;

/** Over an atrium's edge a strip's light reaches this far (its balustrade, the escalators' heads). */
const EDGE = 1.5;
/**
 * The four strips of the gallery round the atrium, their middles and their rectangles (each lamp
 * on its own strip, so the eye is under one or two and the rest of the slots go to the shops).
 */
const STRIPS = [
  { name: "w", x: (GALLERY.x0 + ATRIUM.x0) / 2, z: (GALLERY.z0 + GALLERY.z1) / 2, r: { ...GALLERY, x1: ATRIUM.x0 + EDGE } },
  { name: "e", x: (ATRIUM.x1 + GALLERY.x1) / 2, z: (GALLERY.z0 + GALLERY.z1) / 2, r: { ...GALLERY, x0: ATRIUM.x1 - EDGE } },
  { name: "s", x: (ATRIUM.x0 + ATRIUM.x1) / 2, z: (GALLERY.z0 + ATRIUM.z0) / 2, r: { ...GALLERY, z1: ATRIUM.z0 + EDGE } },
  { name: "n", x: (ATRIUM.x0 + ATRIUM.x1) / 2, z: (ATRIUM.z1 + GALLERY.z1) / 2, r: { ...GALLERY, z0: ATRIUM.z1 - EDGE } },
] as const;

const galleryLamps = (): AlchemiaLamp[] =>
  STOREYS.flatMap((s) => {
    const food = s.name === "p3";
    // The shops' galleries (P1, P2) under the fittings of their low ceilings: the walkway's own light, brighter than the old hall's.
    const shops = s.name === "p1" || s.name === "p2";
    const strips = STRIPS.map((t) => lamp(`${s.name}-${t.name}`, food ? LANTERN : SODIUM, t.x, t.z, s.top, s.bottom, food ? 11 : shops ? 13 : 10, food ? 1.3 : shops ? 1.6 : 1.05, t.r));
    // The atrium's cyan strips run under its slabs' edges (`mallSlab`'s lit edges): a lamp at the middle of each long edge, not in the void.
    const a = ATRIUM;
    const band = { x0: a.x0 - 1.5, x1: a.x1 + 1.5, z0: a.z0 - 1.5, z1: a.z1 + 1.5 };
    const atrium = [a.z0, a.z1].map((z, k) => lamp(`${s.name}-atrium-${k === 0 ? "s" : "n"}`, STRIP, (a.x0 + a.x1) / 2, z, s.top, s.bottom, 8, 0.75, band));
    return [...strips, ...atrium];
  });

/** The front's storeys' rooms (ADR-0093 O5): their arcades, corridors, café and bar, a warm fitting over each. */
const frontLamps = (): AlchemiaLamp[] =>
  FRONT_ROOMS.map((r, i) => {
    const reach = Math.min(12, Math.hypot(r.maxX - r.minX, r.maxZ - r.minZ) / 2 + 2);
    return lamp(`front-${i}`, SODIUM, (r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2, r.top, r.bottom, reach, 0.9, { x0: r.minX, x1: r.maxX, z0: r.minZ, z1: r.maxZ });
  });

export const ALCHEMIA_LAMPS: readonly AlchemiaLamp[] = [...galleryLamps(), ...shopLamps(), ...kitchenLamps(), ...exitLamps(), ...frontLamps()];

/** Distance from the eye to a lamp's room: across its clip and up or down to its storey. */
const toRoom = (l: AlchemiaLamp, eye: Vec3): number => {
  const c = l.light.clip;
  const dx = Math.max(c.minX - eye.x, 0, eye.x - c.maxX);
  const dz = Math.max(c.minZ - eye.z, 0, eye.z - c.maxZ);
  const dy = Math.max(c.minY - eye.y, 0, eye.y - c.maxY);
  // A storey away counts more than a room away along it: the slab between hides it.
  return Math.hypot(dx, 3 * dy, dz) + Math.hypot(eye.x - l.light.position.x, eye.z - l.light.position.z) * 0.05;
};

/** The lamps on for an eye: the `n` whose rooms are nearest, the list's order between equals. */
export const alchemiaLampsFor = (eye: Vec3, n = ALCHEMIA_LAMPS_ON): readonly AlchemiaLamp[] =>
  ALCHEMIA_LAMPS.map((l, i) => ({ l, i, d: toRoom(l, eye) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .slice(0, n)
    .map((e) => e.l);
