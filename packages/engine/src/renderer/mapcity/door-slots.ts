import { type FacadeFrame, type Wall, frameWallMeta, hiddenWall } from "./facade-frame";
import { WINDOW_STYLE } from "./facade-style";
import { type VenueBoard, venueBoards } from "./venue-plan";

/**
 * Where a door may stand on a wall of a map building (ADR-0058 stage 9). The facade shader paints
 * the windows and shop windows from the wall's UVs (`toon-city.ts`, `facadeGlass`); here the same
 * layout in metres, for the ground floor, so a door goes either between the panes (a pier) or over
 * one whole pane (a tall door with a fanlight where a window was, a shop's door with its side
 * lights over a shop window), never half over a pane. The boards of the venues (`venueBoards`)
 * keep the doors under them. Pure functions of the frame.
 */

/** A pane of the ground floor on a wall: metres along it from `a`, metres above the ground floor. */
export interface GlassRect {
  readonly u0: number;
  readonly u1: number;
  readonly y0: number;
  readonly y1: number;
  /** The dark passage of a tenement's gate the shader may paint in the second bay: never covered. */
  readonly gate?: boolean;
}

/**
 * A place for a door on a wall: its middle along it, its width, its top over the ground floor
 * (the lowest it may be: over a pane it covers), the highest its top may reach (under a board, under
 * the first floor), and whether it covers a pane.
 */
export interface DoorSlot {
  readonly u: number;
  readonly width: number;
  readonly top: number;
  readonly max: number;
  readonly cover: boolean;
}

/** Window rectangles of the styles in their cell (u across the bay, fy up the storey), `facadeWindow`. */
const WINDOW_RECT: Readonly<Record<number, readonly [number, number, number, number]>> = {
  [WINDOW_STYLE.tenement]: [0.3, 0.7, 0.24, 0.8],
  [WINDOW_STYLE.modern]: [0.1, 0.9, 0.25, 0.84],
  [WINDOW_STYLE.civic]: [0.28, 0.72, 0.2, 0.86],
  [WINDOW_STYLE.industrial]: [0.04, 0.96, 0.56, 0.8],
  [WINDOW_STYLE.block]: [0.2, 0.8, 0.3, 0.76],
};

/** The shader's storey, bay and seed of a wall, as its UVs quantise them (`wallMeta`, `facadeDecode`). */
const decoded = (f: FacadeFrame, w: Wall): { storey: number; bay: number; seed: number } => {
  const [mx, my] = frameWallMeta(f, w);
  return { storey: Math.floor(mx + 0.0005) / 10, bay: Math.floor((mx % 1) * 1000 + 0.5) / 100, seed: (Math.floor((my % 1) * 256) + 0.5) / 256 };
};

/**
 * The panes the shader paints on a wall's ground floor; none on a wall without windows, a hidden
 * one or a church's (its lancets run the whole wall: no doors there).
 */
export const groundGlass = (f: FacadeFrame, w: Wall): GlassRect[] => {
  const { storey, bay, seed } = decoded(f, w);
  if (storey < 0.05 || bay <= 0 || hiddenWall(f, w) || f.style.window === WINDOW_STYLE.church) return [];
  const ground = storey * 1.25;
  const out: GlassRect[] = [];
  if (f.style.shopfront) {
    // fract(seed * 3.1) in single precision, as the GPU has it.
    const sb = bay * (Math.fround(Math.fround(seed * 3.1) % 1) > 0.5 ? 1 : 2);
    for (let c = 0; c * sb < w.length; c++) out.push({ u0: (c + 0.05) * sb, u1: (c + 0.95) * sb, y0: 0.45, y1: ground - 0.85 });
    return out;
  }
  const r = WINDOW_RECT[f.style.window];
  if (!r) return [];
  for (let c = 0; c * bay < w.length; c++) {
    if (c === 1 && f.style.window === WINDOW_STYLE.tenement) out.push({ u0: (c + 0.16) * bay, u1: (c + 0.84) * bay, y0: 0, y1: ground * 0.8, gate: true });
    else out.push({ u0: (c + r[0]) * bay, u1: (c + r[1]) * bay, y0: r[2] * ground, y1: r[3] * ground });
  }
  return out;
};

/** Clearance of a door's edge from a pane beside it, and how far it reaches past one it covers (m). */
export const GLASS_GAP = 0.05;
const COVER_MARGIN = 0.04;
/** How far a door that covers a pane reaches over its top (m). */
const COVER_TOP = 0.01;
/** A door between panes: its width at most, at least, and its top over the ground floor (m). */
const PIER = { width: 1.2, min: 0.9, top: 2.3 } as const;
/** A door over a pane: the widest pane and the highest top it takes (m). */
const COVER = { width: 2.9, top: 3.6 } as const;
/** Doors keep this far from the wall's ends, and from under a board's ends (m). */
const END_ROOM = 0.35;
/** Between a board's bottom and a door's top under it, and its sides past a board's ends (m). */
const BOARD_ROOM = 0.005;
/** How much higher than its top a door between panes may be drawn (its size's rounding, m). */
const PIER_SLACK = 0.1;
/** Spacing of the slots along a stretch of wall without panes at door height (m). */
const PLAIN_STEP = 1;

/** Does a door from u0 to u1, up to `top`, keep off every pane or cover it whole? */
export const clearOfGlass = (glass: readonly GlassRect[], u0: number, u1: number, top: number): boolean =>
  glass.every((g) => {
    const apart = g.u1 <= u0 - GLASS_GAP + 1e-6 || g.u0 >= u1 + GLASS_GAP - 1e-6 || g.y0 >= top + GLASS_GAP - 1e-6;
    const covered = !g.gate && g.u0 >= u0 + COVER_MARGIN / 2 - 1e-6 && g.u1 <= u1 - COVER_MARGIN / 2 + 1e-6 && g.y1 <= top - COVER_TOP / 2 + 1e-6;
    return apart || covered;
  });

/** The stretches of a wall clear of panes up to `top`, inside its ends. */
const clearStretches = (glass: readonly GlassRect[], length: number, top: number): [number, number][] => {
  const blocked = glass
    .filter((g) => g.y0 < top + GLASS_GAP)
    .map((g) => [g.u0 - GLASS_GAP, g.u1 + GLASS_GAP] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let u = END_ROOM;
  for (const [a, b] of blocked) {
    if (a > u) out.push([u, Math.min(a, length - END_ROOM)]);
    u = Math.max(u, b);
  }
  if (u < length - END_ROOM) out.push([u, length - END_ROOM]);
  return out.filter(([a, b]) => b > a);
};

/** The boards on a wall, as stretches along it with their bottoms over the ground floor. */
export const boardsOn = (f: FacadeFrame, w: Wall, boards: readonly VenueBoard[] = venueBoards(f)): { u0: number; u1: number; bottom: number }[] =>
  boards.filter((b) => b.wall === w).map((b) => ({ u0: b.u - b.width / 2, u1: b.u + b.width / 2, bottom: b.y - b.height / 2 - f.b.base }));

/** The top a door from u0 to u1 may reach under the boards (Infinity with none over it). */
const underBoards = (boards: readonly { u0: number; u1: number; bottom: number }[], u0: number, u1: number): number =>
  Math.min(Infinity, ...boards.filter((b) => b.u0 < u1 + BOARD_ROOM && b.u1 > u0 - BOARD_ROOM).map((b) => b.bottom - BOARD_ROOM));

/**
 * The slots for a door on a wall: between the panes (`PIER` wide at most, every `PLAIN_STEP` on a
 * long stretch without panes) and over each pane narrow and low enough (`COVER`), under the
 * boards. None on a party wall, a hidden one, a wall without windows of a style that has them, a
 * church's, or along a wall with the game's doorways (the game's own doors and passages).
 */
export const doorSlots = (f: FacadeFrame, w: Wall, boards: readonly VenueBoard[] = venueBoards(f)): DoorSlot[] => {
  if (w.blind || hiddenWall(f, w) || f.style.window === WINDOW_STYLE.church || w.length < 2 * END_ROOM + PIER.min) return [];
  if ((f.b.doorways ?? []).length > 0 || (f.b.passages ?? []).length > 0) return [];
  const glass = groundGlass(f, w);
  if (glass.length === 0 && f.style.window !== WINDOW_STYLE.none) return [];
  const spans = boardsOn(f, w, boards);
  // Under the first floor's panes (the shader's ground floor, `facadeDecode`).
  const first = (Math.floor(frameWallMeta(f, w)[0] + 0.0005) / 10) * 1.25 - GLASS_GAP;
  const out: DoorSlot[] = [];
  const add = (u: number, width: number, top: number, cover: boolean) => {
    const max = Math.min(cover ? first : top + PIER_SLACK, underBoards(spans, u - width / 2, u + width / 2));
    const low = Math.min(top, max);
    if (cover ? max < top : low < PIER.top - 0.2) return;
    if (clearOfGlass(glass, u - width / 2, u + width / 2, Math.max(low, max))) out.push({ u, width, top: low, max, cover });
  };
  for (const [a, b] of clearStretches(glass, w.length, PIER.top)) {
    const room = b - a;
    if (room < PIER.min) continue;
    if (room < 2 * PIER.width + PLAIN_STEP) add((a + b) / 2, Math.min(PIER.width, room), PIER.top, false);
    else for (let u = a + PIER.width / 2; u <= b - PIER.width / 2 + 1e-6; u += PLAIN_STEP) add(u, PIER.width, PIER.top, false);
  }
  for (const g of glass) {
    const width = g.u1 - g.u0 + COVER_MARGIN;
    if (g.gate || width > COVER.width || g.y1 + COVER_TOP > COVER.top || g.u0 - COVER_MARGIN / 2 < END_ROOM || g.u1 + COVER_MARGIN / 2 > w.length - END_ROOM) continue;
    add((g.u0 + g.u1) / 2, width, g.y1 + COVER_TOP, true);
  }
  return out.sort((p, q) => p.u - q.u);
};
