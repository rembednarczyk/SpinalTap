import type { GroundPoint } from "@seki/core";

/**
 * The mouths of the zebra crossings (G-032): the ground a pedestrian steps onto from a zebra,
 * which no bollard or chain may close. A crossing's outline (a `crossing` ground surface, cut
 * to the chunk) is measured along its longest edge, the walking direction; its band reaches
 * `EXIT.depth` past both ends onto the pavement and `EXIT.side` past both sides.
 */
export const CROSSING_EXIT = { side: 0.5, depth: 1.5 } as const;

export interface CrossingBand {
  /** Centre, the walking direction (unit) and the half extents along it and across it. */
  readonly c: GroundPoint;
  readonly u: GroundPoint;
  readonly along: number;
  readonly across: number;
}

/** The band of a crossing's flat outline `[x0, z0, …]`, null when it has no area. */
export const crossingBand = (outline: readonly number[]): CrossingBand | null => {
  const pts: GroundPoint[] = [];
  for (let i = 0; i + 1 < outline.length; i += 2) pts.push({ x: outline[i]!, z: outline[i + 1]! });
  let u = { x: 0, z: 0 };
  let best = 0;
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k]!;
    const b = pts[(k + 1) % pts.length]!;
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    if (l > best) {
      best = l;
      u = { x: (b.x - a.x) / l, z: (b.z - a.z) / l };
    }
  }
  if (best === 0) return null;
  const s = pts.map((p) => p.x * u.x + p.z * u.z);
  const t = pts.map((p) => -p.x * u.z + p.z * u.x);
  const s0 = Math.min(...s);
  const s1 = Math.max(...s);
  const t0 = Math.min(...t);
  const t1 = Math.max(...t);
  const ms = (s0 + s1) / 2;
  const mt = (t0 + t1) / 2;
  return { c: { x: u.x * ms - u.z * mt, z: u.z * ms + u.x * mt }, u, along: (s1 - s0) / 2 + CROSSING_EXIT.depth, across: (t1 - t0) / 2 + CROSSING_EXIT.side };
};

/** Is p in the band, or within `pad` metres of it? */
export const inCrossingBand = (b: CrossingBand, p: GroundPoint, pad = 0): boolean => {
  const dx = p.x - b.c.x;
  const dz = p.z - b.c.z;
  return Math.abs(dx * b.u.x + dz * b.u.z) <= b.along + pad && Math.abs(-dx * b.u.z + dz * b.u.x) <= b.across + pad;
};

/** The bands of every crossing of some chunks' ground. */
export const crossingBands = (chunks: readonly { readonly ground: readonly { readonly surface: string; readonly outline: readonly number[] }[] }[]): CrossingBand[] =>
  chunks.flatMap((c) => c.ground.filter((g) => g.surface === "crossing").flatMap((g) => crossingBand(g.outline) ?? []));
