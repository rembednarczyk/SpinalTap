import type { Vec3 } from "@seki/core";
import { ALCHEMIA_UNITS, ATRIUM, FOODHALL_CEILING, FOODHALL_FLOOR, FUMIKO_WINDOW, MALL, type AlchemiaBox, type AlchemiaPiece, type UnitDef as AlchemiaUnit, FOODHALL } from "@seki/sim";
import { type BoxFace, type CityKitData, type GeometrySink, hexRgb, swatchUv } from "../city-kit-data";
import { neonText, neonWidth } from "./neon-letters";

/*
 * The food hall on the gallery's P3 (ADR-0093 O3) on the city kit's texture, in Alchemia's inside mesh
 * (no mesh or draw call of its own): its units' signs as proper names in neon tubes over their counters
 * on a dark box under the slab, coloured by the kitchen (`docs/zasady-lokacji.md` §4: warm for food,
 * green for Oyaji's guns, a shut unit's sign dark); the kitchens' and the seating's things tinted (pots,
 * food, stock by a hash of their place), their partitions painted by the kitchen, their lamps and menu
 * screens warm; a warm strip of light round the atrium under the slab, as P0's. Fumiko's second place
 * on P0 tinted as her bar. Pure data, no Babylon.
 */

/** The signs' neon by the unit's kitchen: the kit's glow swatches. */
const SIGN: Readonly<Record<string, string>> = {
  ramen: "neon-red",
  okonomiyaki: "neon-amber",
  "umbrellas-tea": "neon-cyan",
  coffee: "neon-amber",
  arms: "neon-green",
  thai: "neon-violet",
  korean: "neon-pink",
  greek: "neon-blue",
  georgian: "neon-red",
  wok: "neon-amber",
  burger: "neon-pink",
  kiosk: "neon-cyan",
};

/** A kitchen's partitions' paint and its things' colours. */
const LOOK: Readonly<Record<string, { readonly wall: string; readonly goods: readonly string[] }>> = {
  ramen: { wall: "#8e2a24", goods: ["#2b2b30", "#c8452c", "#e8b04a", "#9aa3ad"] },
  okonomiyaki: { wall: "#e2c48a", goods: ["#3a3f4b", "#c87a3a", "#e8b04a", "#9aa3ad"] },
  "umbrellas-tea": { wall: "#2f6f6a", goods: ["#ff2e88", "#00e5ff", "#ffb000", "#15171c", "#e6d6b4"] },
  coffee: { wall: "#5b3a2c", goods: ["#9aa3ad", "#e6d6b4", "#3a2a20", "#c8a070"] },
  arms: { wall: "#4a4e58", goods: ["#15171c", "#30343e", "#596070", "#5b3a2c"] },
  thai: { wall: "#d8b040", goods: ["#2b2b30", "#39a050", "#e8b04a", "#c8452c"] },
  korean: { wall: "#6a6e78", goods: ["#2b2b30"] },
  greek: { wall: "#e8eef4", goods: ["#9aa3ad", "#c87a3a", "#3f6fb0", "#e6d6b4"] },
  georgian: { wall: "#6a6e78", goods: ["#2b2b30"] },
  wok: { wall: "#b03028", goods: ["#2b2b30", "#e8b04a", "#39a050", "#9aa3ad"] },
  burger: { wall: "#6a6e78", goods: ["#2b2b30"] },
  kiosk: { wall: "#2e3a3a", goods: ["#ff4040", "#ffb000", "#39ff8a", "#3f8cff", "#f2f4f6", "#ff8fd8"] },
};
/** The seating's and the kitchens' things outside every unit: bowls, cups, the cartons. */
const SEATING_GOODS = ["#e6d6b4", "#c8452c", "#f2f4f6", "#2b2b30"];

const X: Vec3 = { x: 1, y: 0, z: 0 };
const Y: Vec3 = { x: 0, y: 1, z: 0 };
const Z: Vec3 = { x: 0, y: 0, z: 1 };
const NO_BOTTOM: ReadonlySet<BoxFace> = new Set(["-y"]);

const boxOf = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox, swatch: string, tint?: readonly [number, number, number], skip?: ReadonlySet<BoxFace>): void => {
  sink.box({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2 }, [X, Y, Z], [(b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, (b.z1 - b.z0) / 2], swatchUv(data, swatch), tint, skip);
};

/** A number in [0, 1) from a box's place. */
const placeHash = (b: AlchemiaBox): number => {
  let h = Math.imul(Math.round(b.x0 * 100) ^ 0x27d4eb2d, 0x85ebca6b) ^ Math.imul(Math.round(b.z0 * 100), 0xc2b2ae35) ^ Math.round(b.y0 * 100);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

/** The unit over (x, z), or null. */
const unitAt = (x: number, z: number): AlchemiaUnit | null => ALCHEMIA_UNITS.find((u) => x >= u.rect.minX - 0.05 && x <= u.rect.maxX + 0.05 && z >= u.rect.minZ - 0.05 && z <= u.rect.maxZ + 0.05) ?? null;

/** Is a piece the food hall's, on P3 inside the glass; or of Fumiko's second place on P0? */
const onP3 = (b: AlchemiaBox): boolean => b.y0 >= FOODHALL_FLOOR - 0.1 && b.y1 <= FOODHALL_CEILING + 0.01 && b.x0 >= MALL.x0 && b.x1 <= MALL.x1 && b.z0 >= MALL.z0 && b.z1 <= MALL.z1;
const inFumikoP0 = (b: AlchemiaBox): boolean =>
  b.y0 >= FOODHALL.floor - 0.1 && b.y1 <= FOODHALL.ceiling + 0.01 && b.x0 >= FUMIKO_WINDOW.minX - 0.01 && b.x1 <= FUMIKO_WINDOW.maxX + 0.01 && b.z0 >= FUMIKO_WINDOW.minZ - 0.01 && b.z1 <= FUMIKO_WINDOW.maxZ - 0.79;

/**
 * One of the food hall's pieces drawn by its kitchen: false for a piece of somewhere else, or of a
 * kind the shared code draws as it is (counters, tables, benches, machines, ducts, steam).
 */
export const foodhallPiece = (sink: GeometrySink, data: CityKitData, p: AlchemiaPiece): boolean => {
  const b = p.box;
  const fumiko = inFumikoP0(b);
  if (!fumiko && !onP3(b)) return false;
  const u = fumiko ? ALCHEMIA_UNITS.find((x) => x.id === "fumiko")! : unitAt((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
  const look = LOOK[u?.cuisine ?? ""];
  switch (p.kind) {
    case "goods": {
      const list = look?.goods ?? SEATING_GOODS;
      boxOf(sink, data, b, "paint", hexRgb(list[Math.floor(placeHash(b) * list.length)]!), NO_BOTTOM);
      return true;
    }
    case "partition":
      if (!look) return false;
      boxOf(sink, data, b, "paint", hexRgb(look.wall), NO_BOTTOM);
      return true;
    case "lamp":
      boxOf(sink, data, b, u?.shut ? "trim-light" : "win-warm");
      return true;
    case "display":
      boxOf(sink, data, b, "win-pink");
      return true;
    case "cup":
      boxOf(sink, data, b, "paint", hexRgb(SEATING_GOODS[Math.floor(placeHash(b) * 2)]!), NO_BOTTOM);
      return true;
    default:
      return false;
  }
};

/** A unit's open side: its middle, the way its sign reads (right of one facing the counter), the way out of it. */
const openSide = (u: AlchemiaUnit): { readonly mid: { x: number; z: number }; readonly along: { x: number; z: number }; readonly out: { x: number; z: number }; readonly length: number } => {
  const q = u.rect;
  // Over the part of the side that opens (Oyaji's: the rest stands against the east row's unit).
  const [x0, x1] = u.opening && (u.open === "n" || u.open === "s") ? u.opening : [q.minX, q.maxX];
  const [z0, z1] = u.opening && (u.open === "e" || u.open === "w") ? u.opening : [q.minZ, q.maxZ];
  const [mx, mz] = [(x0 + x1) / 2, (z0 + z1) / 2];
  if (u.open === "s") return { mid: { x: mx, z: q.minZ }, along: { x: 1, z: 0 }, out: { x: 0, z: -1 }, length: x1 - x0 };
  if (u.open === "n") return { mid: { x: mx, z: q.maxZ }, along: { x: -1, z: 0 }, out: { x: 0, z: 1 }, length: x1 - x0 };
  if (u.open === "e") return { mid: { x: q.maxX, z: mz }, along: { x: 0, z: 1 }, out: { x: 1, z: 0 }, length: z1 - z0 };
  return { mid: { x: q.minX, z: mz }, along: { x: 0, z: -1 }, out: { x: -1, z: 0 }, length: z1 - z0 };
};

/** A box `a0..a1` along a side from its middle, `o0..o1` out of it, `y0..y1` high. */
const sideBox = (s: ReturnType<typeof openSide>, a0: number, a1: number, o0: number, o1: number, y0: number, y1: number): AlchemiaBox => {
  const xs = [s.mid.x + s.along.x * a0 + s.out.x * o0, s.mid.x + s.along.x * a1 + s.out.x * o1];
  const zs = [s.mid.z + s.along.z * a0 + s.out.z * o0, s.mid.z + s.along.z * a1 + s.out.z * o1];
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), y0, y1 };
};

/** Each unit's sign over its counter: a dark box under the slab, its name in neon tubes on its outer face; a shut unit's dark. */
const unitSigns = (sink: GeometrySink, data: CityKitData): void => {
  const [y0, y1] = [FOODHALL_CEILING - 0.62, FOODHALL_CEILING - 0.12];
  for (const u of ALCHEMIA_UNITS) {
    const s = openSide(u);
    const half = s.length / 2 - 0.35;
    boxOf(sink, data, sideBox(s, -half, half, 0, 0.12, y0, y1), "sign-back");
    const height = Math.min(0.32, (2 * half - 0.3) / Math.max(0.1, neonWidth(u.sign, 1)));
    const foot = y0 + (y1 - y0 - height) / 2;
    const swatch = u.shut ? "trim" : (SIGN[u.cuisine] ?? "neon-cyan");
    for (const t of neonText(u.sign, height)) boxOf(sink, data, sideBox(s, t.x0, t.x1, 0.12, 0.17, foot + t.y0, foot + t.y1), swatch);
  }
};

/** The warm strip of light round the atrium under the roof's slab, over the galleries (as P0's under P1). */
const ringLights = (sink: GeometrySink, data: CityKitData): void => {
  const y = FOODHALL_CEILING - 0.02;
  const [x0, x1, z0, z1] = [ATRIUM.x0 - 1.2, ATRIUM.x1 + 1.2, ATRIUM.z0 - 1.2, ATRIUM.z1 + 1.2];
  for (const z of [z0, z1 - 0.25]) boxOf(sink, data, { x0, x1, z0: z, z1: z + 0.25, y0: y - 0.06, y1: y }, "win-warm");
  for (const x of [x0, x1 - 0.25]) boxOf(sink, data, { x0: x, x1: x + 0.25, z0: z0 + 0.25, z1: z1 - 0.25, y0: y - 0.06, y1: y }, "win-warm");
};

/**
 * The food hall's own sign (§9: a landmark seen from the escalators' arrival and from the floors under
 * it across the atrium): a dark box hung under the roof's slab over the north gallery, FOOD HALL in
 * amber neon facing south across the atrium (the mall's own name for it, the same in every language).
 */
const hallSign = (sink: GeometrySink, data: CityKitData): void => {
  const s = { mid: { x: (ATRIUM.x0 + ATRIUM.x1) / 2, z: ATRIUM.z1 + 0.9 }, along: { x: 1, z: 0 }, out: { x: 0, z: -1 }, length: 0 };
  const [y0, y1] = [FOODHALL_CEILING - 1.0, FOODHALL_CEILING - 0.25];
  boxOf(sink, data, sideBox(s, -4.2, 4.2, 0, 0.15, y0, y1), "sign-back");
  boxOf(sink, data, sideBox(s, -4.2, 4.2, 0, 0.15, y1, FOODHALL_CEILING), "cable");
  const height = 0.45;
  const foot = y0 + (y1 - y0 - height) / 2;
  for (const t of neonText("FOOD HALL", height)) boxOf(sink, data, sideBox(s, t.x0, t.x1, 0.15, 0.21, foot + t.y0, foot + t.y1), "neon-amber");
};

/** The food hall's own drawing on top of its pieces: the signs and the light round the atrium. */
export const foodhallGeometry = (sink: GeometrySink, data: CityKitData): void => {
  unitSigns(sink, data);
  hallSign(sink, data);
  ringLights(sink, data);
};
