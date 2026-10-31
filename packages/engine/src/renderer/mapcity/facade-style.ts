import type { BuildingUse } from "@seki/core";
import { prng } from "../city-kit-data";

/**
 * How a building from the map looks (ADR-0044): a pure function of its use, size and `look`
 * seed, so the same descriptor always gives the same facade. Lublin 2077: the pastel plaster,
 * cornices, attics and window rhythm of the tenements on Krakowskie Przedmieście and in the
 * Old Town, under the neon and holo of a Kabuki night.
 */

/** Window pattern the facade shader paints (uv2.y integer part, low three bits). */
export const WINDOW_STYLE = {
  /** No windows: trims, firewalls, attics, roofs. */
  none: 0,
  /** Tall paired-casement windows with lintels and sills, pilasters on some. */
  tenement: 1,
  /** Wide office or shop windows. */
  modern: 2,
  /** Tall and widely spaced: town hall, school, theatre. */
  civic: 3,
  /** Lancet windows across the whole wall. */
  church: 4,
  /** A ribbon of glass under the eaves. */
  industrial: 5,
  /** A regular grid of square windows: the post-war blocks. */
  block: 6,
} as const;

/** Added to the window style: the ground floor is a row of lit shop windows. */
export const SHOPFRONT_BIT = 8;
/** Style code of roof surfaces (tile rows in the shader). */
export const ROOF_STYLE = 16;

export type AtticKind = "none" | "parapet" | "crenel";
export type RoofKind = "flat" | "hip" | "dome";

export interface FacadeStyle {
  readonly plaster: string;
  /** Cornices, string courses, window trims: lighter than the plaster. */
  readonly trim: string;
  readonly plinth: string;
  readonly roofColor: string;
  readonly window: number;
  readonly shopfront: boolean;
  /** Window bay width (m) the walls aim for; each wall rounds it to fit a whole number. */
  readonly bay: number;
  readonly attic: AtticKind;
  readonly atticHeight: number;
  /** Main cornice under the attic or the roof. */
  readonly cornice: boolean;
  /** String course over the ground floor. */
  readonly stringCourse: boolean;
  readonly roof: RoofKind;
  /** A bell tower (churches). */
  readonly tower: boolean;
  /** The building is a free-standing tower: its storeys are tiers of about 8 m. */
  readonly freeTower: boolean;
  /** Neon tube along the cornice. */
  readonly neonTrim: string | null;
  /** Signs over the shop windows (0 none). */
  readonly signs: number;
  /** Seed in [0, 1) the shader varies lit windows and shop colours by. */
  readonly seed: number;
}

/** Plaster of the old town: ochre, salmon, mint, butter yellow, terracotta, cream, pale blue, dusty pink. */
const TENEMENT_PLASTER = ["#d9b48a", "#c98f7a", "#a9c2a8", "#e3d39a", "#b9876a", "#d8cdb8", "#9fb4c8", "#c7a3b5", "#e0a96d", "#b7b98f"] as const;
const CIVIC_PLASTER = ["#d6d0c2", "#c9c2b0", "#d9cbb0", "#bfc4c4"] as const;
const CHURCH_PLASTER = ["#e4ddcc", "#ddd2b8", "#e8e2d6"] as const;
const PLAIN_PLASTER = ["#9ea3a6", "#a8a395", "#8f9aa3", "#b0a89a", "#9a9488"] as const;
const INDUSTRIAL_PLASTER = ["#8a8f96", "#7d7a74", "#6f7780", "#857565"] as const;
const ROOFS_TILE = ["#7a3b2e", "#6e3a2c", "#84442f", "#5b3a33"] as const;
const ROOFS_METAL = ["#3d4048", "#2f3238", "#46494f"] as const;
const ROOFS_COPPER = ["#4f7f6f", "#5b8a78", "#46705f"] as const;
const NEON = ["#ff2e88", "#00e5ff", "#ffb000", "#b46cff", "#39ff8a"] as const;

const pick = <T>(rand: () => number, items: readonly T[]): T => items[Math.floor(rand() * items.length) % items.length] as T;

/** Lighter version of a hex colour, mixed towards white. */
export const lighten = (hex: string, t: number): string => {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = (v: number) => Math.round(v + (255 - v) * t);
  return `#${[ch((n >> 16) & 255), ch((n >> 8) & 255), ch(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

export const darken = (hex: string, t: number): string => {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = (v: number) => Math.round(v * (1 - t));
  return `#${[ch((n >> 16) & 255), ch((n >> 8) & 255), ch(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

export interface StyleInput {
  readonly use: BuildingUse;
  readonly levels: number;
  readonly height: number;
  readonly roof?: number;
  readonly look: number;
  /** Footprint area (m²) and the short side of its box: domes go on compact plans only. */
  readonly area: number;
  readonly width: number;
  /** Shops on the ground floor, from the map; absent: chosen from `look` by the use. */
  readonly shopfront?: boolean;
  /** Lifted onto another building (a footbridge, a part of a landmark). */
  readonly lifted?: boolean;
}

const windowFor = (use: BuildingUse, levels: number, rand: () => number): number => {
  switch (use) {
    case "church":
      return WINDOW_STYLE.church;
    case "civic":
      return WINDOW_STYLE.civic;
    case "industrial":
      return WINDOW_STYLE.industrial;
    case "garage":
      return WINDOW_STYLE.none;
    case "commercial":
      return levels >= 6 || rand() < 0.3 ? WINDOW_STYLE.modern : WINDOW_STYLE.tenement;
    case "residential":
      return levels >= 6 && rand() < 0.7 ? WINDOW_STYLE.block : WINDOW_STYLE.tenement;
    case "historic":
      return WINDOW_STYLE.tenement;
    default:
      return rand() < 0.5 ? WINDOW_STYLE.tenement : WINDOW_STYLE.modern;
  }
};

const plasterFor = (use: BuildingUse, rand: () => number): string => {
  switch (use) {
    case "church":
      return pick(rand, CHURCH_PLASTER);
    case "civic":
      return pick(rand, CIVIC_PLASTER);
    case "industrial":
    case "garage":
      return pick(rand, INDUSTRIAL_PLASTER);
    case "other":
      return pick(rand, PLAIN_PLASTER);
    default:
      return pick(rand, TENEMENT_PLASTER);
  }
};

const roofKindFor = (s: StyleInput, rand: () => number): RoofKind => {
  if (!s.roof || s.roof <= 0.3) return "flat";
  // The map's parts carry no roof shape the view could tell (G-049): a hipped roof is a pyramid on a
  // tower and a ridge on a nave, where a dome drawn by chance would crown a gabled nave.
  if (s.lifted) return "hip";
  const compact = s.area < 900 && s.width > 9;
  if ((s.use === "civic" || s.use === "historic" || s.use === "church") && compact && rand() < 0.45) return "dome";
  return "hip";
};

/**
 * A free-standing tower of the old town (Wieża Trynitarska): historic, sacred or civic, at
 * least 20 m tall and two and a half times as tall as it is wide. It gets the tall, widely
 * spaced windows of a civic building in tiers of about 8 m, a church's pale plaster and roof,
 * no shops and no signs, instead of a tenement's grid of storeys.
 */
const isTower = (s: StyleInput): boolean => (s.use === "historic" || s.use === "church" || s.use === "civic") && s.height >= 20 && s.height >= 2.5 * s.width;

/** The facade of a building from its descriptor: deterministic in `look`. */
export const facadeStyle = (s: StyleInput): FacadeStyle => {
  const rand = prng((s.look ^ 0x51ab1e) >>> 0);
  const tower = isTower(s);
  const sacred = tower ? "church" : s.use;
  const window = windowFor(tower ? "civic" : s.use, s.levels, rand);
  const plaster = plasterFor(sacred, rand);
  const oldTown = s.use === "historic" || s.use === "residential" || s.use === "commercial";
  const shopfront = tower ? false : s.shopfront !== undefined ? s.shopfront : s.use === "commercial" ? true : s.use === "residential" || s.use === "historic" ? rand() < 0.55 : s.use === "other" ? rand() < 0.25 : false;
  const roof = roofKindFor(s, rand);
  const flat = roof === "flat";
  const attic: AtticKind = window === WINDOW_STYLE.block || s.use === "garage" || s.use === "industrial" ? (flat ? "parapet" : "none") : flat ? (s.use === "historic" && rand() < 0.6 ? "crenel" : "parapet") : rand() < 0.3 ? "parapet" : "none";
  const roofColor = roof === "dome" || (sacred === "church" && rand() < 0.6) ? pick(rand, ROOFS_COPPER) : oldTown && rand() < 0.7 ? pick(rand, ROOFS_TILE) : pick(rand, ROOFS_METAL);
  const bay = window === WINDOW_STYLE.civic ? 3.6 + rand() * 0.6 : window === WINDOW_STYLE.church ? 4.2 + rand() : window === WINDOW_STYLE.modern ? 3 + rand() * 0.6 : window === WINDOW_STYLE.block ? 2.9 + rand() * 0.3 : 2.6 + rand() * 0.6;
  const lively = !tower && (s.use === "commercial" || shopfront);
  return {
    plaster,
    trim: lighten(plaster, 0.35),
    plinth: darken(plaster, 0.45),
    roofColor,
    window,
    shopfront,
    bay,
    attic,
    atticHeight: attic === "none" ? 0 : attic === "crenel" ? 1.6 : 0.9 + rand() * 0.5,
    cornice: window !== WINDOW_STYLE.block && s.use !== "garage",
    stringCourse: window === WINDOW_STYLE.tenement || window === WINDOW_STYLE.civic,
    roof,
    tower: s.use === "church",
    freeTower: tower,
    neonTrim: lively && rand() < 0.4 ? pick(rand, NEON) : null,
    signs: lively ? 1 + Math.floor(rand() * 2) : 0,
    seed: rand(),
  };
};
