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

/**
 * A wall lantern round its point (`prop-lamps.ts`): its arm reaches `reach` metres along its
 * facing to the far side of the lantern, `half` metres either side of the arm, from `bottom` to
 * `top` over the ground.
 */
export const LANTERN = { half: 0.25, reach: 0.95, bottom: 3.1, top: 4.5 } as const;

/** Where p is along the board (0 at its `a` end) and off its wall. */
const onBoard = (s: BoardSpan, p: Pt): { u: number; off: number; length: number } => {
  const length = Math.hypot(s.b.x - s.a.x, s.b.z - s.a.z) || 1;
  const dx = (s.b.x - s.a.x) / length;
  const dz = (s.b.z - s.a.z) / length;
  return { u: (p.x - s.a.x) * dx + (p.z - s.a.z) * dz, off: (p.x - s.a.x) * s.nx + (p.z - s.a.z) * s.nz, length };
};

/** The lantern at p facing f, along a board: the span of its arm and lantern along the wall, and the arm's two ends off it. */
const reachAlong = (s: BoardSpan, p: Pt, f: Pt | null) => {
  const head = f ? { x: p.x + f.x * LANTERN.reach, z: p.z + f.z * LANTERN.reach } : p;
  const a = onBoard(s, p);
  const b = onBoard(s, head);
  return { lo: Math.min(a.u, b.u) - LANTERN.half, hi: Math.max(a.u, b.u) + LANTERN.half, near: Math.min(a.off, b.off), far: Math.max(a.off, b.off), length: a.length, u: a.u };
};

/** The board a lantern at p facing f (its ground at `y`) hangs in front of, within `gap` metres past the board's ends, or null. */
export const boardBehind = (boards: readonly BoardSpan[], p: Pt, y: number, f: Pt | null, gap = 0): BoardSpan | null =>
  boards.find((s) => {
    if (y + LANTERN.bottom >= s.top || y + LANTERN.top <= s.bottom) return false;
    const r = reachAlong(s, p, f);
    return r.far > 0 && r.near < 2 && r.lo < r.length + gap && r.hi > -gap;
  }) ?? null;

/** How far past a board's end a lantern slid off it keeps (m), kept past the 0.1 m the chunks round to. */
const CLEAR = 0.35;
/** How close to a board's end a lantern already counts as on it (m): under `CLEAR`, so one slid past it stays clear. */
const NEAR = 0.2;

/**
 * A wall lantern at p off the boards: p itself when no board is behind it, else the nearest
 * point slid along the board's wall until the lantern and its arm (facing `facing` there) clear
 * one of its ends, still out of the building and with its wall right behind it, and no other
 * board behind; null when there is none.
 */
export const offBoards = (boards: readonly BoardSpan[], p: Pt, y: number, facing: (q: Pt) => Pt | null, inBuilding: (q: Pt) => boolean): Pt | null => {
  const s = boardBehind(boards, p, y, facing(p), NEAR);
  if (!s) return p;
  const r = reachAlong(s, p, facing(p));
  const dx = (s.b.x - s.a.x) / r.length;
  const dz = (s.b.z - s.a.z) / r.length;
  const back = Math.max(r.near, 0) + 0.3;
  const wall = [onBoard(s, s.wallA).u, onBoard(s, s.wallB).u].sort((m, n) => m - n) as [number, number];
  // Shifts that put the lantern's span past the board's start or its end.
  const shifts = [-CLEAR - r.hi, r.length + CLEAR - r.lo].sort((m, n) => Math.abs(m) - Math.abs(n));
  for (const t of shifts) {
    if (r.u + t - LANTERN.half < wall[0] || r.u + t + LANTERN.half > wall[1]) continue;
    const q = { x: p.x + dx * t, z: p.z + dz * t };
    const wallBehind = inBuilding({ x: q.x - s.nx * back, z: q.z - s.nz * back });
    if (!inBuilding(q) && wallBehind && !boardBehind(boards, q, y, facing(q), NEAR)) return q;
  }
  return null;
};
