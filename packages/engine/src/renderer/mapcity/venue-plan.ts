import { SIGN_GLYPHS } from "@seki/core";
import type { MeshSink } from "../mesh-sink";
import { type FacadeFrame, type Wall, hiddenWall } from "./facade-frame";
import { MAP_SIGN_KIND, type SignGround, flatOnWall, signReflection, signTint } from "./sign-plan";
import { blockedStretches, clearStretches } from "./sign-room";

/**
 * Signs of the real venues on the ground floors (ADR-0064 stage 4): a neon board over the window
 * on the street wall nearest where the map has the venue, its 2077 name in neon letters from
 * the glyph atlas (one quad per letter in the cell's sign mesh, so no draw call more) and the
 * streak on the wet pavement. The boards of one wall never overlap, nor cover a doorway.
 */

/** Height of a letter's quad and the board's margins round the name, metres. */
export const GLYPH_HEIGHT = 0.5;
const PAD_X = 0.2;
const PAD_Y = 0.11;
export const VENUE_BOARD_HEIGHT = GLYPH_HEIGHT + 2 * PAD_Y;
/** Gap between two boards on a wall, and from a board to the wall's ends. */
const GAP = 0.3;
const MAX_WIDTH = 7.5;
/** A wall shorter than this takes no board. */
const MIN_WALL = 2.4;
/** How far the board and its letters stand off the wall, metres. */
const BOARD_OUT = 0.1;
const GLYPH_OUT = 0.13;
/** Narrowest squeeze of the letters before they get smaller too. */
const MIN_SQUEEZE = 0.6;

const NARROW = new Set([..."I1.'!:·"]);
const HALF = new Set([..."J-/ "]);
const WIDE = new Set([..."MW"]);

/** How much of its square cell a letter takes across (0..1): the atlas draws each one centred in its cell. */
export const glyphAdvance = (ch: string): number => (NARROW.has(ch) ? 0.36 : HALF.has(ch) ? 0.5 : WIDE.has(ch) ? 0.86 : 0.68);

/** The atlas cell of a letter, or null for one the atlas does not have. */
export const glyphCell = (ch: string): number | null => {
  const i = SIGN_GLYPHS.indexOf(ch);
  return i < 0 ? null : i;
};

/** A venue's board on a wall: centred `u` metres along it, `width` x `height`, the letters' height and squeeze. */
export interface VenueBoard {
  readonly wall: Wall;
  readonly u: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly glyph: number;
  readonly squeeze: number;
  readonly text: string;
  readonly color: string;
}

const along = (w: Wall, x: number, z: number): { u: number; off: number } => {
  const dx = (w.b.x - w.a.x) / w.length;
  const dz = (w.b.z - w.a.z) / w.length;
  return { u: (x - w.a.x) * dx + (z - w.a.z) * dz, off: (x - w.a.x) * w.nx + (z - w.a.z) * w.nz };
};

const distance = (w: Wall, x: number, z: number): number => {
  const { u, off } = along(w, x, z);
  const k = Math.max(0, Math.min(w.length, u));
  return Math.hypot(k - u, off);
};

/** With a hair of slack: a spot set exactly `GAP` off a taken stretch must not fail on the float sum. */
const overlaps = (taken: readonly (readonly [number, number])[], lo: number, hi: number): boolean => taken.some(([a, b]) => lo < b + GAP - 1e-6 && hi > a - GAP + 1e-6);

/** The width of a name in letters of `GLYPH_HEIGHT`, unsqueezed. */
const textWidth = (text: string): number => [...text].reduce((s, c) => s + glyphAdvance(c), 0) * GLYPH_HEIGHT;

/**
 * Where the boards of a building's venues go: each on the street wall nearest it (a party wall
 * or a wall a neighbour hides takes none), as near its point as the wall's ends, the doorways the
 * game cut, a neighbour standing out in front of the wall and the boards already there allow; a
 * venue with no room left gets none. Landmarks keep their own signs (ADR-0062): none there.
 */
export const venueBoards = (f: FacadeFrame): VenueBoard[] => {
  const venues = f.b.venues ?? [];
  if (venues.length === 0) return [];
  const walls = f.walls.filter((w) => !w.blind && !hiddenWall(f, w) && w.length >= MIN_WALL);
  const taken = new Map<Wall, [number, number][]>();
  for (const w of walls) {
    const doors = (f.b.doorways ?? []).flatMap((d) => {
      const p = along(w, d.x, d.z);
      return Math.abs(p.off) < 0.6 && p.u > -d.width && p.u < w.length + d.width ? [[p.u - d.width / 2, p.u + d.width / 2] as [number, number]] : [];
    });
    taken.set(w, doors);
  }
  const y = Math.max(f.b.base + f.ground - 0.45, f.b.base + 2.3 + VENUE_BOARD_HEIGHT / 2);
  // A neighbour standing out in front of the wall takes its stretch as a doorway does (G-159).
  const clear = new Map<Wall, number>();
  const room = (w: Wall): number => {
    let r = clear.get(w);
    if (r === undefined) {
      const stretches = clearStretches(f, w, BOARD_OUT, GLYPH_OUT, y - VENUE_BOARD_HEIGHT / 2);
      taken.get(w)!.push(...blockedStretches(stretches, w.length));
      r = Math.max(0, ...stretches.map(([a, b]) => b - a));
      clear.set(w, r);
    }
    return r;
  };
  const out: VenueBoard[] = [];
  for (const v of venues) {
    // The nearest wall with a clear stretch as long as the shortest wall that takes a board.
    const w = walls
      .slice()
      .sort((a, b) => distance(a, v.x, v.z) - distance(b, v.x, v.z))
      .find((x) => room(x) >= MIN_WALL);
    if (!w) continue;
    const text = [...v.name.toUpperCase()].filter((c) => glyphCell(c) !== null).join("").trim();
    if (!text) continue;
    const space = Math.min(room(w) - 2 * GAP, MAX_WIDTH);
    const natural = textWidth(text);
    const fit = Math.min(1, (space - 2 * PAD_X) / natural);
    const squeeze = Math.max(fit, MIN_SQUEEZE);
    const glyph = GLYPH_HEIGHT * Math.min(1, fit / MIN_SQUEEZE);
    const width = (natural * squeeze * glyph) / GLYPH_HEIGHT + 2 * PAD_X;
    const busy = taken.get(w)!;
    const want = Math.max(width / 2 + GAP, Math.min(w.length - width / 2 - GAP, along(w, v.x, v.z).u));
    const spots = [want, ...busy.flatMap(([a, b]) => [b + GAP + width / 2, a - GAP - width / 2])].sort((p, q) => Math.abs(p - want) - Math.abs(q - want));
    const u = spots.find((s) => s - width / 2 >= GAP - 1e-6 && s + width / 2 <= w.length - GAP + 1e-6 && !overlaps(busy, s - width / 2, s + width / 2));
    if (u === undefined) continue;
    busy.push([u - width / 2, u + width / 2]);
    out.push({ wall: w, u, y, width, height: glyph + 2 * PAD_Y, glyph, squeeze, text, color: v.color });
  }
  return out;
};

/** Height of the venue board on this wall, or null: the awnings keep under it (ADR-0058). */
export const venueBoardOn = (f: FacadeFrame, w: Wall): number | null => venueBoards(f).find((b) => b.wall === w)?.height ?? null;

/** The boards, letters and streaks of a building's venues; `lite` (the phone) leaves the streaks out. Returns the boards drawn. */
export const planVenueSigns = (sink: MeshSink, f: FacadeFrame, ground: SignGround = () => null, lite = false): number => {
  const boards = venueBoards(f);
  for (const b of boards) {
    const color = signTint(b.color, 1);
    flatOnWall(sink, b.wall, b.u, b.y, BOARD_OUT, b.width, b.height, color, [b.width / b.height, MAP_SIGN_KIND.venue]);
    let x = b.u - b.width / 2 + PAD_X;
    for (const ch of b.text) {
      const adv = glyphAdvance(ch);
      const w = adv * b.glyph * b.squeeze;
      const cell = glyphCell(ch);
      if (cell !== null && ch !== " ") flatOnWall(sink, b.wall, x + w / 2, b.y, GLYPH_OUT, w, b.glyph, color, [cell + Math.min(adv, 0.98), MAP_SIGN_KIND.glyph]);
      x += w;
    }
    if (!lite) signReflection(sink, b.wall, b.u, ground, f.b.foot + 0.16, b.width * 0.9, 6, signTint(b.color, 0.8), (b.u * 7.31) % 1);
  }
  return boards.length;
};
