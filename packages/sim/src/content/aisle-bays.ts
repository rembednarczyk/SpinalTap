import { VEHICLE_SIZE, pointInPairRingEvenOdd } from "@seki/core";

/**
 * The bays of a surface car park along its aisles (T-352, the curator's audit of Plac Katedralny
 * §2): rows of perpendicular bays either side of each aisle the map draws in the park
 * (`service=parking_aisle`). Pattern: the layout of perpendicular bays along a manoeuvring aisle,
 * read from the map's aisles as OSM's 3D generators set out their bays; the bays 2.5 × 5 m by an
 * aisle about 6 m wide (the Polish road regulations' sizes). Where we differ from Plac Zamkowy's
 * rows: they follow the aisles the map draws, not a box at a fixed step.
 */

type Pt = readonly [number, number];

/** A bay: its middle, the way a car in it faces (yaw, as the parked cars') and the park it is in. */
export interface AisleBay {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly park: string;
}

/** A surface car park with its aisles: outline and aisles as flat world points. */
export interface AislePark {
  readonly id: string;
  readonly outline: readonly number[];
  readonly aisles: readonly (readonly number[])[];
}

/** Width of a bay along the aisle (m). */
export const BAY_PITCH = 2.5;
/** From the aisle's axis to a bay's middle (m): half the 6 m aisle and half a 5 m bay. */
export const BAY_OFF = 5.5;
/** Kept clear at an aisle's ends (m): where it turns into the next or leaves for the street. */
const END_CLEAR = 3;
/**
 * The body's reach from the bay's middle along the normal (m): half the longest car a bay takes,
 * the van (delivery trucks stay at the kerb). A van's 5 m reached 0.1 m nearer an aisle than a
 * 4.8 m bay's half (the scan's parked-car-in-aisle, podzamcze-1-1 752,489).
 */
const HALF_DEPTH = VEHICLE_SIZE.van.length / 2;
/** Room a body keeps from every aisle's axis (m): a car's half width and a hand (the curator's review of #1037). */
export const AISLE_ROOM = 1.5;
/** The nearest a bay's middle may stand to an aisle's axis (m). */
const NEAREST = HALF_DEPTH + AISLE_ROOM;

/** Distance from p to a polyline. */
const toLine = (line: readonly Pt[], px: number, pz: number): number => {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const [ax, az] = line[i]!;
    const [bx, bz] = line[i + 1]!;
    const [dx, dz] = [bx - ax, bz - az];
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(px - ax - dx * t, pz - az - dz * t));
  }
  return best;
};

/** How far along the ray from (cx, cz) by (nx, nz) it meets another aisle, within `max`; Infinity if it does not. */
const rayToAisle = (others: readonly (readonly Pt[])[], cx: number, cz: number, nx: number, nz: number, max: number): number => {
  let best = Infinity;
  for (const line of others)
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, az] = line[i]!;
      const [bx, bz] = line[i + 1]!;
      const [ex, ez] = [bx - ax, bz - az];
      const den = nx * ez - nz * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((ax - cx) * ez - (az - cz) * ex) / den;
      const u = ((ax - cx) * nz - (az - cz) * nx) / den;
      if (t > 0.5 && t < max && u >= 0 && u <= 1) best = Math.min(best, t);
    }
  return best;
};

const pairs = (flat: readonly number[]): Pt[] => Array.from({ length: flat.length / 2 }, (_, i): Pt => [flat[2 * i]!, flat[2 * i + 1]!]);

/** Every bay either side of each aisle of the parks, its middle in its park, nose to the aisle. */
export const aisleBays = (parks: readonly AislePark[]): AisleBay[] =>
  parks.flatMap((park) => {
    const ring = pairs(park.outline);
    const lines = park.aisles.map(pairs);
    return lines.flatMap((line, li) => {
      const others = lines.filter((_, k) => k !== li);
      const out: AisleBay[] = [];
      let run = 0;
      const total = line.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - line[i]![0], p[1] - line[i]![1]), 0);
      for (let i = 0; i + 1 < line.length; i++) {
        const [ax, az] = line[i]!;
        const [bx, bz] = line[i + 1]!;
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 1e-6) continue;
        const [tx, tz] = [(bx - ax) / len, (bz - az) / len];
        // From the first whole bay of the segment, on the line's own pitch so bays do not crowd at a bend.
        for (let s = (BAY_PITCH - (run % BAY_PITCH)) % BAY_PITCH + BAY_PITCH / 2; s < len; s += BAY_PITCH) {
          const along = run + s;
          if (along < END_CLEAR || along > total - END_CLEAR) continue;
          const [cx, cz] = [ax + tx * s, az + tz * s];
          for (const side of [1, -1]) {
            const [nx, nz] = [-tz * side, tx * side];
            // Between two aisles nearer than two rows' reach, one row on the line between them.
            const across = rayToAisle(others, cx, cz, nx, nz, 2 * BAY_OFF);
            const off = across < 2 * BAY_OFF ? across / 2 : BAY_OFF;
            const x = cx + nx * off;
            const z = cz + nz * off;
            if (!pointInPairRingEvenOdd(x, z, ring)) continue;
            // The body clear of every aisle's axis, its own and the others'.
            if (lines.some((l) => toLine(l, x, z) < NEAREST - 1e-6)) continue;
            // Nose to the aisle: facing back along the normal.
            out.push({ x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, yaw: Math.round(Math.atan2(-nx, -nz) * 1000) / 1000, park: park.id });
          }
        }
        run += len;
      }
      return out;
    });
  });

/** The width of a double-loaded module (m): a row of 5 m bays either side of a 6 m aisle. */
export const MODULE = 2 * BAY_OFF + 5;
/** The least room a park leaves round its modules (m): a module needs 17 m across (the backlog's item of 25.11). */
const MODULE_SLACK = 1;

/**
 * Aisles for a surface car park the map draws none in (the backlog's item of 25.11, part 2): as
 * many double-loaded modules as its outline's minimum-area rectangle holds across (rotating
 * calipers over the outline's edge directions), their aisles along its long side, the modules
 * centred across it. Pattern: the double-loaded parking module of perpendicular bays (Neufert;
 * bays 2.5 × 5 m, a 6 m aisle as in the Polish road regulations). Where we differ: the aisles are
 * not drawn, only laid out; a bay whose middle falls outside an outline that is no rectangle is
 * dropped by `aisleBays`, the rest by the parked cars' `fits`. None for a park under 17 m across.
 */
export const moduleAisles = (outline: readonly number[]): number[][] => {
  const pts = pairs(outline);
  let best: { area: number; c: number; s: number; u: [number, number]; v: [number, number] } | null = null;
  for (let i = 0; i < pts.length; i++) {
    const [a, b] = [pts[i]!, pts[(i + 1) % pts.length]!];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-6) continue;
    const [c, s] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const us = pts.map((p) => p[0] * c + p[1] * s);
    const vs = pts.map((p) => -p[0] * s + p[1] * c);
    let u: [number, number] = [Math.min(...us), Math.max(...us)];
    let v: [number, number] = [Math.min(...vs), Math.max(...vs)];
    const area = (u[1] - u[0]) * (v[1] - v[0]);
    if (best && area >= best.area) continue;
    // The aisles run along the long side: u is that side's direction.
    if (u[1] - u[0] >= v[1] - v[0]) best = { area, c, s, u, v };
    else {
      [u, v] = [v, [-u[1], -u[0]]];
      best = { area, c: -s, s: c, u, v };
    }
  }
  if (!best) return [];
  const across = best.v[1] - best.v[0];
  const k = Math.floor((across - MODULE_SLACK) / MODULE);
  if (k < 1) return [];
  const start = best.v[0] + (across - k * MODULE) / 2 + MODULE / 2;
  const { c, s } = best;
  // Back from (u, v) along the long side and across it to world (x, z).
  const world = (u: number, v: number): [number, number] => [Math.round((u * c - v * s) * 100) / 100, Math.round((u * s + v * c) * 100) / 100];
  return Array.from({ length: k }, (_, j) => {
    const v = start + j * MODULE;
    return [...world(best.u[0], v), ...world(best.u[1], v)];
  });
};
