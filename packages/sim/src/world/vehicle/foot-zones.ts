import type { Vec3 } from "@seki/core";
import { ROAD_CHAINS, surfacesAt } from "../../content/lublin/roads";
import { offend } from "../street";
import type { SimContext } from "../context";

/*
 * Cars where only feet belong (ADR-0097 §3, "ruch po Lublinie"): the deptaki of Krakowskie
 * Przedmieście and the Old Town's streets (the import's pedestrian and living streets, deliveries
 * only, `StreetUse`), the pavements, paths, steps and lawns. Driving there is possible, as in open-world
 * games where a car on the pavement scatters people and draws the police: here a stretch of it is a
 * trespass the street's witnesses report (`offend`), as any other crime.
 */

/** The ground under a car that is for feet: off any carriageway, on these. */
const FOOT_SURFACES = new Set(["sidewalk", "footway", "steps", "grass"]);
const CARRIAGEWAY = new Set(["road", "crossing"]);
/** A street's carriageway reach when the import has none (m), and the room past its edge counted on it. */
const DEFAULT_REACH = 3;
const EDGE = 0.3;
const CELL = 20;

interface Segment {
  readonly ax: number;
  readonly az: number;
  readonly bx: number;
  readonly bz: number;
  readonly reach: number;
  readonly cars: boolean;
}

let grid: Map<string, Segment[]> | null = null;
const key = (cx: number, cz: number): string => `${cx},${cz}`;

/** The streets' carriageways in cells of `CELL` m, built once. */
const segments = (): Map<string, Segment[]> => {
  if (grid) return grid;
  grid = new Map();
  for (const c of ROAD_CHAINS) {
    for (let i = 0; i + 1 < c.points.length; i++) {
      const [a, b] = [c.points[i]!, c.points[i + 1]!];
      const ends = [c.half[i]!, c.half[i + 1]!].map(([l, r]) => Math.max(l, r));
      const reach = (ends[0]! + ends[1]!) / 2 || DEFAULT_REACH;
      const s: Segment = { ax: a[0], az: a[1], bx: b[0], bz: b[1], reach, cars: c.use === "cars" };
      const pad = reach + EDGE;
      for (let cx = Math.floor((Math.min(a[0], b[0]) - pad) / CELL); cx <= Math.floor((Math.max(a[0], b[0]) + pad) / CELL); cx++) {
        for (let cz = Math.floor((Math.min(a[1], b[1]) - pad) / CELL); cz <= Math.floor((Math.max(a[1], b[1]) + pad) / CELL); cz++) {
          const k = key(cx, cz);
          const list = grid.get(k) ?? [];
          list.push(s);
          grid.set(k, list);
        }
      }
    }
  }
  return grid;
};

const distance = (s: Segment, x: number, z: number): number => {
  const [dx, dz] = [s.bx - s.ax, s.bz - s.az];
  const l = dx * dx + dz * dz;
  const t = l > 0 ? Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / l)) : 0;
  return Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t));
};

/** True where (x, z) is for feet: a deptak's or the Old Town's carriageway no car street covers, or a pavement, path, steps or lawn. */
export const footGroundAt = (x: number, z: number): boolean => {
  const surfaces = surfacesAt(x, z);
  if (surfaces.some((s) => CARRIAGEWAY.has(s))) {
    // A carriageway: a car street's is for cars; a deliveries-only street's (the deptaki) is for feet.
    let feet = false;
    for (const s of segments().get(key(Math.floor(x / CELL), Math.floor(z / CELL))) ?? []) {
      if (distance(s, x, z) > s.reach + EDGE) continue;
      if (s.cars) return false;
      feet = true;
    }
    return feet;
  }
  if (surfaces.some((s) => FOOT_SURFACES.has(s))) return true;
  // Paving off any carriageway (a square, the Old Town's cobbles): for feet on a deliveries street.
  for (const s of segments().get(key(Math.floor(x / CELL), Math.floor(z / CELL))) ?? []) {
    if (distance(s, x, z) <= s.reach + EDGE) return !s.cars;
  }
  return false;
};

/** How often the ground under her car is looked at (s), how fast counts as driving there (m/s), how long until it is a trespass (s), and the trespasses' spacing (s). */
export const FOOT_ZONE = { check: 0.25, speed: 3, after: 1.5, every: 4 } as const;

/** Her driving where feet belong, step by step: a trespass after `after` s of it, then every `every` s. */
export class FootZoneWatch {
  private since = 0;
  private time = 0;

  /** One step of `dt` s with her car at `at` going `speed` m/s; true when it made a trespass now. */
  step(ctx: SimContext, at: Vec3, speed: number, dt: number): boolean {
    this.since += dt;
    if (this.since < FOOT_ZONE.check) return false;
    const span = this.since;
    this.since = 0;
    if (speed < FOOT_ZONE.speed || !footGroundAt(at.x, at.z)) {
      this.time = Math.min(0, this.time + span);
      return false;
    }
    this.time += span;
    if (this.time < FOOT_ZONE.after) return false;
    offend(ctx, "trespass", at);
    this.time = FOOT_ZONE.after - FOOT_ZONE.every;
    return true;
  }

  /** Out of the car: it starts again. */
  reset(): void {
    this.since = 0;
    this.time = 0;
  }
}
