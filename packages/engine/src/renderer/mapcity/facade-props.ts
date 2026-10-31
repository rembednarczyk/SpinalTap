import { prng } from "../city-kit-data";
import { type CityProps, type PropXform, addPropToSink, facing, onWall, pickProp, pickUnit, pointSeed, propHash } from "../city-props";
import type { MeshSink, Vec } from "../mesh-sink";
import { type FacadeFrame, type Wall, hiddenWall } from "./facade-frame";
import { shopBoardOn } from "./sign-plan";

/**
 * Facade props of the map city (ADR-0058): the near facade plans (wall clutter, rooftop gear of
 * the superstructures, ADR-0051) offer their air conditioners, pipe runs and roof units as slots
 * instead of drawing boxes, and this module adds what had no procedural stand-in: satellite
 * dishes on the street walls, awnings over shop windows, antennas and pipe elbows on the roofs.
 * The slots are baked into the cell's near mesh, so they cost vertices, not draw calls.
 */

export type PropKind = "ac-wall" | "ac-firewall" | "ac-roof" | "pipe" | "pipe-corner" | "dish" | "dish-roof" | "antenna" | "awning" | "awning-flat";

/**
 * A spot for a prop. On a wall `at` is the wall under the middle of the prop's back (at its
 * foot) and `out` the wall's outward normal; on a roof `at` is the foot and `out` its front.
 * `width` is the run of a pipe or the width of an awning.
 */
export interface PropSlot {
  readonly kind: PropKind;
  readonly at: Vec;
  readonly out: Vec;
  readonly width?: number;
}

/** Takes a slot; true when a prop will stand there (the plan then leaves its own decor out). */
export type PropPlacer = (slot: PropSlot) => boolean;

/** A point on the wall: `u` metres from its start, at height y, on its face. */
export const wallPoint = (w: Wall, u: number, y: number): Vec => ({ x: w.a.x + ((w.b.x - w.a.x) / w.length) * u, y, z: w.a.z + ((w.b.z - w.a.z) / w.length) * u });

export const wallOut = (w: Wall): Vec => ({ x: w.nx, y: 0, z: w.nz });

/** Share of detailed air conditioners on the map's walls, which hold many (ADR-0058). */
const WALL_DETAILED = 0.25;

/** Roof gear without a procedural stand-in goes on every other roof spot. */
const onRoof = (seed: number): boolean => propHash(seed, 4) % 2 === 0;

/** Heights and depths (out of the wall) of the awnings: a sloping cloth, a flat canopy. */
const AWNING_HEIGHT = { awning: 0.4, "awning-flat": 0.28 } as const;
const AWNING_DEPTH = { awning: 1.0, "awning-flat": 1.3 } as const;

/** Gap between a shop board's bottom and an awning's top, and the least headroom under an awning. */
export const AWNING_GAP = 0.08;
/** An awning's top under the ground floor's top on a wall without a shop board. */
export const AWNING_UNDER_TOP = 0.3;
export const AWNING_HEADROOM = 2.0;

/** Street furniture standing up by a wall (a parasol's canopy, a shelter, a tree's crown): a circle on the ground. */
export interface Obstacle {
  readonly x: number;
  readonly z: number;
  readonly r: number;
}

/** The street furniture within `r` of (x, z). */
export type ObstacleQuery = (x: number, z: number, r: number) => readonly Obstacle[];

/** Does a rectangle on the wall's ground (u0..u1 along it, 0..out from it) touch an obstacle? */
export const wallRectHits = (w: Wall, u0: number, u1: number, out: number, obstacles: readonly Obstacle[]): boolean => {
  const dx = (w.b.x - w.a.x) / w.length;
  const dz = (w.b.z - w.a.z) / w.length;
  return obstacles.some((o) => {
    const u = (o.x - w.a.x) * dx + (o.z - w.a.z) * dz;
    const t = (o.x - w.a.x) * w.nx + (o.z - w.a.z) * w.nz;
    const du = Math.max(u0 - u, 0, u - u1);
    const dt = Math.max(-t, 0, t - out);
    return Math.hypot(du, dt) < o.r;
  });
};

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const uniform = (s: number) => ({ x: s, y: s, z: s });

/** The models and their places for one slot (a pipe run is several segments). */
export const placeSlot = (props: CityProps, slot: PropSlot, lite: boolean): { model: NonNullable<ReturnType<typeof pickProp>>; xf: PropXform }[] => {
  const seed = pointSeed(slot.at);
  const one = (style: string, xf: (m: NonNullable<ReturnType<typeof pickProp>>) => PropXform, detailed = 1) => {
    const m = pickUnit(props, style, seed, lite, detailed);
    return m ? [{ model: m, xf: xf(m) }] : [];
  };
  switch (slot.kind) {
    case "ac-wall":
      return one("ac-wall", (m) => onWall(m, slot.at, slot.out, uniform(clamp(0.85 / m.size.x, 0.7, 1.3))), WALL_DETAILED);
    case "ac-firewall":
      return one(propHash(seed, 1) % 2 === 0 && !lite ? "ac-firewall" : "ac-wall", (m) => onWall(m, slot.at, slot.out, uniform(clamp(0.9 / m.size.x, 0.7, 1.4))), WALL_DETAILED);
    case "ac-roof":
      return one("ac-roof", (m) => facing(slot.at, slot.out, uniform(clamp(1.5 / m.size.x, 0.8, 2))), 0.5);
    case "dish":
      return one("dish", (m) => onWall(m, slot.at, slot.out, uniform(1)));
    case "dish-roof":
      if (!onRoof(seed)) return [];
      return one("dish", () => facing(slot.at, slot.out, uniform(1.2)));
    case "antenna":
      if (!onRoof(seed)) return [];
      return one("antenna", () => facing(slot.at, slot.out, uniform(0.9 + 0.4 * ((propHash(seed, 2) % 100) / 100))));
    case "pipe-corner":
      if (!onRoof(seed)) return [];
      return one("pipe-corner", () => facing(slot.at, slot.out, uniform(1)));
    case "awning":
    case "awning-flat": {
      const w = slot.width ?? 2.5;
      const depth = AWNING_DEPTH[slot.kind];
      const h = AWNING_HEIGHT[slot.kind];
      return one(slot.kind, (m) => onWall(m, slot.at, slot.out, { x: w / m.size.x, y: h / m.size.y, z: depth / m.size.z }));
    }
    case "pipe": {
      const m = pickProp(props, "pipe", seed, lite);
      const run = slot.width ?? 2.4;
      if (!m) return [];
      // Segments of about 3 m, each with its own brackets into the wall.
      const n = Math.max(1, Math.round(run / 3));
      const along = { x: -slot.out.z, y: 0, z: slot.out.x };
      return Array.from({ length: n }, (_, k) => {
        const t = (k + 0.5) / n - 0.5;
        const at = { x: slot.at.x + along.x * t * run, y: slot.at.y, z: slot.at.z + along.z * t * run };
        return { model: m, xf: onWall(m, at, slot.out, { x: run / n / m.size.x, y: 1, z: 1 }) };
      });
    }
  }
};

/** Kinds a phone gets: the air conditioners, in their cheap versions. */
const LITE_KINDS: ReadonlySet<PropKind> = new Set(["ac-wall", "ac-firewall", "ac-roof"]);

/** Bakes the slots into a mesh. */
export const bakeSlots = (sink: MeshSink, props: CityProps, slots: readonly PropSlot[], lite: boolean): void => {
  for (const s of slots) {
    if (lite && !LITE_KINDS.has(s.kind)) continue;
    for (const p of placeSlot(props, s, lite)) addPropToSink(sink, props, p.model, p.xf);
  }
};

/**
 * Dishes on the piers between the windows of the upper floors (one per pier and storey) and
 * awnings over shop windows, by the building's `clutter`: the Old Town (little clutter) and
 * buildings with doorways or passages of the game get none. An awning hangs under the bottom of
 * the wall's shop board with 2 m of headroom, and not where street furniture stands up by the
 * wall (`obstacles`: parasols, shelters, kiosks, trees).
 */
export const planFacadeExtras = (f: FacadeFrame, place: PropPlacer, obstacles: ObstacleQuery = () => []): void => {
  const c = f.b.clutter ?? 0;
  if (c < 0.3 || (f.b.doorways?.length ?? 0) > 0 || (f.b.passages?.length ?? 0) > 0 || f.b.lifted) return;
  const rand = prng((f.b.look ^ 0x58d) >>> 0);
  const rows = Math.max(0, Math.floor((f.eave - f.b.base - f.ground) / f.storey));
  for (const w of f.walls) {
    if (w.blind || hiddenWall(f, w) || w.bay <= 0 || w.length < 3) continue;
    const bays = Math.max(1, Math.round(w.length / w.bay));
    const dishes = rows > 0 && bays > 1 ? Math.floor(c * (w.length / 14) * (0.5 + rand())) : 0;
    const taken = new Set<string>();
    for (let k = 0; k < dishes; k++) {
      const pier = 1 + Math.floor(rand() * (bays - 1));
      const row = Math.floor(rand() * rows);
      // One dish per pier and storey: a second draw of the same spot is left out.
      if (taken.has(`${pier}:${row}`)) continue;
      taken.add(`${pier}:${row}`);
      place({ kind: "dish", at: wallPoint(w, pier * w.bay, f.b.base + f.ground + row * f.storey + 0.6), out: wallOut(w) });
    }
    if (!f.style.shopfront) continue;
    const kind = f.style.tower ? "awning-flat" : "awning";
    // The top under the bottom of the wall's shop board (ADR-0044), or just under the ground floor's
    // top on a wall without one; the cloth slopes out over the shop window.
    const board = shopBoardOn(f, w);
    const top = f.b.base + f.ground - (board === null ? AWNING_UNDER_TOP : 0.45 + board / 2 + AWNING_GAP);
    const y = top - AWNING_HEIGHT[kind];
    if (y < f.b.base + AWNING_HEADROOM) continue;
    const mid = wallPoint(w, w.length / 2, 0);
    const near = obstacles(mid.x, mid.z, w.length / 2 + 6);
    for (let i = 0; i < bays; i++) {
      if (rand() > 0.5 * c) continue;
      const width = Math.min(w.bay * 0.85, 3.6);
      const u = (i + 0.5) * w.bay;
      if (width < 1.2 || wallRectHits(w, u - width / 2, u + width / 2, AWNING_DEPTH[kind] + 0.15, near)) continue;
      place({ kind, at: wallPoint(w, u, y), out: wallOut(w), width });
    }
  }
};
