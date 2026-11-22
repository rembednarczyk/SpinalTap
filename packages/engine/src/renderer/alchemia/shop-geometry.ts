import type { Vec3 } from "@seki/core";
import { ALL_SHOP_BUILDS, type AlchemiaBox, type AlchemiaPiece, type GalleryShopDef, type GalleryShopTrade, type ShopBuild, galleryShopCeiling, galleryShopFloor, galleryShopFrame, galleryShopHead } from "@seki/sim";
import { type BoxFace, type CityKitData, type GeometrySink, hexRgb, swatchUv } from "../city-kit-data";
import { neonText, neonWidth } from "./neon-letters";

/*
 * The gallery's shops (ADR-0093 O2) and the front's (O5) on the city kit's texture, in Alchemia's inside mesh (no mesh or
 * draw call of their own): each shop's pieces coloured by its trade (`docs/zasady-lokacji.md` §4:
 * warm light for food, clothes and flowers, cold for the technical trades, green for the pharmacy
 * and money, red for guns), its goods tinted by a hash of their place, its shopfront as a frame of
 * dark aluminium (the glass a solid of the simulation, drawn by its frame only, as the gallery's),
 * its shutter in slats, and its name in neon tubes on its fascia (proper names, no text for the
 * player). A shut shop's lamps, screens and sign are off; a barred one's lamps off, its sign on with
 * a letter dead. Pure data, no Babylon.
 */

interface TradeLook {
  /** The sign's neon, the light strips' glow, the screens' glow. */
  readonly sign: string;
  readonly lamp: string;
  readonly display: string;
  /** The goods' colours (the kit's paint tinted). */
  readonly goods: readonly string[];
  /**
   * The partitions' paint: mid tones at most, so a wall the shop's lamp misses stays in the dark base of the 60-30-10
   * rule (`docs/zasady-lokacji.md` §13) under the interior's ambient, and the lamp's pool reads as its light.
   */
  readonly wall: string;
}

const LOOK: Readonly<Record<GalleryShopTrade, TradeLook>> = {
  implants: { sign: "neon-cyan", lamp: "win-white", display: "win-teal", goods: ["#c9d2dc", "#7ff3ff", "#59606f", "#e8eef4"], wall: "#939ca4" },
  electronics: { sign: "neon-blue", lamp: "win-white", display: "office", goods: ["#15171c", "#3a3f4b", "#3f8cff", "#b4bac4", "#ff2e88"], wall: "#9aa4b4" },
  clothing: { sign: "neon-pink", lamp: "win-warm", display: "win-pink", goods: ["#167a80", "#8e2457", "#9c6a1c", "#15171c", "#e6d6b4", "#c43a7a"], wall: "#a08e94" },
  pharmacy: { sign: "neon-green", lamp: "win-white", display: "win-teal", goods: ["#f2f4f6", "#39ff8a", "#e8e0d0", "#3f8cff", "#ff4040"], wall: "#a0aaa5" },
  arms: { sign: "neon-red", lamp: "win-warm", display: "win-teal", goods: ["#15171c", "#30343e", "#596070", "#5b3a2c"], wall: "#6a6e78" },
  repair: { sign: "neon-amber", lamp: "win-white", display: "win-teal", goods: ["#3a3f4b", "#596070", "#ffb000", "#15171c", "#2f6f9a"], wall: "#b8b2a4" },
  pawn: { sign: "neon-amber", lamp: "win-warm", display: "win-teal", goods: ["#ffb000", "#b4bac4", "#5b3a2c", "#15171c", "#8e2457", "#e6d6b4"], wall: "#c8b89a" },
  tattoo: { sign: "neon-violet", lamp: "win-pink", display: "win-pink", goods: ["#15171c", "#b46cff", "#ff2e88", "#e6d6b4"], wall: "#4a3a5a" },
  "synth-food": { sign: "neon-amber", lamp: "win-warm", display: "win-warm", goods: ["#ff4040", "#ffb000", "#39ff8a", "#ff8fd8", "#f2f4f6", "#3f8cff"], wall: "#a89c86" },
  vr: { sign: "neon-violet", lamp: "win-teal", display: "win-pink", goods: ["#15171c", "#b46cff", "#00e5ff", "#3a3f4b"], wall: "#3a3f5a" },
  crypto: { sign: "neon-green", lamp: "win-white", display: "win-teal", goods: ["#15171c", "#39ff8a", "#ffb000", "#596070"], wall: "#2e3a3a" },
  florist: { sign: "neon-pink", lamp: "win-warm", display: "win-warm", goods: ["#ff2e88", "#ffb000", "#f2f4f6", "#b46cff", "#ff4040", "#39ff8a"], wall: "#a2a496" },
};

/** A trade's partitions' paint (its lamp's exposure is set by it, `alchemia-lights.ts`). */
export const shopWall = (trade: GalleryShopTrade): string => LOOK[trade].wall;

const X: Vec3 = { x: 1, y: 0, z: 0 };
const Y: Vec3 = { x: 0, y: 1, z: 0 };
const Z: Vec3 = { x: 0, y: 0, z: 1 };
const NO_BOTTOM: ReadonlySet<BoxFace> = new Set(["-y"]);

const boxOf = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox, swatch: string, tint?: readonly [number, number, number], skip?: ReadonlySet<BoxFace>): void => {
  sink.box({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2 }, [X, Y, Z], [(b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, (b.z1 - b.z0) / 2], swatchUv(data, swatch), tint, skip);
};

/** Each shop's piece and which shop's it is. */
const OWNER: ReadonlyMap<AlchemiaPiece, ShopBuild> = new Map(ALL_SHOP_BUILDS.flatMap((b) => b.pieces.map((p) => [p, b] as const)));

/** A number in [0, 1) from a box's place: the goods' colour. */
const placeHash = (b: AlchemiaBox): number => {
  let h = Math.imul(Math.round(b.x0 * 100) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.round(b.z0 * 100), 0xc2b2ae35) ^ Math.round(b.y0 * 100);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

const ALU = "dark";
const MULLION_EVERY = 1.25;

/** A shopfront's glass as its frame: a sill on the floor, a head over the glass, posts at its ends and mullions between. */
const shopfront = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox, floor: number): void => {
  const alongX = b.x1 - b.x0 >= b.z1 - b.z0;
  const len = alongX ? b.x1 - b.x0 : b.z1 - b.z0;
  const at = (a0: number, a1: number, y0: number, y1: number): AlchemiaBox =>
    alongX ? { ...b, x0: b.x0 + a0, x1: b.x0 + a1, y0, y1 } : { ...b, z0: b.z0 + a0, z1: b.z0 + a1, y0, y1 };
  if (b.y0 < floor + 0.05) boxOf(sink, data, at(0, len, b.y0, b.y0 + 0.12), ALU, undefined, NO_BOTTOM);
  else boxOf(sink, data, at(0, len, b.y0, b.y0 + 0.08), ALU);
  boxOf(sink, data, at(0, len, b.y1 - 0.08, b.y1), ALU);
  const n = Math.max(1, Math.round(len / MULLION_EVERY));
  for (let k = 0; k <= n; k++) {
    const a = Math.min(len - 0.05, Math.max(0, (k / n) * len - 0.025));
    boxOf(sink, data, at(a, a + 0.05, b.y0, b.y1), ALU);
  }
};

/** A rolling shutter in slats: the box of it, dark grooves across it every 0.12 m on its outer face. */
const shutter = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox, out: { x: number; z: number }): void => {
  boxOf(sink, data, b, "metal");
  if (b.y1 - b.y0 < 0.5) return;
  const alongX = b.x1 - b.x0 >= b.z1 - b.z0;
  const face = alongX ? (out.z < 0 ? { z0: b.z0 - 0.01, z1: b.z0 } : { z0: b.z1, z1: b.z1 + 0.01 }) : out.x < 0 ? { x0: b.x0 - 0.01, x1: b.x0 } : { x0: b.x1, x1: b.x1 + 0.01 };
  for (let y = b.y0 + 0.12; y < b.y1 - 0.05; y += 0.12) boxOf(sink, data, { ...b, ...face, y0: y, y1: y + 0.02 }, "trim");
};

/**
 * One of the shops' pieces drawn by its kind and its shop's trade and state: false for a piece of no
 * shop, or of a kind the shared code draws (counters, racks, cases, grilles, machines).
 */
export const shopPiece = (sink: GeometrySink, data: CityKitData, p: AlchemiaPiece): boolean => {
  const own = OWNER.get(p);
  if (!own) return false;
  const shop = own.shop;
  const look = LOOK[shop.trade];
  const lit = shop.state === "open";
  const b = p.box;
  switch (p.kind) {
    case "shopfront":
      shopfront(sink, data, b, galleryShopFloor(shop));
      return true;
    case "shutter":
      shutter(sink, data, b, frameOut(shop));
      return true;
    case "partition":
      boxOf(sink, data, b, "paint", hexRgb(look.wall), NO_BOTTOM);
      return true;
    case "sign":
      boxOf(sink, data, b, "sign-back");
      return true;
    case "goods": {
      const list = look.goods;
      boxOf(sink, data, b, "paint", hexRgb(list[Math.floor(placeHash(b) * list.length)]!), NO_BOTTOM);
      return true;
    }
    case "lamp":
      boxOf(sink, data, b, lit ? look.lamp : "trim-light");
      return true;
    case "display":
      boxOf(sink, data, b, lit ? look.display : "glass-dark");
      return true;
    case "error":
      boxOf(sink, data, b, "neon-red");
      return true;
    default: {
      const swatch = SMALL[p.kind];
      if (!swatch) return false;
      boxOf(sink, data, b, swatch, p.kind === "paper" ? hexRgb("#9c968a") : undefined, p.kind === "carton" || p.kind === "cup" ? NO_BOTTOM : undefined);
      return true;
    }
  }
};

/** The small things' and the services' swatches. */
const SMALL: Readonly<Partial<Record<AlchemiaPiece["kind"], string>>> = {
  pipe: "pipe",
  duct: "ac",
  cable: "cable",
  cup: "ac",
  steam: "win-white",
  carton: "fabric-amber",
  paper: "paint",
};

/** Which way is out of a shop onto the gallery, on the map. */
const frameOut = (s: GalleryShopDef): { x: number; z: number } => ({ x: s.front === "e" ? 1 : s.front === "w" ? -1 : 0, z: s.front === "n" ? 1 : s.front === "s" ? -1 : 0 });

/**
 * The shops' names on their fascias in neon tubes, centred over their windows, as high as the fascia
 * allows and no wider than the window: a shut shop's sign off, a dead letter in some of the rest (§3).
 */
export const shopSigns = (sink: GeometrySink, data: CityKitData): void => {
  for (const { shop } of ALL_SHOP_BUILDS) {
    if (shop.state === "vacant" || shop.sign === "") continue;
    // The sign reads left to right for one facing the shop, whichever side its door is on.
    const f = galleryShopFrame({ ...shop, door: undefined } as GalleryShopDef);
    const win = shop.window ?? { u0: 0, u1: f.w };
    const y = galleryShopFloor(shop);
    const head = galleryShopHead(shop);
    const band = galleryShopCeiling(shop) - (y + head);
    const height = Math.min(band * 0.55, 0.5, (win.u1 - win.u0 - 0.5) / Math.max(0.1, neonWidth(shop.sign, 1)));
    const foot = y + head + (band - height) / 2;
    const mid = (win.u0 + win.u1) / 2;
    const letters = [...shop.sign].filter((c) => c !== " ").length;
    const dead = shop.state === "shut" ? -2 : Math.floor(placeHash({ x0: mid, x1: 0, z0: letters, z1: 0, y0: y, y1: 0 }) * letters * 3);
    for (const s of neonText(shop.sign, height)) {
      const off = shop.state === "shut" || s.letter === dead;
      boxOf(sink, data, f.box(mid + s.x0, mid + s.x1, -0.06, 0, foot + s.y0, foot + s.y1), off ? "trim" : LOOK[shop.trade].sign);
    }
  }
};
