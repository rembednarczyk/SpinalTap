import type { MeshSink, Rgba } from "../../mesh-sink";
import { type FacadeFrame, type Wall, trimMeta } from "../facade-frame";
import { doorwaysOn } from "../facade-plan";
import { pointInRing } from "../polygon";
import { type Uv, quadUv } from "../sink-ops";
import { archPanel, clearOf, onWall, panel, shownWalls, slabRing } from "./kit";
import { passageAxis } from "./layer2077";
import type { LandmarkFrame } from "./landmark-frame";

/**
 * The kit's elements of an elevation drawn after the photograph (ADR-0062, T-032, T-033): the
 * octagon's gallery, battlements over a row of white panels, zendrówki in the brick, small
 * windows, battered stone buttresses and a niche with a painting. Baked in world space into the
 * cell's sink like the rest of the kit, within the data's solid (up to a cornice's depth).
 */

const UNIT: readonly [Uv, Uv, Uv, Uv] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

/** The gallery's floor over the tier's foot (on the skirt roof under it), depth, rail and the door behind it, metres. */
export const GALLERY = { floor: 0.9, depth: 0.5, rail: 0.9, door: 0.95 } as const;

/** Turn of a box whose width runs along the wall. */
export const alongWall = (w: Wall): number => Math.atan2(-(w.b.z - w.a.z), w.b.x - w.a.x);

/** A gallery along the wall at the tier's foot: a slab, balusters under a rail, and a dark door behind it. */
export const gallery = (sink: MeshSink, f: FacadeFrame, w: Wall, white: Rgba, dark: Rgba): void => {
  const rotY = alongWall(w);
  const y = f.b.foot + GALLERY.floor;
  const d = GALLERY.depth;
  const len = w.length - 0.1;
  panel(sink, w, w.length / 2 - 0.4, w.length / 2 + 0.4, y, y + GALLERY.door, 0.02, dark, trimMeta(f.style.seed));
  sink.box(onWall(w, w.length / 2, y - 0.06, d / 2), len, 0.12, d, white, { rotY });
  sink.box(onWall(w, w.length / 2, y + GALLERY.rail, d - 0.05), len, 0.08, 0.1, white, { rotY });
  for (const u of [0.1, w.length - 0.1]) sink.box(onWall(w, u, y + GALLERY.rail, d / 2), 0.08, 0.08, d, white, { rotY });
  const n = Math.max(2, Math.floor(len / 0.22));
  for (let k = 0; k <= n; k++) sink.box(onWall(w, 0.1 + ((w.length - 0.2) * k) / n, y + GALLERY.rail / 2, d - 0.05), 0.07, GALLERY.rail - 0.04, 0.07, white, { rotY, bottom: false });
};

/** Ranges along a wall clear of the parts lifted over it (`free`) and under them (`under`), by 0.25 m samples. */
export const coveredRanges = (f: LandmarkFrame, w: Wall): { free: [number, number][]; under: [number, number][] } => {
  const above = f.landmark.above ?? [];
  const out = { free: [] as [number, number][], under: [] as [number, number][] };
  const n = Math.max(1, Math.round(w.length / 0.25));
  let start = 0;
  let last = false;
  for (let k = 0; k < n; k++) {
    const p = onWall(w, ((k + 0.5) * w.length) / n, 0, -0.4);
    const under = above.some((r) => pointInRing(p, r));
    if (k > 0 && under !== last) {
      out[last ? "under" : "free"].push([start, (k * w.length) / n]);
      start = (k * w.length) / n;
    }
    last = under;
  }
  out[last ? "under" : "free"].push([start, w.length]);
  return out;
};

/** Battlements within the data's height: merlons `merlon` metres tall every `pitch` metres on the free walls, the wall going on up under a lifted part. */
export const battlements = (sink: MeshSink, f: LandmarkFrame, merlon: number, pitch: number, color: Rgba, floor: Rgba): void => {
  const meta = trimMeta(f.style.seed);
  const y0 = f.top - merlon;
  const wide = Math.min(0.9, pitch * 0.56);
  for (const w of shownWalls(f)) {
    const { free, under } = coveredRanges(f, w);
    const rotY = alongWall(w);
    for (const [u0, u1] of under) panel(sink, w, u0, u1, y0, f.top, 0, color, meta);
    for (const [u0, u1] of free) {
      const n = u1 - u0 < wide ? 0 : Math.max(1, Math.round((u1 - u0 - wide) / pitch));
      const width = n === 0 ? u1 - u0 : wide;
      for (let k = 0; k <= n; k++) sink.box(onWall(w, n === 0 ? (u0 + u1) / 2 : u0 + wide / 2 + ((u1 - u0 - wide) * k) / n, y0 + merlon / 2, -0.22), width, merlon, 0.44, color, { rotY, bottom: false });
    }
  }
  slabRing(sink, f.b.ring, y0, floor, meta);
};

/** Diagonal bands of dark headers (zendrówki) across the brick of a wall between y0 and y1, round its openings. */
export const diaper = (sink: MeshSink, f: FacadeFrame, w: Wall, y0: number, y1: number, color: Rgba): void => {
  const meta = trimMeta(f.style.seed);
  const rects: [number, number, number, number][] = clearOf(f, w, 0).map(([u0, u1]) => [u0, u1, y0, y1]);
  for (const o of f.b.doorways?.length ? doorwaysOn(w, f.b.doorways) : []) if (o.top + 0.15 < y1) rects.push([o.u0, o.u1, o.top + 0.15, y1]);
  const step = 1.5;
  const half = 0.09;
  const n = { x: w.nx, y: 0, z: w.nz };
  for (const [u0, u1, ya, yb] of rects) {
    if (u1 - u0 < 0.3 || yb - ya < 0.3) continue;
    for (const k of [1, -1]) {
      // Lines u = c + k (y - foot), c on a 1.5 m grid anchored at the wall's start and the foot.
      const cs = [u0 - k * (yb - f.b.foot), u0 - k * (ya - f.b.foot), u1 - k * (yb - f.b.foot), u1 - k * (ya - f.b.foot)];
      for (let c = Math.ceil(Math.min(...cs) / step) * step; c <= Math.max(...cs); c += step) {
        const lo = Math.max(ya, k > 0 ? f.b.foot + u0 - c : f.b.foot + c - u1);
        const hi = Math.min(yb, k > 0 ? f.b.foot + u1 - c : f.b.foot + c - u0);
        if (hi - lo < 0.2) continue;
        const at = (y: number, s: number) => onWall(w, Math.min(u1, Math.max(u0, c + k * (y - f.b.foot) + s)), y, 0.012);
        quadUv(sink, [at(lo, -half), at(lo, half), at(hi, half), at(hi, -half)], n, color, UNIT, meta);
      }
    }
  }
};

/** Heights of the small windows along a wall, as fractions of the free wall: staggered like the photograph's. */
const WINDOW_LEVELS = [0.8, 0.42, 0.62, 0.22] as const;

/** A rectangle on a wall to keep clear (the screen). */
export interface WallRect {
  readonly w: Wall;
  readonly u0: number;
  readonly u1: number;
  readonly y0: number;
  readonly y1: number;
}

/** Up to `max` small windows per shown wall (one per 3 m) between y0 and y1, framed in stone, clear of `avoid`. */
export const smallWindows = (sink: MeshSink, f: FacadeFrame, max: number, y0: number, y1: number, avoid: WallRect | null, frame: Rgba, dark: Rgba): void => {
  const meta = trimMeta(f.style.seed);
  shownWalls(f).forEach((w, i) => {
    const n = Math.min(max, Math.floor(w.length / 3));
    for (let k = 0; k < n; k++) {
      const u = (w.length * (k + 0.5)) / n;
      const y = y0 + (y1 - y0 - 1.1) * (WINDOW_LEVELS[(k + i) % WINDOW_LEVELS.length] as number) + 0.55;
      if (avoid && avoid.w === w && u + 0.7 > avoid.u0 && u - 0.7 < avoid.u1 && y + 0.9 > avoid.y0 && y - 0.9 < avoid.y1) continue;
      panel(sink, w, u - 0.38, u + 0.38, y - 0.53, y + 0.53, 0.025, frame, meta);
      panel(sink, w, u - 0.28, u + 0.28, y - 0.43, y + 0.43, 0.035, dark, meta);
    }
  });
};

/** The common part of two sorted lists of ranges. */
const intersect = (a: readonly [number, number][], b: readonly [number, number][]): [number, number][] => a.flatMap(([a0, a1]) => b.flatMap(([b0, b1]): [number, number][] => (Math.min(a1, b1) > Math.max(a0, b0) ? [[Math.max(a0, b0), Math.min(a1, b1)]] : [])));

/** A row of small white square panels at height y on the walls in `sides`, off the parts lifted over them and the openings. */
export const plaqueRow = (sink: MeshSink, f: LandmarkFrame, y: number, sides: (w: Wall) => boolean, color: Rgba): void => {
  const meta = trimMeta(f.style.seed);
  for (const w of shownWalls(f)) {
    if (!sides(w)) continue;
    for (const [u0, u1] of intersect(coveredRanges(f, w).free, clearOf(f, w, 0.3))) {
      const n = Math.floor((u1 - u0) / 1.6);
      for (let k = 0; k < n; k++) {
        const u = u0 + ((u1 - u0) * (k + 0.5)) / n;
        panel(sink, w, u - 0.16, u + 0.16, y - 0.16, y + 0.16, 0.03, color, meta);
      }
    }
  }
};

/**
 * The runs of a wall whose strip `out` metres in front of it keeps out of the passages' corridors
 * (their width and 0.15 m), by 0.1 m samples: a buttress never narrows a gate's way.
 */
export const clearOfPassages = (f: FacadeFrame, w: Wall, out: number): [number, number][] => {
  const n = Math.max(1, Math.round(w.length / 0.1));
  const runs: [number, number][] = [];
  const blocked = (u: number) =>
    (f.b.passages ?? []).some((p) => {
      const ax = passageAxis(p);
      if (!ax) return false;
      return [0, out].some((o) => {
        const q = onWall(w, u, 0, o);
        const t = (q.x - ax.o.x) * ax.u.x + (q.z - ax.o.z) * ax.u.z;
        return t > -0.5 && t < ax.length + 0.5 && Math.abs((q.x - ax.o.x) * ax.n.x + (q.z - ax.o.z) * ax.n.z) < p.width / 2 + 0.15;
      });
    });
  let start: number | null = null;
  for (let k = 0; k <= n; k++) {
    const u = (k * w.length) / n;
    const free = k < n && !blocked(u);
    if (free && start === null) start = u;
    if (!free && start !== null) {
      if (u - start > 0.3) runs.push([start, u]);
      start = null;
    }
  }
  return runs;
};

/** A battered stone buttress along a wall from u0 to u1: `depth` out at the foot, back to the wall at `height` over it. */
export const buttress = (sink: MeshSink, f: FacadeFrame, w: Wall, u0: number, u1: number, height: number, depth: number, color: Rgba): void => {
  const meta = trimMeta(f.style.seed);
  const y0 = f.b.foot - 0.2;
  const y1 = f.b.foot + height;
  const k = (depth - 0.03) / (y1 - y0);
  const l = Math.hypot(1, k);
  quadUv(sink, [onWall(w, u0, y0, depth), onWall(w, u1, y0, depth), onWall(w, u1, y1, 0.03), onWall(w, u0, y1, 0.03)], { x: w.nx / l, y: k / l, z: w.nz / l }, color, UNIT, meta);
  const dx = (w.b.x - w.a.x) / w.length;
  const dz = (w.b.z - w.a.z) / w.length;
  for (const [u, s] of [
    [u0, -1],
    [u1, 1],
  ] as const) {
    quadUv(sink, [onWall(w, u, y0, 0), onWall(w, u, y0, depth), onWall(w, u, y1, 0.03), onWall(w, u, y1, 0)], { x: dx * s, y: 0, z: dz * s }, color, UNIT, meta);
  }
};

/** A niche with a painting (the Virgin's, T-033) centred at u from y0 to y1: a stone frame, the blue picture and the figure on it. */
export const paintingNiche = (sink: MeshSink, f: FacadeFrame, w: Wall, u: number, y0: number, y1: number, frame: Rgba, picture: Rgba, figure: Rgba): void => {
  const meta = trimMeta(f.style.seed);
  const width = Math.min(0.95, (y1 - y0) * 0.7);
  archPanel(sink, w, u, width, y0, y1, 0.03, frame, meta, false);
  archPanel(sink, w, u, width - 0.22, y0 + 0.11, y1 - 0.11, 0.045, picture, meta, false);
  archPanel(sink, w, u, (width - 0.22) * 0.34, y0 + 0.2, y0 + (y1 - y0) * 0.72, 0.055, figure, meta, false);
};
