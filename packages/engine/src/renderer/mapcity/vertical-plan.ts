import { prng } from "../city-kit-data";
import { DRESS_FLAG, type MeshSink, type Rgba, type Vec, hexColor } from "../mesh-sink";
import { type FacadeFrame, trimMeta, wallMeta } from "./facade-frame";
import { band, slab, wallQuad } from "./facade-parts";
import { WINDOW_STYLE } from "./facade-style";
import { type P2, pointInRing } from "./polygon";

/**
 * The superstructures of vertical Lublin 2077 (ADR-0051) over a map building: tiers of
 * container floors, capsule flats and glass boxes stacked on the real roof, inside the real
 * outline, from `top` up to `top + rise` (the simulation's solid grows by as much), with rooftop
 * gear on the last tier: masts with warning lights, water tanks, fans, solar panels. A pure
 * function of the frame (its `look`, outline and rise): the same building always gets the same
 * stack. The tiers go into the cell's facade meshes (near and far), so they cost no draw call;
 * their windows are painted by the facade shader like the walls below.
 */

export type TierKind = "container" | "capsule" | "glass";

/** A tier: a box in the frame of the building's oriented box (u along, v across), from y0 to y1. */
export interface StackTier {
  readonly kind: TierKind;
  readonly u0: number;
  readonly u1: number;
  readonly v0: number;
  readonly v1: number;
  readonly y0: number;
  readonly y1: number;
  readonly color: string;
  /** World ring of the tier's footprint, counter-clockwise. */
  readonly ring: readonly P2[];
}

/** One storey of the superstructure (as `RISE_STOREY` in the content). */
export const STACK_STOREY = 3;

const CONTAINER = ["#8c3b2e", "#2f6f73", "#b8892a", "#4a5a6e", "#6b6f74", "#7d2e4f", "#3f6a3a"] as const;
const CAPSULE = ["#b9b5aa", "#a7aeb3", "#c8c0b0", "#9a9f96"] as const;
const GLASS = ["#2a3644", "#33404f", "#263038"] as const;
const NEON = ["#ff2e88", "#00e5ff", "#ffb000", "#b46cff", "#39ff8a"] as const;

const pick = <T>(rand: () => number, items: readonly T[]): T => items[Math.floor(rand() * items.length) % items.length] as T;

/** World point of box-frame coordinates. */
const toWorld = (f: FacadeFrame, u: number, v: number): P2 => ({ x: f.box.cx + u * f.box.ux - v * f.box.uz, z: f.box.cz + u * f.box.uz + v * f.box.ux });

const rectRing = (f: FacadeFrame, u0: number, u1: number, v0: number, v1: number): P2[] => [toWorld(f, u0, v0), toWorld(f, u1, v0), toWorld(f, u1, v1), toWorld(f, u0, v1)];

/** Distance from p to the nearest edge of a ring. */
const edgeDistance = (p: P2, ring: readonly P2[]): number => {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as P2;
    const b = ring[(i + 1) % ring.length] as P2;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t));
  }
  return best;
};

/**
 * The rectangle lies inside the ring at least `margin` from its walls: points round its edges
 * are inside and far enough, and no corner of the ring pokes into it (a notch of the outline).
 */
const inside = (ring: readonly P2[], r: readonly P2[], margin: number): boolean => {
  for (let i = 0; i < r.length; i++) {
    const p = r[i] as P2;
    const q = r[(i + 1) % r.length] as P2;
    for (const t of [0, 0.25, 0.5, 0.75]) {
      const s = { x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t };
      if (!pointInRing(s, ring) || edgeDistance(s, ring) < margin) return false;
    }
  }
  return !ring.some((v) => pointInRing(v, r));
};

/** Storeys per tier: one to three, the last tier takes what is left. */
const tierStoreys = (total: number, rand: () => number): number[] => {
  const out: number[] = [];
  let left = total;
  while (left > 0) {
    const n = Math.min(left, 1 + Math.floor(rand() * 3));
    out.push(n);
    left -= n;
  }
  return out;
};

/** Centres (shares of the half sizes) tried after the wanted one: deep plots, L-shapes, wings. */
const CENTRES: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.4, 0],
  [-0.4, 0],
  [0, 0.4],
  [0, -0.4],
  [0.4, 0.4],
  [-0.4, -0.4],
  [0.4, -0.4],
  [-0.4, 0.4],
];

/** The largest rectangle near the wanted size and centre that fits 0.9 m inside the outline. */
const fitRect = (f: FacadeFrame, su: number, sv: number, cu: number, cv: number): { u0: number; u1: number; v0: number; v1: number; ring: P2[] } | null => {
  for (let k = 0; k < 8; k++) {
    const hu = f.box.halfLong * su * 0.85 ** k;
    const hv = f.box.halfShort * sv * 0.88 ** k;
    if (hv < 1.2 || hu < 1.5) return null;
    for (const [du, dv] of [[cu, cv] as const, ...CENTRES]) {
      const mu = Math.max(-1, Math.min(1, du)) * (f.box.halfLong - hu);
      const mv = Math.max(-1, Math.min(1, dv)) * (f.box.halfShort - hv);
      const ring = rectRing(f, mu - hu, mu + hu, mv - hv, mv + hv);
      if (inside(f.b.ring, ring, 0.9)) return { u0: mu - hu, u1: mu + hu, v0: mv - hv, v1: mv + hv, ring };
    }
  }
  return null;
};

/**
 * The tiers of a building's superstructure (empty without a rise or room for one). Each tier
 * is a rectangle a little inside the outline (1 m in from the walls), shifted and resized
 * from the one under it, overhanging it at times like the cantilevered capsules of a megablock.
 */
export const stackTiers = (f: FacadeFrame): StackTier[] => {
  const rise = f.b.rise ?? 0;
  const storeys = Math.round(rise / STACK_STOREY);
  if (storeys <= 0) return [];
  if (f.box.halfShort < 2) return [];
  const rand = prng((f.b.look ^ 0x2077) >>> 0);
  const tiers: StackTier[] = [];
  let y = f.top;
  let su = 0.55 + rand() * 0.35;
  let sv = 0.6 + rand() * 0.3;
  let cu = (rand() - 0.5) * 0.3;
  let cv = (rand() - 0.5) * 0.2;
  for (const n of tierStoreys(storeys, rand)) {
    const fit = fitRect(f, su, sv, cu, cv);
    if (!fit) break;
    const { u0, u1, v0, v1, ring } = fit;
    const h = n * STACK_STOREY;
    const r = rand();
    const kind: TierKind = r < 0.45 ? "container" : r < 0.75 ? "capsule" : "glass";
    const color = kind === "container" ? pick(rand, CONTAINER) : kind === "capsule" ? pick(rand, CAPSULE) : pick(rand, GLASS);
    // The first tier starts a little into the roof, so no gap shows under it.
    tiers.push({ kind, u0, u1, v0, v1, y0: tiers.length === 0 ? y - 0.4 : y, y1: y + h, color, ring });
    y += h;
    su = Math.min(0.95, su * (0.75 + rand() * 0.45));
    sv = Math.min(0.95, sv * (0.75 + rand() * 0.4));
    cu = Math.max(-0.4, Math.min(0.4, cu + (rand() - 0.5) * 0.4));
    cv = Math.max(-0.3, Math.min(0.3, cv + (rand() - 0.5) * 0.3));
  }
  return tiers;
};

/** Window style, storey and bay the facade shader paints a tier with. */
const tierLook = (kind: TierKind): { style: number; storey: number; bay: number } =>
  kind === "container" ? { style: WINDOW_STYLE.industrial, storey: STACK_STOREY, bay: 2.4 } : kind === "capsule" ? { style: WINDOW_STYLE.block, storey: 2.5, bay: 2.1 } : { style: WINDOW_STYLE.modern, storey: STACK_STOREY, bay: 3 };

/** The walls and the top of one tier; windows from the second storey row of the shader on. */
const tierBox = (sink: MeshSink, t: StackTier, seed: number): void => {
  const look = tierLook(t.kind);
  const color = hexColor(t.color, DRESS_FLAG.solid);
  // The shader leaves its ground floor (1.25 storeys) unlit: count from below it.
  const base = t.y0 - look.storey * 1.25;
  for (let i = 0; i < t.ring.length; i++) {
    const a = t.ring[i] as P2;
    const b = t.ring[(i + 1) % t.ring.length] as P2;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.05) continue;
    const bay = len / Math.max(1, Math.round(len / look.bay));
    wallQuad(sink, a, b, { x: (b.z - a.z) / len, z: -(b.x - a.x) / len }, t.y0, t.y1, base, color, wallMeta(look.storey, bay, look.style, seed));
  }
  slab(sink, t.ring, t.y1, hexColor("#3a3d44", DRESS_FLAG.solid), trimMeta(seed));
};

const lit = (hex: string): Rgba => hexColor(hex, DRESS_FLAG.lit);

/** A mast with a warning light. */
const mast = (sink: MeshSink, p: Vec, h: number): void => {
  sink.prism(p, 0.07, h, 4, hexColor("#2b2d33"));
  sink.box({ x: p.x, y: p.y + h + 0.12, z: p.z }, 0.26, 0.26, 0.26, lit("#ff3030"));
  sink.box({ x: p.x, y: p.y + h * 0.6, z: p.z }, 1.2, 0.05, 0.05, hexColor("#2b2d33"));
};

/** A water tank on four legs. */
const tank = (sink: MeshSink, p: Vec, rand: () => number): void => {
  const r = 0.8 + rand() * 0.5;
  for (const [dx, dz] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    sink.box({ x: p.x + dx * r * 0.6, y: p.y + 0.5, z: p.z + dz * r * 0.6 }, 0.12, 1, 0.12, hexColor("#30333a"));
  }
  sink.prism({ x: p.x, y: p.y + 1, z: p.z }, r, 1.6 + rand(), 8, hexColor(rand() < 0.5 ? "#5d6670" : "#6e5a48"), true, r * 0.9);
};

/** A fan unit: a box with a dark grille on top. */
const fan = (sink: MeshSink, p: Vec, yaw: number): void => {
  sink.box({ x: p.x, y: p.y + 0.45, z: p.z }, 1.6, 0.9, 1.1, hexColor("#8d949b"), { rotY: yaw, bottom: false });
  sink.box({ x: p.x, y: p.y + 0.92, z: p.z }, 0.9, 0.04, 0.9, hexColor("#1d2025"), { rotY: yaw, bottom: false });
};

/** A row of tilted solar panels. */
const panels = (sink: MeshSink, p: Vec, yaw: number, rand: () => number): void => {
  const n = 2 + Math.floor(rand() * 3);
  for (let k = 0; k < n; k++) {
    const c = { x: p.x + Math.cos(yaw) * (k - n / 2) * 1.1, y: p.y + 0.45, z: p.z - Math.sin(yaw) * (k - n / 2) * 1.1 };
    sink.box(c, 1, 0.05, 1.6, hexColor("#1f2a44"), { rotY: yaw, tilt: 0.35, bottom: false });
  }
};

/** Rooftop gear on the top of the last tier. */
const rooftop = (sink: MeshSink, f: FacadeFrame, t: StackTier, rand: () => number): void => {
  const yaw = Math.atan2(-f.box.uz, f.box.ux);
  const at = (a: number, b: number): Vec => {
    const p = toWorld(f, t.u0 + (t.u1 - t.u0) * a, t.v0 + (t.v1 - t.v0) * b);
    return { x: p.x, y: t.y1, z: p.z };
  };
  const items = 1 + Math.floor(rand() * 3);
  for (let k = 0; k < items; k++) {
    const p = at(0.2 + rand() * 0.6, 0.2 + rand() * 0.6);
    const r = rand();
    if (r < 0.3) tank(sink, p, rand);
    else if (r < 0.6) fan(sink, p, yaw);
    else panels(sink, p, yaw, rand);
  }
  if (rand() < 0.7) mast(sink, at(rand() < 0.5 ? 0.12 : 0.88, 0.2 + rand() * 0.6), 3 + rand() * 6);
};

/** The detailed superstructure: tiers, a neon line under some tier tops, gear on the roof. */
export const planNearVertical = (sink: MeshSink, f: FacadeFrame): void => {
  const tiers = stackTiers(f);
  if (tiers.length === 0) return;
  const rand = prng((f.b.look ^ 0x7e1) >>> 0);
  for (const t of tiers) {
    tierBox(sink, t, f.style.seed);
    // A lit band round the tier's top: the edge of a capsule floor or a glass box.
    if (rand() < 0.45) band(sink, t.ring, 0.06, t.y1 - 0.32, t.y1 - 0.18, lit(pick(rand, NEON)), trimMeta(f.style.seed), t.y0);
  }
  rooftop(sink, f, tiers[tiers.length - 1] as StackTier, rand);
};

/** The far superstructure: the tiers as boxes, nothing on them. */
export const planFarVertical = (sink: MeshSink, f: FacadeFrame): void => {
  for (const t of stackTiers(f)) tierBox(sink, t, f.style.seed);
};
