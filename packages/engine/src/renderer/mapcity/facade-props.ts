import { prng } from "../city-kit-data";
import { type CityProps, type PropXform, addPropToSink, facing, onWall, pickProp, pointSeed, propHash } from "../city-props";
import type { MeshSink, Vec } from "../mesh-sink";
import { type FacadeFrame, type Wall, hiddenWall } from "./facade-frame";

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

/** Heights of the awnings: a sloping cloth, a flat canopy. */
const AWNING_HEIGHT = { awning: 0.5, "awning-flat": 0.28 } as const;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const uniform = (s: number) => ({ x: s, y: s, z: s });

/** The models and their places for one slot (a pipe run is several segments). */
export const placeSlot = (props: CityProps, slot: PropSlot, lite: boolean): { model: NonNullable<ReturnType<typeof pickProp>>; xf: PropXform }[] => {
  const seed = pointSeed(slot.at);
  const one = (style: string, xf: (m: NonNullable<ReturnType<typeof pickProp>>) => PropXform) => {
    const m = pickProp(props, style, seed, lite);
    return m ? [{ model: m, xf: xf(m) }] : [];
  };
  switch (slot.kind) {
    case "ac-wall":
      return one("ac-wall", (m) => onWall(m, slot.at, slot.out, uniform(clamp(0.85 / m.size.x, 0.7, 1.3))));
    case "ac-firewall":
      return one(propHash(seed, 1) % 2 === 0 && !lite ? "ac-firewall" : "ac-wall", (m) => onWall(m, slot.at, slot.out, uniform(clamp(0.9 / m.size.x, 0.7, 1.4))));
    case "ac-roof":
      return one("ac-roof", (m) => facing(slot.at, slot.out, uniform(clamp(1.5 / m.size.x, 0.8, 2))));
    case "dish":
      return one("dish", (m) => onWall(m, slot.at, slot.out, uniform(1)));
    case "dish-roof":
      return one("dish", () => facing(slot.at, slot.out, uniform(1.2)));
    case "antenna":
      return one("antenna", () => facing(slot.at, slot.out, uniform(0.9 + 0.4 * ((propHash(seed, 2) % 100) / 100))));
    case "pipe-corner":
      return one("pipe-corner", () => facing(slot.at, slot.out, uniform(1)));
    case "awning":
    case "awning-flat": {
      const w = slot.width ?? 2.5;
      const depth = slot.kind === "awning" ? 1.0 : 1.3;
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
 * Dishes on the piers between the windows of the upper floors and awnings over shop windows, by
 * the building's `clutter`: the Old Town (little clutter) and buildings with doorways or
 * passages of the game get none.
 */
export const planFacadeExtras = (f: FacadeFrame, place: PropPlacer): void => {
  const c = f.b.clutter ?? 0;
  if (c < 0.3 || (f.b.doorways?.length ?? 0) > 0 || (f.b.passages?.length ?? 0) > 0 || f.b.lifted) return;
  const rand = prng((f.b.look ^ 0x58d) >>> 0);
  const rows = Math.max(0, Math.floor((f.eave - f.b.base - f.ground) / f.storey));
  for (const w of f.walls) {
    if (w.blind || hiddenWall(f, w) || w.bay <= 0 || w.length < 3) continue;
    const bays = Math.max(1, Math.round(w.length / w.bay));
    const dishes = rows > 0 && bays > 1 ? Math.floor(c * (w.length / 14) * (0.5 + rand())) : 0;
    for (let k = 0; k < dishes; k++) {
      const u = (1 + Math.floor(rand() * (bays - 1))) * w.bay;
      const row = Math.floor(rand() * rows);
      place({ kind: "dish", at: wallPoint(w, u, f.b.base + f.ground + row * f.storey + 0.6), out: wallOut(w) });
    }
    if (!f.style.shopfront || f.ground < 3.3) continue;
    for (let i = 0; i < bays; i++) {
      if (rand() > 0.5 * c) continue;
      const width = Math.min(w.bay * 0.85, 3.6);
      if (width < 1.2) continue;
      // The top under the middle of the shop boards (ADR-0044: 0.45 m under the ground floor's top), the
      // cloth sloping out over the shop window, its edge 2 m or more over the pavement.
      const flat = f.style.tower;
      const y = f.b.base + f.ground - 0.8 - AWNING_HEIGHT[flat ? "awning-flat" : "awning"];
      place({ kind: flat ? "awning-flat" : "awning", at: wallPoint(w, (i + 0.5) * w.bay, y), out: wallOut(w), width });
    }
  }
};
