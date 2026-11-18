import type { Vec3 } from "@seki/core";
import type { KitPainter, Tint } from "./w3-kit";

/**
 * Stencilled lettering on W-3's walls (ADR-0082 stage 4, picture 01 and 04): the in-world Polish
 * of the plant, kept Polish in every language as the city's own signs are (ADR-0056), painted as
 * flat quads on the city kit's swatches in the hall's meshes: no glyph atlas, no draw call. A
 * 5 x 7 pixel face, each row's runs merged down the rows into rectangles. Pure data.
 */

/** The plant's words on its walls. */
export const W3_WORDS = {
  sector: "SEKTOR W-3",
  plant: "ZAKŁADY MILITARNE",
  secret: "ŚCIŚLE TAJNE",
  tower: "W-3",
} as const;

/** Pixels of a glyph top row first; a glyph of 8 rows has its first above the capitals (an accent). */
const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "....#", "....#", "....#", "....#", "#...#", ".###."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  Ł: [".#...", ".#...", ".#.#.", ".##..", "##...", ".#...", ".####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  Ś: ["...#.", ".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
};

/** A glyph's width and the gap after it, in pixels; the capitals' height. */
const WIDTH = 5;
const ADVANCE = 6;
const CAPS = 7;

/** A rectangle of a text in metres: `x0..x1` right of the text's middle, `y0..y1` up from its foot. */
export interface LetterRect {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

/** Can the face paint every letter of `text`? */
export const paintable = (text: string): boolean => [...text].every((ch) => GLYPHS[ch] !== undefined);

/** The width of `text` in metres with capitals `height` high. */
export const letteringWidth = (text: string, height: number): number => ((ADVANCE * [...text].length - (ADVANCE - WIDTH)) * height) / CAPS;

/** One glyph's rectangles in pixels from its foot: runs of a row, merged down the rows below while they repeat. */
const glyphRects = (rows: readonly string[]): LetterRect[] => {
  const open = new Map<string, { x0: number; x1: number; y0: number; y1: number }>();
  const out: LetterRect[] = [];
  rows.forEach((row, r) => {
    const y = rows.length - 1 - r;
    const runs = new Set<string>();
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== "#") continue;
      let end = x;
      while (row[end + 1] === "#") end++;
      runs.add(`${x}:${end + 1}`);
      x = end;
    }
    for (const [key, rect] of open) {
      if (runs.has(key)) continue;
      out.push(rect);
      open.delete(key);
    }
    for (const key of runs) {
      const rect = open.get(key);
      if (rect) rect.y0 = y;
      else {
        const [x0, x1] = key.split(":").map(Number) as [number, number];
        open.set(key, { x0, x1, y0: y, y1: y + 1 });
      }
    }
  });
  return [...out, ...open.values()];
};

/** The rectangles of `text` (letters the face lacks are left blank), centred, capitals `height` high. */
export const letteringRects = (text: string, height: number): LetterRect[] => {
  const px = height / CAPS;
  let x = -letteringWidth(text, height) / 2;
  const out: LetterRect[] = [];
  for (const ch of text) {
    for (const r of glyphRects(GLYPHS[ch] ?? [])) out.push({ x0: x + r.x0 * px, x1: x + r.x1 * px, y0: r.y0 * px, y1: r.y1 * px });
    x += ADVANCE * px;
  }
  return out;
};

/** Where a text is painted: its foot's middle, the wall's outward normal (horizontal) and the capitals' height. */
export interface Lettering {
  readonly text: string;
  readonly at: Vec3;
  readonly normal: Vec3;
  readonly height: number;
  readonly swatch: string;
  readonly tint?: Tint;
  /** How far off the wall (m): a centimetre for paint, more for a plate before a drawn facade. */
  readonly off?: number;
}

/** Paints a text flat on a wall, `off` it (a centimetre unless told), read from in front of it. */
export const paintLettering = (k: KitPainter, l: Lettering): void => {
  // A reader facing the wall has its right along the normal turned a quarter right (x east, z north).
  const right = { x: -l.normal.z, y: 0, z: l.normal.x };
  const off = l.off ?? 0.012;
  const p = (u: number, v: number): Vec3 => ({ x: l.at.x + right.x * u + l.normal.x * off, y: l.at.y + v, z: l.at.z + right.z * u + l.normal.z * off });
  for (const r of letteringRects(l.text, l.height)) k.quad(p(r.x0, r.y0), p(r.x1, r.y0), p(r.x1, r.y1), p(r.x0, r.y1), l.normal, l.swatch, l.tint);
};
