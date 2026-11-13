import { type Pt, type Reach, polylineLength } from "./lublin/roads";

/**
 * How far a street's carriageway reaches beside its axis, read off the import's width at the
 * axis' points (`RoadChain.half`, ADR-0080 decision 4), not measured on the asphalt drawn: a
 * lane does not move when a round join or a seam moves the asphalt's edge by a few centimetres
 * (G-744). `onRoad` only checks the lanes in the glitch scan (`car-lane-off-road`).
 */

/** A street's axis and its carriageway's reach `[left, right]` at each of its points. */
export interface Street {
  readonly points: readonly Pt[];
  readonly half: readonly Reach[];
}

/** The street walked the other way: its points reversed, its left its right. */
export const turnedRound = (st: Street): Street => ({ points: [...st.points].reverse(), half: [...st.half].reverse().map(([l, r]): Reach => [r, l]) });

/**
 * How far the carriageway reaches to the right (`side` 1) or the left (-1) of the street's axis
 * at arc length `s` (m): the nearer point's, as the import reads each point's reach over the
 * stretch it stands for, from halfway to the point before to halfway to the next. Read linearly
 * between the points, a bay by one point widened the street up to the next one 70 m on.
 */
export const reachAt = (st: Street, s: number, side: 1 | -1): number => {
  const k = side === 1 ? 1 : 0;
  const pts = st.points;
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
    if (acc + seg >= s || i === pts.length - 1) return st.half[s - acc < seg / 2 ? i - 1 : i]![k];
    acc += seg;
  }
  return st.half[0]?.[k] ?? 0;
};

/** How far the carriageway reaches to the right of a street's axis: the median (or quantile `q`) over samples every 10 m (m). */
export const roadHalfWidth = (st: Street, side: 1 | -1 = 1, q = 0.5): number => {
  const out: number[] = [];
  const len = polylineLength(st.points);
  for (let s = 5; s < len; s += 10) {
    const w = reachAt(st, s, side);
    if (w > 0) out.push(w);
  }
  if (out.length === 0) return 0;
  out.sort((a, b) => a - b);
  return out[Math.floor((out.length - 1) * q + 0.5)]!;
};
