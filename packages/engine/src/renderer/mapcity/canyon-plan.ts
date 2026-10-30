import { prng } from "../city-kit-data";
import { DRESS_FLAG, type MeshSink, type Rgba, type Vec, hexColor } from "../mesh-sink";
import { type FacadeFrame, type Wall, trimMeta, wallMeta } from "./facade-frame";
import { DOWN, slab, wallQuad } from "./facade-parts";
import { WINDOW_STYLE } from "./facade-style";
import type { P2 } from "./polygon";
import { quadUv } from "./sink-ops";

/**
 * The layer over the streets of vertical Lublin 2077 (ADR-0051): what hangs between a building
 * and the one across the street. A span is found by walking out from the middle of a street wall
 * along its normal until another building's outline; each pair of buildings gets its spans once
 * (from the one with the lower id), and only when both carry some clutter, so the landmarks and
 * the Rynek stay clean. From the spans come:
 * - near: sagging cables with strings of lanterns, the frames of billboards hung over the
 *   street, and at a few places a narrow glazed footbridge two to four storeys up;
 * - far: the footbridges only;
 * - signs (`canyon-signs.ts`): neon curtains, billboard faces, their light beams and mist.
 * Pure functions of the frames: no randomness but the buildings' `look`.
 */

/** Another building's outline at a point: its id, the top of its walls and its clutter. */
export interface Across {
  readonly id: number;
  readonly top: number;
  readonly clutter: number;
}

export type AcrossAt = (x: number, z: number, self: number) => Across | null;

export interface Span {
  /** On this building's wall. */
  readonly a: P2;
  /** On the other building's wall. */
  readonly b: P2;
  /** Unit vector along the street (along the wall at `a`). */
  readonly along: P2;
  readonly width: number;
  /** Street level (this building's ground floor) and the lower of the two tops. */
  readonly base: number;
  readonly top: number;
  readonly clutter: number;
  /** The first span of a wall: billboards and footbridges go only there. */
  readonly main: boolean;
  readonly seed: number;
}

/** Narrowest and widest street a span crosses, metres. */
export const SPAN_MIN = 5;
export const SPAN_MAX = 34;
/** Share of main spans over a busy street that get a footbridge (a few in the whole city). */
const FOOTBRIDGE_CHANCE = 0.12;

const along = (w: Wall): P2 => ({ x: (w.b.x - w.a.x) / w.length, z: (w.b.z - w.a.z) / w.length });

/** The spans from one building's street walls to the buildings across. */
export const findSpans = (f: FacadeFrame, across: AcrossAt): Span[] => {
  const own = f.b.clutter ?? 0;
  if (own <= 0) return [];
  const rand = prng((f.b.look ^ 0xca7) >>> 0);
  const out: Span[] = [];
  for (const w of f.walls) {
    if (w.blind || w.length < SPAN_MIN) continue;
    const ts = w.length >= 18 ? [0.5, 0.2, 0.8] : [0.5];
    ts.forEach((t, k) => {
      const a = { x: w.a.x + (w.b.x - w.a.x) * t, z: w.a.z + (w.b.z - w.a.z) * t };
      for (let d = 1; d <= SPAN_MAX; d++) {
        const hit = across(a.x + w.nx * d, a.z + w.nz * d, f.b.id);
        if (!hit) continue;
        if (hit.id > f.b.id && hit.clutter > 0 && d >= SPAN_MIN) {
          // The other wall lies within the last metre: halve towards it.
          let lo = d - 1;
          let hi = d;
          for (let i = 0; i < 4; i++) {
            const mid = (lo + hi) / 2;
            if (across(a.x + w.nx * mid, a.z + w.nz * mid, f.b.id)) hi = mid;
            else lo = mid;
          }
          out.push({ a, b: { x: a.x + w.nx * hi, z: a.z + w.nz * hi }, along: along(w), width: hi, base: f.b.base, top: Math.min(f.top, hit.top), clutter: (own + hit.clutter) / 2, main: k === 0, seed: rand() });
        }
        break;
      }
    });
  }
  return out;
};

const DARK: Rgba = hexColor("#15161b");
const LANTERNS = ["#ff2e88", "#00e5ff", "#ffb000", "#ff4040", "#b46cff"] as const;

const lerp = (a: Vec, b: Vec, t: number, sag: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * sag, z: a.z + (b.z - a.z) * t });

/** A sagging cable as ribbons: an upright one, both faces, and one facing down to the street. */
export const cable = (sink: MeshSink, a: Vec, b: Vec, sag: number, color: Rgba, thick = 0.05): void => {
  const segments = 6;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  // Across the cable, horizontal.
  const sx = (-dz / len) * thick * 0.5;
  const sz = (dx / len) * thick * 0.5;
  const meta = trimMeta(0.5);
  for (let i = 0; i < segments; i++) {
    const p = lerp(a, b, i / segments, sag);
    const q = lerp(a, b, (i + 1) / segments, sag);
    const up = { x: p.x, y: p.y + thick / 2, z: p.z };
    const n = { x: -dz / len, y: 0, z: dx / len };
    const upright: [Vec, Vec, Vec, Vec] = [
      { x: p.x, y: p.y - thick / 2, z: p.z },
      { x: q.x, y: q.y - thick / 2, z: q.z },
      { x: q.x, y: q.y + thick / 2, z: q.z },
      up,
    ];
    quadUv(sink, upright, n, color, [[0, 0], [1, 0], [1, 0], [0, 0]], meta);
    quadUv(sink, upright, { x: -n.x, y: 0, z: -n.z }, color, [[0, 0], [1, 0], [1, 0], [0, 0]], meta);
    quadUv(
      sink,
      [
        { x: p.x - sx, y: p.y, z: p.z - sz },
        { x: q.x - sx, y: q.y, z: q.z - sz },
        { x: q.x + sx, y: q.y, z: q.z + sz },
        { x: p.x + sx, y: p.y, z: p.z + sz },
      ],
      DOWN,
      color,
      [[0, 0], [1, 0], [1, 0], [0, 0]],
      meta,
    );
  }
};

/** Cables across one span at different heights and angles, some strung with lanterns. */
const spanCables = (sink: MeshSink, s: Span, rand: () => number, lite: boolean): void => {
  const count = Math.round(s.clutter * (lite ? 1.5 : 5) * (0.5 + rand()));
  const low = s.base + 4.5;
  const high = s.top - 1;
  if (high <= low) return;
  for (let k = 0; k < count; k++) {
    const y = low + rand() * (high - low);
    const o1 = (rand() - 0.5) * 6;
    const o2 = o1 + (rand() - 0.5) * 5;
    const a = { x: s.a.x + s.along.x * o1, y, z: s.a.z + s.along.z * o1 };
    const b = { x: s.b.x + s.along.x * o2, y: y + (rand() - 0.5) * 2.5, z: s.b.z + s.along.z * o2 };
    const sag = 0.25 + rand() * 0.05 * s.width;
    cable(sink, a, b, sag, DARK);
    if (lite || rand() > s.clutter * 0.6) continue;
    const color = hexColor(LANTERNS[Math.floor(rand() * LANTERNS.length)] ?? "#ffb000", DRESS_FLAG.lit);
    const n = Math.max(3, Math.floor(s.width / 1.6));
    for (let i = 1; i < n; i++) {
      const p = lerp(a, b, i / n, sag);
      sink.box({ x: p.x, y: p.y - 0.2, z: p.z }, 0.2, 0.26, 0.2, color, { bottom: true });
    }
  }
};

/** The suspension and frame of a billboard hung over the street (its face is in the signs). */
export interface Billboard {
  readonly c: Vec;
  /** Unit normal of its face, along the street. */
  readonly n: P2;
  readonly w: number;
  readonly h: number;
  readonly cell: number;
  readonly color: string;
}

/** The billboard of a main span over a busy street, or null. */
export const spanBillboard = (s: Span): Billboard | null => {
  const rand = prng(Math.floor(s.seed * 0xfffffff) ^ 0xb111);
  if (!s.main || s.clutter < 0.5 || rand() > 0.35 || s.width < 8 || s.width > 30) return null;
  const w = Math.min(s.width * 0.55, 10);
  const h = w / 2;
  const top = Math.min(s.top - 1, s.base + 11 + rand() * 5);
  if (top - h < s.base + 5) return null;
  const c = { x: (s.a.x + s.b.x) / 2, y: top - h / 2, z: (s.a.z + s.b.z) / 2 };
  return { c, n: s.along, w, h, cell: Math.floor(rand() * 4), color: LANTERNS[Math.floor(rand() * LANTERNS.length)] ?? "#00e5ff" };
};

const billboardFrame = (sink: MeshSink, s: Span, bb: Billboard): void => {
  // Thin along the street: the box's local z is the face normal.
  const yaw = Math.atan2(bb.n.x, bb.n.z);
  sink.box(bb.c, bb.w + 0.3, bb.h + 0.3, 0.16, DARK, { rotY: yaw });
  // Hung from both walls.
  const across = { x: (s.b.x - s.a.x) / s.width, z: (s.b.z - s.a.z) / s.width };
  for (const side of [-1, 1]) {
    const corner = { x: bb.c.x + across.x * side * (bb.w / 2), y: bb.c.y + bb.h / 2, z: bb.c.z + across.z * side * (bb.w / 2) };
    const wall = side < 0 ? s.a : s.b;
    cable(sink, corner, { x: wall.x, y: corner.y + 2.5, z: wall.z }, 0.05, DARK, 0.07);
  }
};

/** A footbridge over a main span, or null: a few in the city, two to four storeys up. */
export const spanFootbridge = (s: Span): { y: number; ring: P2[] } | null => {
  const rand = prng(Math.floor(s.seed * 0xfffffff) ^ 0xf00b);
  if (!s.main || s.clutter < 0.6 || s.width < 7 || s.width > 24 || rand() > FOOTBRIDGE_CHANCE) return null;
  // Two to four storeys up (the second storey starts some 6 m over the street), under both cornices.
  const y = Math.min(s.base + 6 + rand() * 5, s.top - 3.2);
  if (y < s.base + 5.5) return null;
  const hw = 1.3;
  const ring = [
    { x: s.a.x - s.along.x * hw, z: s.a.z - s.along.z * hw },
    { x: s.a.x + s.along.x * hw, z: s.a.z + s.along.z * hw },
    { x: s.b.x + s.along.x * hw, z: s.b.z + s.along.z * hw },
    { x: s.b.x - s.along.x * hw, z: s.b.z - s.along.z * hw },
  ];
  // Counter-clockwise on the map (its walls face out).
  const area = ring.reduce((sum, p, i) => sum + p.x * (ring[(i + 1) % 4] as P2).z - (ring[(i + 1) % 4] as P2).x * p.z, 0);
  return { y, ring: area < 0 ? ring.reverse() : ring };
};

/** The glazed box of a footbridge with a lit strip under it. */
const footbridge = (sink: MeshSink, fb: { y: number; ring: P2[] }, seed: number): void => {
  const color = hexColor("#3b4350");
  const h = 2.8;
  for (let i = 0; i < 4; i++) {
    const a = fb.ring[i] as P2;
    const b = fb.ring[(i + 1) % 4] as P2;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.05) continue;
    const bay = len / Math.max(1, Math.round(len / 2.2));
    wallQuad(sink, a, b, { x: (b.z - a.z) / len, z: -(b.x - a.x) / len }, fb.y, fb.y + h, fb.y - h * 1.25, color, wallMeta(h, bay, WINDOW_STYLE.modern, seed));
  }
  slab(sink, fb.ring, fb.y + h, hexColor("#2a2d33"), trimMeta(seed));
  const under = fb.ring.map((p) => ({ x: p.x, y: fb.y, z: p.z }));
  quadUv(sink, [under[0] as Vec, under[1] as Vec, under[2] as Vec, under[3] as Vec], DOWN, hexColor("#5ce1ff", DRESS_FLAG.lit), [[0, 0], [1, 0], [1, 1], [0, 1]], trimMeta(seed));
};

/** Near geometry over the streets from a cell's spans. `lite` (a phone): fewer cables, no lanterns. */
export const planNearCanyon = (sink: MeshSink, spans: readonly Span[], lite: boolean): void => {
  for (const s of spans) {
    const rand = prng(Math.floor(s.seed * 0xfffffff) ^ 0xc0de);
    spanCables(sink, s, rand, lite);
    const bb = spanBillboard(s);
    if (bb) billboardFrame(sink, s, bb);
    const fb = spanFootbridge(s);
    if (fb) footbridge(sink, fb, s.seed);
  }
};

/** Far geometry over the streets: the footbridges. */
export const planFarCanyon = (sink: MeshSink, spans: readonly Span[]): void => {
  for (const s of spans) {
    const fb = spanFootbridge(s);
    if (fb) footbridge(sink, fb, s.seed);
  }
};
