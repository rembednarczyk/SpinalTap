import type { GroundPoint, Vec3 } from "@seki/core";
import { type BoxFace, type CityKitData, type GeometrySink, hexRgb, swatchUv } from "../city-kit-data";

/*
 * Alchemia's storeys to the board 1:1 (19.11): the simulation gives each storey's slab, glass and
 * balustrade as a convex outline (`Piece.outline`, rounded corners), the engine draws them as the
 * board shows them.
 * - A slab: light concrete with a deep edge beam under it and a thick strip of light along it.
 * - Glass: no pane (the kit's glass is opaque), its frame only (`paneFrame`), the storey's real rooms
 *   seen through it (ADR-0093 O5; a lit backdrop with people and tables a room's depth inside, the
 *   "fake interior" of interior mapping, until then).
 * - A balustrade: posts and two rails along the outline's edge.
 * Pure data, no Babylon.
 */

/** The storeys' leaves and lawns (C2): the board's fresh greens, tints of the kit's paint. */
export const LEAF = hexRgb("#4f9a58");
export const LAWN = hexRgb("#5a9e4e");

type P2 = GroundPoint;

const at = (p: P2, y: number): Vec3 => ({ x: p.x, y, z: p.z });

/** A ring of quads round a counter-clockwise outline from y0 to y1, facing out; `skip` leaves out edges by index. */
export const band = (
  sink: GeometrySink,
  pts: readonly P2[],
  y0: number,
  y1: number,
  uv: readonly [number, number],
  skip?: (i: number) => boolean,
  tint?: readonly [number, number, number],
): void => {
  pts.forEach((p, i) => {
    if (skip?.(i)) return;
    const q = pts[(i + 1) % pts.length]!;
    const len = Math.hypot(q.x - p.x, q.z - p.z);
    if (len < 1e-6) return;
    const n = { x: (q.z - p.z) / len, y: 0, z: -(q.x - p.x) / len };
    sink.quad(at(p, y0), at(q, y0), at(q, y1), at(p, y1), n, uv, tint);
  });
};

/** A fan of the outline at y from its middle, facing `ny` (1 up, -1 down): a quad per two edges. */
export const lid = (sink: GeometrySink, pts: readonly P2[], y: number, ny: number, uv: readonly [number, number], tint?: readonly [number, number, number]): void => {
  const c = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, z: pts.reduce((s, p) => s + p.z, 0) / pts.length };
  const n = pts.length;
  for (let i = 0; i < n; i += 2) {
    const [p, q, r] = [pts[i]!, pts[(i + 1) % n]!, pts[(i + 2) % n]!];
    // An odd outline's last edge is a quad with its far corner doubled.
    const last = i + 1 === n ? q : r;
    if (ny > 0) sink.quad(at(c, y), at(last, y), at(q, y), at(p, y), { x: 0, y: 1, z: 0 }, uv, tint);
    else sink.quad(at(c, y), at(p, y), at(q, y), at(last, y), { x: 0, y: -1, z: 0 }, uv, tint);
  }
};

/** A convex counter-clockwise outline moved in by `d` (each edge's line moved in, neighbours met). */
export const insetConvex = (pts: readonly P2[], d: number): P2[] => {
  const n = pts.length;
  const lines = pts.map((p, i) => {
    const q = pts[(i + 1) % n]!;
    const len = Math.hypot(q.x - p.x, q.z - p.z) || 1;
    // Inwards is left of the edge.
    const nx = -(q.z - p.z) / len;
    const nz = (q.x - p.x) / len;
    return { p: { x: p.x + nx * d, z: p.z + nz * d }, dx: q.x - p.x, dz: q.z - p.z };
  });
  return lines.map((b, i) => {
    const a = lines[(i - 1 + n) % n]!;
    const den = a.dx * b.dz - a.dz * b.dx;
    if (Math.abs(den) < 1e-9) return b.p;
    const t = ((b.p.x - a.p.x) * b.dz - (b.p.z - a.p.z) * b.dx) / den;
    return { x: a.p.x + a.dx * t, z: a.p.z + a.dz * t };
  });
};

/** Faces nobody sees: a post's top and foot, a rail's ends (its neighbours' go on) and its underside. */
const UPRIGHT: ReadonlySet<BoxFace> = new Set(["+y", "-y"]);
const RAIL_HIDDEN: ReadonlySet<BoxFace> = new Set(["+x", "-x", "-y"]);

/** An oriented box along the ground direction (ux, uz) at `c`: length, height, depth. */
const post = (sink: GeometrySink, c: Vec3, ux: number, uz: number, half: readonly [number, number, number], uv: readonly [number, number], skip?: ReadonlySet<BoxFace>): void => {
  sink.box(c, [{ x: ux, y: 0, z: uz }, { x: 0, y: 1, z: 0 }, { x: -uz, y: 0, z: ux }], half, uv, undefined, skip);
};

/** The slab's edge beam under it and its strip of light (19.11: the board's slabs read thick, their light bright). */
const BEAM = 0.32;
const LED_HIGH = 0.14;
const LED_OUT = 0.05;

/**
 * A rounded slab: its prism down to the beam's foot (the room's ceiling), the light along the beam;
 * `dark` edges (a joint with the next piece of a ring of slabs, ADR-0093 O1) without it.
 */
export const slabOutline = (sink: GeometrySink, data: CityKitData, pts: readonly P2[], y0: number, y1: number, swatch: string, led: string, dark?: (i: number) => boolean): void => {
  const uv = swatchUv(data, swatch);
  band(sink, pts, y0 - BEAM, y1, uv);
  lid(sink, pts, y1, 1, uv);
  lid(sink, pts, y0 - BEAM, -1, uv);
  band(sink, insetConvex(pts, -LED_OUT), y0 - BEAM + 0.05, y0 - BEAM + 0.05 + LED_HIGH, swatchUv(data, led), dark);
};

/** A plain prism of an outline (a soffit). */
export const prismOutline = (sink: GeometrySink, data: CityKitData, pts: readonly P2[], y0: number, y1: number, swatch: string): void => {
  const uv = swatchUv(data, swatch);
  band(sink, pts, y0, y1, uv);
  lid(sink, pts, y1, 1, uv);
  lid(sink, pts, y0, -1, uv);
};

/** A mullion's side, the frame's head band. */
const MULLION = 0.09;
const TRANSOM = 0.18;

/** A balustrade's posts' pitch. */
const POST_EVERY = 2.0;

/** A piece of a balustrade (a quad whose first edge is its outer face) from `y0` up to `y1`: posts and a handrail along it. */
export const railing = (sink: GeometrySink, data: CityKitData, quad: readonly P2[], y0: number, y1: number): void => {
  const [p, q] = [quad[0]!, quad[1]!];
  const len = Math.hypot(q.x - p.x, q.z - p.z);
  if (len < 1e-6) return;
  const [ux, uz] = [(q.x - p.x) / len, (q.z - p.z) / len];
  const uv = swatchUv(data, "trim-light");
  const [nx, nz] = [-uz * 0.06, ux * 0.06];
  const mid = { x: (p.x + q.x) / 2 + nx, z: (p.z + q.z) / 2 + nz };
  post(sink, { x: mid.x, y: y1 - 0.04, z: mid.z }, ux, uz, [len / 2 + 0.02, 0.04, 0.05], uv, RAIL_HIDDEN);
  const posts = Math.max(1, Math.round(len / POST_EVERY));
  for (let k = 0; k < posts; k++) {
    const s = (k + 0.5) * (len / posts);
    post(sink, { x: p.x + ux * s + nx, y: (y0 + y1) / 2, z: p.z + uz * s + nz }, ux, uz, [0.03, (y1 - y0) / 2, 0.03], uv, UPRIGHT);
  }
};

/** A frame's pitch of mullions along the gallery's glass, its sill's and head's heights. */
const PANE_MULLION_EVERY = 2.5;
const PANE_SILL = 0.1;

/**
 * The gallery's glass (ADR-0093 O1) drawn as its frame only: the simulation's thin solid stays, but
 * the eye sees through it into the real gallery behind. A piece of it is a quad whose first edge is
 * its outer face: a sill and a head along it, a mullion at each end and every 2.5 m between.
 */
export const paneFrame = (sink: GeometrySink, data: CityKitData, quad: readonly P2[], y0: number, y1: number): void => {
  const [p, q] = [quad[0]!, quad[1]!];
  const len = Math.hypot(q.x - p.x, q.z - p.z);
  if (len < 1e-6) return;
  const [ux, uz] = [(q.x - p.x) / len, (q.z - p.z) / len];
  const uv = swatchUv(data, "trim-light");
  const [nx, nz] = [-uz * 0.06, ux * 0.06];
  const mid = { x: (p.x + q.x) / 2 + nx, z: (p.z + q.z) / 2 + nz };
  post(sink, { x: mid.x, y: y0 + PANE_SILL / 2, z: mid.z }, ux, uz, [len / 2, PANE_SILL / 2, 0.06], uv, RAIL_HIDDEN);
  post(sink, { x: mid.x, y: y1 - TRANSOM / 2, z: mid.z }, ux, uz, [len / 2, TRANSOM / 2, 0.06], uv);
  const n = Math.max(1, Math.round(len / PANE_MULLION_EVERY));
  for (let k = 0; k <= n; k++) {
    const s = (k / n) * len;
    post(sink, { x: p.x + ux * s + nx, y: (y0 + y1) / 2, z: p.z + uz * s + nz }, ux, uz, [MULLION / 2, (y1 - y0) / 2, MULLION / 2], uv, UPRIGHT);
  }
};
