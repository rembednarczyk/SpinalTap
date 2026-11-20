import { pointInRingEvenOdd } from "../../../packages/core/src";

/**
 * `stair-foot-unpaved` (the curator's review of C5, PR #793): the strip a metre deep before the
 * lowest step of a flight of the game's (the scenes' stairs, Alchemia's among them) lies on no
 * paving: bare ground or a lawn where a walker steps off the stairs. Stairs end on a pavement, a
 * square or a floor (`docs/zasady-lokacji.md` §6); a flight dropped on the earth is a set piece
 * that forgot the ground round it. The map's own steps (OSM) are not the game's and are not looked at.
 *
 * Two kinds of flight: a sloped block (`stairs` of the builders, the metro's pavilions), whose
 * low end is known, and the steps as pieces (Alchemia), whose lowest step is found by its sides:
 * the side past which the floor lies a riser lower and no other step is.
 */

type Finding = { readonly at: string; readonly what: string };
export type Pt = { readonly x: number; readonly z: number };

/** A step as a piece: its outline on the map (convex), its top and bottom. */
export interface StepQuad {
  readonly ring: readonly Pt[];
  readonly top: number;
  readonly bottom: number;
  readonly what: string;
}

/** The front of a flight's lowest step: its edge from `a` to `b`, the way off the stairs (`out`, a unit), the floor's height there. */
export interface Foot {
  readonly a: Pt;
  readonly b: Pt;
  readonly out: Pt;
  readonly y: number;
  readonly what: string;
}

/** What a floor is: a solid's or a dug floor (`floor`), the map's ground with paving or without, a lawn of the game's. */
export type FloorKind = "floor" | "paved" | "bare" | "lawn";

/** The game round its stairs, as the check reads it. */
export interface StairWorld {
  readonly steps: readonly StepQuad[];
  /** The feet of the sloped flights. */
  readonly flights: readonly Foot[];
  /** The highest floor at (x, z) with its top at most `y` (the solids, the ground), or null. The steps' solids may be among them. */
  floorAt(x: number, z: number, y: number): { readonly top: number; readonly kind: FloorKind } | null;
  /** Does a solid or the earth fill (x, z) somewhere between y0 and y1? */
  solidIn(x: number, z: number, y0: number, y1: number): boolean;
}

/** A step's top this close to another's is the same tread (a step cut in parts along its length). */
const LEVEL = 0.02;
/** A riser at the foot: lower is a seam, higher a drop off a landing (§6: 0.15-0.18 m, the slope of the paving round it). */
const RISER_MIN = 0.04;
const RISER_MAX = 0.32;
/** How far out of a side its floor is looked at (m), and over how much height above a tread a wall stops the way. */
const PROBE = 0.05;
const HEAD = 1.0;
/** The strip before the foot: a metre deep, looked at in cells of a quarter metre. */
export const STRIP = 1;
const CELL = 0.25;
/** Lower than this under the foot is a drop past the strip's edge, not its floor; higher than this over it, the ground rising off the foot is still its floor. */
const DROP = 0.5;
const RISE = 0.3;
/** A finding needs this much of the strip unpaved (m²): a corner of a lawn by a wide flight is not a flight on the earth. */
export const MIN_BARE = 0.25;

const cellKey = (i: number, k: number) => `${i}:${k}`;

/** The steps by 2 m square of their boxes. */
class StepIndex {
  private readonly bins = new Map<string, StepQuad[]>();

  constructor(steps: readonly StepQuad[]) {
    for (const s of steps) {
      const xs = s.ring.map((p) => p.x);
      const zs = s.ring.map((p) => p.z);
      for (let i = Math.floor(Math.min(...xs) / 2); i <= Math.floor(Math.max(...xs) / 2); i++) {
        for (let k = Math.floor(Math.min(...zs) / 2); k <= Math.floor(Math.max(...zs) / 2); k++) {
          const list = this.bins.get(cellKey(i, k));
          if (list) list.push(s);
          else this.bins.set(cellKey(i, k), [s]);
        }
      }
    }
  }

  at(x: number, z: number): StepQuad[] {
    return (this.bins.get(cellKey(Math.floor(x / 2), Math.floor(z / 2))) ?? []).filter((s) => pointInRingEvenOdd(x, z, s.ring));
  }
}

/** The top of the highest step at (x, z) no higher than `y`, or -Infinity. */
const stepUnder = (steps: StepIndex, x: number, z: number, y: number): number => steps.at(x, z).reduce((m, s) => (s.top <= y && s.top > m ? s.top : m), -Infinity);

/**
 * Is (x, z) out of a step with its tread at `top` a foot: no higher step nor wall nor earth there,
 * no step at its level or under it, and a floor a riser lower? The floor's top, or null.
 */
const footAt = (w: StairWorld, steps: StepIndex, x: number, z: number, top: number): number | null => {
  if (steps.at(x, z).some((s) => s.top > top + LEVEL && s.bottom < top + HEAD)) return null;
  if (w.solidIn(x, z, top + LEVEL, top + HEAD)) return null;
  const step = stepUnder(steps, x, z, top + LEVEL);
  const floor = w.floorAt(x, z, top + LEVEL);
  if (!floor || step >= floor.top - 0.01) return null;
  const drop = top - floor.top;
  return drop >= RISER_MIN && drop <= RISER_MAX ? floor.top : null;
};

/** The sides of the steps that are a flight's foot: two of three points along the side, a probe out of it, are a foot. */
export const stepFeet = (w: StairWorld, steps = new StepIndex(w.steps)): Foot[] =>
  w.steps.flatMap((s) => {
    const n = s.ring.length;
    // Counter-clockwise or not: the outward normal points away from the ring's middle.
    const mid = { x: s.ring.reduce((m, p) => m + p.x, 0) / n, z: s.ring.reduce((m, p) => m + p.z, 0) / n };
    const sides = s.ring.map((a, i) => Math.hypot(s.ring[(i + 1) % n]!.x - a.x, s.ring[(i + 1) % n]!.z - a.z));
    return s.ring.flatMap((a, i) => {
      const b = s.ring[(i + 1) % n]!;
      const len = sides[i]!;
      // A riser runs along a step's length: a side shorter than the one after it is the step's end, off which no one steps down.
      if (len < 0.1 || len < sides[(i + 1) % n]! - 1e-6) return [];
      let out = { x: (b.z - a.z) / len, z: -(b.x - a.x) / len };
      if (out.x * ((a.x + b.x) / 2 - mid.x) + out.z * ((a.z + b.z) / 2 - mid.z) < 0) out = { x: -out.x, z: -out.z };
      const floors = [0.25, 0.5, 0.75].flatMap((t) => {
        const y = footAt(w, steps, a.x + (b.x - a.x) * t + out.x * PROBE, a.z + (b.z - a.z) * t + out.z * PROBE, s.top);
        return y === null ? [] : [y];
      });
      return floors.length >= 2 ? [{ a, b, out, y: Math.max(...floors), what: s.what }] : [];
    });
  });

/**
 * Feet on one line, facing the same way at one height and touching, as one: a step cut in parts
 * along its length has a foot a part.
 */
export const mergeFeet = (feet: readonly Foot[]): Foot[] => {
  const out: Foot[] = [];
  const along = (f: Foot) => ({ x: -f.out.z, z: f.out.x });
  for (const f of feet) {
    const u = along(f);
    const same = out.findIndex((g) => {
      if (g.out.x * f.out.x + g.out.z * f.out.z < 0.999 || Math.abs(g.y - f.y) > 0.05) return false;
      // On g's line: f's ends no further than 5 cm off it, and the two spans touching.
      const off = (p: Pt) => (p.x - g.a.x) * g.out.x + (p.z - g.a.z) * g.out.z;
      if (Math.abs(off(f.a)) > 0.05 || Math.abs(off(f.b)) > 0.05) return false;
      const s = (p: Pt) => (p.x - g.a.x) * u.x + (p.z - g.a.z) * u.z;
      const [g0, g1] = [Math.min(s(g.a), s(g.b)), Math.max(s(g.a), s(g.b))];
      const [f0, f1] = [Math.min(s(f.a), s(f.b)), Math.max(s(f.a), s(f.b))];
      return f0 <= g1 + 0.3 && f1 >= g0 - 0.3;
    });
    if (same < 0) {
      out.push(f);
      continue;
    }
    const g = out[same]!;
    const s = (p: Pt) => (p.x - g.a.x) * u.x + (p.z - g.a.z) * u.z;
    const ends = [g.a, g.b, f.a, f.b].sort((p, q) => s(p) - s(q));
    out[same] = { ...g, a: ends[0]!, b: ends[3]!, y: Math.max(g.y, f.y) };
  }
  return out;
};

/** What a cell of the strip lies on: paving, no paving, or nothing to say (a wall, a kiosk, a drop past it). */
const cellOf = (w: StairWorld, steps: StepIndex, x: number, z: number, y: number): "paved" | "bare" | null => {
  const step = stepUnder(steps, x, z, y + RISE);
  const floor = w.floorAt(x, z, y + RISE);
  if (step > -Infinity && step >= (floor?.top ?? -Infinity) - 0.01) return "paved";
  if (!floor || y - floor.top > DROP || w.solidIn(x, z, floor.top + 0.05, floor.top + HEAD)) return null;
  return floor.kind === "bare" || floor.kind === "lawn" ? "bare" : "paved";
};

/** A foot's strip: its cells' middles, the area of one, and how many of them lie on paving or not. */
const stripOf = (w: StairWorld, steps: StepIndex, f: Foot): { bare: Pt[]; seen: number; cell: number } => {
  const len = Math.hypot(f.b.x - f.a.x, f.b.z - f.a.z);
  const n = Math.max(1, Math.round(len / CELL));
  const bare: Pt[] = [];
  let seen = 0;
  for (let i = 0; i < n; i++) {
    for (let d = CELL / 2; d < STRIP; d += CELL) {
      const t = (i + 0.5) / n;
      const p = { x: f.a.x + (f.b.x - f.a.x) * t + f.out.x * d, z: f.a.z + (f.b.z - f.a.z) * t + f.out.z * d };
      const c = cellOf(w, steps, p.x, p.z, f.y);
      if (c) seen++;
      if (c === "bare") bare.push(p);
    }
  }
  return { bare, seen, cell: (len / n) * CELL };
};

/** A step's going and more: the feet of one flight whose lowest step comes out of a sloping paving further at each step lie this far apart. */
const STAGGER = 0.4;

/**
 * The feet of one flight: facing the same way, at most `STAGGER` apart across their line and in
 * height, their spans touching along it (the C5 south stairs' foot steps west with the ground). Each group in
 * the order of its first foot.
 */
export const flightsOf = (feet: readonly Foot[]): Foot[][] => {
  const groups: Foot[][] = [];
  const joins = (f: Foot, g: Foot) => {
    if (f.out.x * g.out.x + f.out.z * g.out.z < 0.999 || Math.abs(f.y - g.y) > STAGGER) return false;
    const u = { x: -g.out.z, z: g.out.x };
    const off = (p: Pt) => (p.x - g.a.x) * g.out.x + (p.z - g.a.z) * g.out.z;
    const s = (p: Pt) => (p.x - g.a.x) * u.x + (p.z - g.a.z) * u.z;
    const [g0, g1] = [Math.min(0, s(g.b)), Math.max(0, s(g.b))];
    const [f0, f1] = [Math.min(s(f.a), s(f.b)), Math.max(s(f.a), s(f.b))];
    return Math.abs(off(f.a)) <= STAGGER && f0 <= g1 + 0.3 && f1 >= g0 - 0.3;
  };
  for (const f of feet) {
    const hit = groups.filter((g) => g.some((h) => joins(f, h)));
    const merged = [...hit.flat(), f];
    for (const g of hit) groups.splice(groups.indexOf(g), 1);
    groups.push(merged);
  }
  return groups;
};

/**
 * The flights whose strips hold at least `MIN_BARE` of unpaved cells: one finding a flight, at the
 * middle of its unpaved cells, with their area and share of the strips.
 */
export const stairFootUnpaved = (w: StairWorld): Finding[] => {
  const steps = new StepIndex(w.steps);
  return flightsOf(mergeFeet([...w.flights, ...stepFeet(w, steps)])).flatMap((feet) => {
    const strips = feet.map((f) => stripOf(w, steps, f));
    const bare = strips.flatMap((s) => s.bare);
    const area = strips.reduce((m, s) => m + s.bare.length * s.cell, 0);
    if (area < MIN_BARE) return [];
    const seen = strips.reduce((m, s) => m + s.seen, 0);
    const at = { x: bare.reduce((m, p) => m + p.x, 0) / bare.length, z: bare.reduce((m, p) => m + p.z, 0) / bare.length };
    const share = Math.round((100 * bare.length) / Math.max(1, seen));
    const where = feet.map((f) => `(${f.a.x.toFixed(1)}; ${f.a.z.toFixed(1)})-(${f.b.x.toFixed(1)}; ${f.b.z.toFixed(1)}) at y ${f.y.toFixed(2)}`).join(", ");
    return [{ at: `${at.x.toFixed(1)},${at.z.toFixed(1)}`, what: `${feet[0]!.what}: foot ${where}, ${area.toFixed(2)} m² (${share}%) of its strip unpaved` }];
  });
};
