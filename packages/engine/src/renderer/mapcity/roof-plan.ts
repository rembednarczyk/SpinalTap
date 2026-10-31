import { prng } from "../city-kit-data";
import type { MeshSink, Rgba, Vec } from "../mesh-sink";
import { type FacadeFrame, type Palette, roofMeta, trimMeta, wallMeta } from "./facade-frame";
import { DOWN, band, slab, wallQuad } from "./facade-parts";
import { WINDOW_STYLE } from "./facade-style";
import { type P2, centroid, offsetRing, perimeter, pointInRing, signedArea } from "./polygon";
import { type Uv, planeNormal, quadUv } from "./sink-ops";

/**
 * Roofs and towers of the map buildings (ADR-0044): hipped roofs over any outline (the outline
 * inset towards a ridge, a pyramid when it is too narrow), domes on a drum with a lantern, and
 * church towers with a spire or a baroque helmet.
 */

/** A surface of revolution around (c, y): profile of [radius, height above y] from the bottom up. */
export const lathe = (sink: MeshSink, c: Vec, profile: readonly (readonly [number, number])[], sides: number, color: Rgba, meta: Uv): void => {
  for (let k = 0; k + 1 < profile.length; k++) {
    const [r0, h0] = profile[k] as readonly [number, number];
    const [r1, h1] = profile[k + 1] as readonly [number, number];
    for (let j = 0; j < sides; j++) {
      const a0 = (j / sides) * Math.PI * 2;
      const a1 = ((j + 1) / sides) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const p = (r: number, h: number, a: number): Vec => ({ x: c.x + Math.cos(a) * r, y: c.y + h, z: c.z + Math.sin(a) * r });
      const corners = [p(r0, h0, a0), p(r0, h0, a1), p(r1, h1, a1), p(r1, h1, a0)] as const;
      // Slope of the profile: the normal leans up where the radius shrinks.
      const dr = r1 - r0;
      const dh = h1 - h0;
      const l = Math.hypot(dr, dh) || 1;
      const n = { x: Math.cos(am) * (dh / l), y: -dr / l, z: Math.sin(am) * (dh / l) };
      quadUv(sink, corners, n, color, [
        [0, h0],
        [1, h0],
        [1, h1],
        [0, h1],
      ], meta);
    }
  }
};

/**
 * Hipped roof from the eaves at the top of the walls up `rise` metres, with a small overhang;
 * `underside` closes the overhang from below (the far cells leave it open: no one sees it).
 */
export const addHipRoof = (sink: MeshSink, f: FacadeFrame, rise: number, roofColor: Rgba, trim: Rgba, underside = true): void => {
  const ring = f.b.ring;
  const y0 = f.top - 0.08;
  const eaves = offsetRing(ring, 0.35) ?? [...ring];
  const area = Math.abs(signedArea(ring));
  let d = Math.min(rise / 0.84 + 0.35, (1.15 * area) / Math.max(perimeter(ring), 1));
  let ridge: P2[] | null = null;
  // An inset of an odd outline can fold out past it (a spike): only one that stays inside will do.
  const within = (r: readonly P2[] | null): r is P2[] => r !== null && r.every((p) => pointInRing(p, ring));
  for (let k = 0; k < 5 && !ridge && d - 0.35 > 0.2; k++) {
    const inset = offsetRing(ring, -(d - 0.35));
    ridge = within(inset) ? inset : null;
    d *= 0.7;
  }
  const apex = centroid(ring);
  if (!ridge && !pointInRing(apex, ring)) {
    slab(sink, ring, f.top, roofColor, roofMeta(f.style.seed));
    return;
  }
  const meta = roofMeta(f.style.seed);
  const y1 = y0 + rise;
  for (let i = 0; i < ring.length; i++) {
    const a = eaves[i] as P2;
    const b = eaves[(i + 1) % ring.length] as P2;
    const ra = ridge ? (ridge[i] as P2) : apex;
    const rb = ridge ? (ridge[(i + 1) % ring.length] as P2) : apex;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const out = { x: (b.z - a.z) / len, y: 0.8, z: -(b.x - a.x) / len };
    const c = [
      { x: a.x, y: y0, z: a.z },
      { x: b.x, y: y0, z: b.z },
      { x: rb.x, y: y1, z: rb.z },
      { x: ra.x, y: y1, z: ra.z },
    ] as const;
    const n = planeNormal(c[0], c[1], c[3].x === c[2].x && c[3].z === c[2].z ? c[2] : c[3], out);
    quadUv(sink, c, n, roofColor, [
      [0, y0 - f.b.base],
      [len, y0 - f.b.base],
      [len, y1 - f.b.base],
      [0, y1 - f.b.base],
    ], meta);
    if (!underside) continue;
    // Soffit under the overhang.
    const ia = ring[i] as P2;
    const ib = ring[(i + 1) % ring.length] as P2;
    quadUv(sink, [
      { x: ia.x, y: y0, z: ia.z },
      { x: ib.x, y: y0, z: ib.z },
      { x: b.x, y: y0, z: b.z },
      { x: a.x, y: y0, z: a.z },
    ], DOWN, trim, [
      [0, 0],
      [1, 0],
      [1, 0],
      [0, 0],
    ], trimMeta(f.style.seed));
  }
  if (ridge) slab(sink, ridge, y1, roofColor, meta);
};

/** A dome on a drum over the middle of a compact plan, with a lantern and a finial. */
export const addDome = (sink: MeshSink, f: FacadeFrame, rise: number, roofColor: Rgba, wall: Rgba): void => {
  const r = Math.max(2, Math.min(f.box.halfShort, f.box.halfLong) * 0.72);
  const c = { x: f.box.cx, y: f.top, z: f.box.cz };
  const drum = Math.min(rise * 0.25, 4);
  const meta = roofMeta(f.style.seed);
  lathe(sink, c, [
    [r, -0.2],
    [r, drum],
  ], 16, wall, wallMeta(drum * 0.8, (2 * Math.PI * r) / 16, WINDOW_STYLE.civic, f.style.seed));
  const shell: [number, number][] = [];
  const h = rise - drum;
  for (let k = 0; k <= 6; k++) {
    const phi = (k / 6) * (Math.PI / 2);
    shell.push([r * 1.02 * Math.cos(phi) + 0.001, drum + h * 0.72 * Math.sin(phi)]);
  }
  lathe(sink, c, shell, 16, roofColor, meta);
  const lt = drum + h * 0.72;
  lathe(sink, c, [
    [r * 0.17, lt - 0.1],
    [r * 0.17, lt + h * 0.14],
    [r * 0.21, lt + h * 0.14],
    [0.02, lt + h * 0.32],
  ], 8, roofColor, meta);
};

/** Square plan points of a tower around (cu, cv) in the frame's box. */
const towerRing = (f: FacadeFrame, cu: number, cv: number, half: number): P2[] => {
  const { cx, cz, ux, uz } = f.box;
  const at = (u: number, v: number): P2 => ({ x: cx + u * ux - v * uz, z: cz + u * uz + v * ux });
  return [at(cu - half, cv - half), at(cu + half, cv - half), at(cu + half, cv + half), at(cu - half, cv + half)];
};

/** Where the towers of a church stand: at its west end (the facade), one or two across. */
export const towerSpots = (f: FacadeFrame): { readonly u: number; readonly v: number; readonly half: number; readonly height: number }[] => {
  const box = f.box;
  const half = Math.min(Math.max(box.halfShort * 0.42, 2), 4.5);
  const westward = Math.abs(box.ux) > 0.3 ? (box.ux > 0 ? -1 : 1) : box.uz > 0 ? -1 : 1;
  const u = westward * Math.max(box.halfLong - half - 0.3, 0);
  const height = Math.min(Math.max(f.b.height * 1.7, f.b.height + 12), 65);
  if (box.halfShort * 2 > 22) {
    const v = box.halfShort - half - 0.3;
    return [
      { u, v, half, height },
      { u, v: -v, half, height },
    ];
  }
  return [{ u, v: 0, half, height }];
};

const spire = (sink: MeshSink, ring: readonly P2[], y: number, h: number, color: Rgba, meta: Uv): void => {
  const c = centroid(ring);
  const apex = { x: c.x, y: y + h, z: c.z };
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as P2;
    const b = ring[(i + 1) % ring.length] as P2;
    const pa = { x: a.x, y, z: a.z };
    const pb = { x: b.x, y, z: b.z };
    const n = planeNormal(pa, pb, apex, { x: (a.x + b.x) / 2 - c.x, y: 0.3, z: (a.z + b.z) / 2 - c.z });
    quadUv(sink, [pa, pb, apex, apex], n, color, [
      [0, 0],
      [1, 0],
      [0.5, h],
      [0.5, h],
    ], meta);
  }
};

/** Bell towers: walls with belfry windows, a cornice and a spire or a baroque helmet. */
export const addTowers = (sink: MeshSink, f: FacadeFrame, p: Palette, near: boolean): void => {
  // A lifted part of a church (its nave or a chapel, G-049) stands on the church: the towers are the church's.
  if (f.b.lifted) return;
  const rand = prng((f.b.look ^ 0x70e4) >>> 0);
  const helmet = rand() < 0.5;
  for (const t of towerSpots(f)) {
    const ring = towerRing(f, t.u, t.v, t.half);
    const top = f.b.base + t.height;
    const meta = wallMeta(4.6, t.half, WINDOW_STYLE.civic, f.style.seed);
    for (let i = 0; i < 4; i++) {
      const a = ring[i] as P2;
      const b = ring[(i + 1) % 4] as P2;
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      wallQuad(sink, a, b, { x: (b.z - a.z) / len, z: -(b.x - a.x) / len }, f.b.foot - 0.2, top, f.b.base, p.wall, meta);
    }
    const roofMetaT = roofMeta(f.style.seed);
    if (!near) {
      spire(sink, ring, top, t.half * 3, p.roof, roofMetaT);
      continue;
    }
    const trim = trimMeta(f.style.seed);
    band(sink, ring, 0.3, top - 0.6, top, p.trim, trim, f.b.base);
    band(sink, ring, 0.15, f.top - 0.4, f.top, p.trim, trim, f.b.base);
    if (helmet) {
      const c = centroid(ring);
      const r = t.half * 1.05;
      const s = t.half * 2;
      lathe(sink, { x: c.x, y: top, z: c.z }, [
        [r, 0],
        [r * 1.12, s * 0.35],
        [r * 0.55, s * 0.85],
        [r * 0.28, s * 1.0],
        [r * 0.28, s * 1.35],
        [r * 0.45, s * 1.55],
        [r * 0.12, s * 1.9],
        [0.03, s * 2.6],
      ], 8, p.roof, roofMetaT);
    } else {
      spire(sink, ring, top, t.half * 4.2, p.roof, roofMetaT);
    }
  }
};
