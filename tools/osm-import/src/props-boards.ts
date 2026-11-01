/**
 * The venues' boards on the walls (ADR-0064 stage 4) as the street furniture sees them: where a
 * board hangs, and the wall lantern (ADR-0047) slid along its wall off a board it would hide
 * (G-158). The boards themselves come from the renderer's plan (`venue-boards.ts`).
 */
import type { Pt } from "./geometry.ts";

/** A board on a wall: its two ends on the wall's line, the wall's outward normal, its height (world y) and the wall's ends. */
export interface BoardSpan {
  readonly a: Pt;
  readonly b: Pt;
  readonly nx: number;
  readonly nz: number;
  readonly bottom: number;
  readonly top: number;
  readonly wallA: Pt;
  readonly wallB: Pt;
  readonly text: string;
}

/** A wall lantern round its point: half its width along the wall, how far out from the wall it reaches, its height over the ground. */
export const LANTERN = { half: 0.2, depth: 2, bottom: 3.4, top: 4.5 } as const;

/** Where p is along the board (0 at its `a` end) and off its wall. */
const onBoard = (s: BoardSpan, p: Pt): { u: number; off: number; length: number } => {
  const length = Math.hypot(s.b.x - s.a.x, s.b.z - s.a.z) || 1;
  const dx = (s.b.x - s.a.x) / length;
  const dz = (s.b.z - s.a.z) / length;
  return { u: (p.x - s.a.x) * dx + (p.z - s.a.z) * dz, off: (p.x - s.a.x) * s.nx + (p.z - s.a.z) * s.nz, length };
};

/** The board a lantern at p (its ground at `y`) hangs in front of, within `gap` metres past the board's ends, or null. */
export const boardBehind = (boards: readonly BoardSpan[], p: Pt, y: number, gap = 0): BoardSpan | null =>
  boards.find((s) => {
    if (y + LANTERN.bottom >= s.top || y + LANTERN.top <= s.bottom) return false;
    const { u, off, length } = onBoard(s, p);
    return off > -0.5 && off < LANTERN.depth && u > -LANTERN.half - gap && u < length + LANTERN.half + gap;
  }) ?? null;

/** How far past a board's end a lantern slid off it keeps (m): its half width and a hand's breadth, kept past the 0.1 m the chunks round to. */
const CLEAR = LANTERN.half + 0.4;

/**
 * A wall lantern at p off the boards: p itself when no board is behind it, else the nearest
 * point slid along the board's wall past one of its ends, still out of the building and with
 * its wall right behind it, and no other board behind; null when there is none.
 */
export const offBoards = (boards: readonly BoardSpan[], p: Pt, y: number, inBuilding: (q: Pt) => boolean): Pt | null => {
  const s = boardBehind(boards, p, y, 0.3);
  if (!s) return p;
  const { u, off, length } = onBoard(s, p);
  const back = Math.max(off, 0) + 0.3;
  const dx = (s.b.x - s.a.x) / length;
  const dz = (s.b.z - s.a.z) / length;
  const wall = { from: onBoard(s, s.wallA).u, to: onBoard(s, s.wallB).u };
  const spots = [-CLEAR, length + CLEAR].sort((m, n) => Math.abs(m - u) - Math.abs(n - u));
  for (const t of spots) {
    if (t - LANTERN.half < Math.min(wall.from, wall.to) || t + LANTERN.half > Math.max(wall.from, wall.to)) continue;
    const q = { x: p.x + dx * (t - u), z: p.z + dz * (t - u) };
    const wallBehind = inBuilding({ x: q.x - s.nx * back, z: q.z - s.nz * back });
    if (!inBuilding(q) && wallBehind && !boardBehind(boards, q, y, 0.3)) return q;
  }
  return null;
};
