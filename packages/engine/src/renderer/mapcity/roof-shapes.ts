import type { MeshSink, Rgba, Vec } from "../mesh-sink";
import { type FacadeFrame, roofMeta, trimMeta } from "./facade-frame";
import { DOWN } from "./facade-parts";
import { type P2, centroid, obbLocal, offsetRing, triangulate } from "./polygon";
import { lathe } from "./roof-plan";
import { polygon, quadUv } from "./sink-ops";

/**
 * Roofs of the shapes the map gives (OSM `roof:shape`, ADR-0064). The pitched ones are the
 * lowest of a few planes over the outline: two for a gable, four for a half-hipped roof (the
 * gables' tops hipped), eight for a mansard (a steep and a shallow slope on every side), one for
 * a skillion. Where a plane is the lowest it is a face of the roof; where the roof stands over
 * a wall the wall goes up to it (the gable ends). Any outline works, not only rectangles. The
 * onion helmet is a surface of revolution over the middle of the outline.
 */

export type PlanesKind = "gable" | "half-hip" | "mansard" | "skillion";

/** Height over the eaves at a world point: a + gx·x + gz·z. */
interface Plane {
  readonly a: number;
  readonly gx: number;
  readonly gz: number;
}

const heightOn = (p: Plane, q: P2): number => p.a + p.gx * q.x + p.gz * q.z;
const lowest = (planes: readonly Plane[], q: P2): number => Math.min(...planes.map((p) => heightOn(p, q)));

/** Overhang of the eaves past the walls, as on the hipped roofs. */
const EAVES = 0.35;
/** How far up the gable walls of a half-hipped roof go, as a share of the rise. */
const HALF_HIP = 0.55;

/**
 * The planes of a roof of `rise` metres over `eaves`, in the frame's box: the ridge along the
 * long side, or across it (`roof:orientation=across`).
 */
export const roofPlanes = (f: FacadeFrame, kind: PlanesKind, rise: number, eaves: readonly P2[]): Plane[] => {
  const box = f.box;
  const across = f.b.roofAcross === true;
  // s along the ridge, t across it, both through the box's centre.
  const st = (q: P2): { s: number; t: number } => {
    const { u, v } = obbLocal(box, q);
    return across ? { s: v, t: u } : { s: u, t: v };
  };
  let L = 0;
  let W = 0;
  for (const q of eaves) {
    const { s, t } = st(q);
    L = Math.max(L, Math.abs(s));
    W = Math.max(W, Math.abs(t));
  }
  W = Math.max(W, 0.5);
  // A plane h = c + ks·s + kt·t in world terms.
  const sx = across ? -box.uz : box.ux;
  const sz = across ? box.ux : box.uz;
  const tx = across ? box.ux : -box.uz;
  const tz = across ? box.uz : box.ux;
  const s0 = -(box.cx * sx + box.cz * sz);
  const t0 = -(box.cx * tx + box.cz * tz);
  const plane = (c: number, ks: number, kt: number): Plane => ({ a: c + ks * s0 + kt * t0, gx: ks * sx + kt * tx, gz: ks * sz + kt * tz });
  const k = rise / W;
  switch (kind) {
    case "gable":
      return [plane(rise, 0, -k), plane(rise, 0, k)];
    case "skillion":
      return [plane(rise / 2, 0, -k / 2)];
    case "half-hip":
      return [plane(rise, 0, -k), plane(rise, 0, k), plane(k * (L + HALF_HIP * W), -k, 0), plane(k * (L + HALF_HIP * W), k, 0)];
    case "mansard": {
      // Each side: steep up to 70% of the rise over its first quarter, then shallow to the top.
      const steep = (0.7 * rise) / (0.25 * W);
      const shallow = (0.4 * rise) / W;
      return [
        ...[1, -1].flatMap((d) => [plane(steep * W, 0, -d * steep), plane(0.6 * rise + shallow * W, 0, -d * shallow)]),
        ...[1, -1].flatMap((d) => [plane(steep * L, -d * steep, 0), plane(0.6 * rise + shallow * L, -d * shallow, 0)]),
      ];
    }
  }
};

/** Sutherland-Hodgman: the part of a convex polygon where g(q) <= 0, for an affine g. */
const clip = (poly: readonly P2[], g: (q: P2) => number): P2[] => {
  const out: P2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as P2;
    const b = poly[(i + 1) % poly.length] as P2;
    const ga = g(a);
    const gb = g(b);
    if (ga <= 0) out.push(a);
    if ((ga < 0 && gb > 0) || (ga > 0 && gb < 0)) {
      const t = ga / (ga - gb);
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  return out;
};

const areaOf = (poly: readonly P2[]): number => {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as P2;
    const b = poly[(i + 1) % poly.length] as P2;
    s += a.x * b.z - b.x * a.z;
  }
  return Math.abs(s) / 2;
};

/** The faces of the roof: each triangle of the eaves cut to where each plane is the lowest. */
const faces = (sink: MeshSink, planes: readonly Plane[], eaves: readonly P2[], y0: number, base: number, color: Rgba, meta: readonly [number, number]): void => {
  const tris = triangulate(eaves);
  for (let t = 0; t + 2 < tris.length; t += 3) {
    const tri = [eaves[tris[t] as number], eaves[tris[t + 1] as number], eaves[tris[t + 2] as number]] as P2[];
    planes.forEach((p, i) => {
      let piece: P2[] = tri;
      planes.forEach((o, j) => {
        if (j !== i && piece.length >= 3) piece = clip(piece, (q) => heightOn(p, q) - heightOn(o, q));
      });
      if (piece.length < 3 || areaOf(piece) < 1e-4) return;
      const l = Math.hypot(p.gx, p.gz, 1);
      const n = { x: -p.gx / l, y: 1 / l, z: -p.gz / l };
      // Tiles in rows across the slope: u along the contour, v up the roof.
      const g = Math.hypot(p.gx, p.gz) || 1;
      const ux = p.gx === 0 && p.gz === 0 ? 1 : -p.gz / g;
      const uz = p.gx === 0 && p.gz === 0 ? 0 : p.gx / g;
      const pts = piece.map((q) => ({ x: q.x, y: y0 + heightOn(p, q), z: q.z }));
      polygon(sink, pts, piece.slice(2).map((_, k) => [0, k + 1, k + 2]).flat(), n, color, (q) => [q.x * ux + q.z * uz, q.y - base], meta);
    });
  }
};

/** Where the roof's height along a..b bends: the ends and every crossing of two planes. */
const bends = (planes: readonly Plane[], a: P2, b: P2): number[] => {
  const ts = [0, 1];
  for (let i = 0; i < planes.length; i++) {
    for (let j = i + 1; j < planes.length; j++) {
      const pi = planes[i] as Plane;
      const pj = planes[j] as Plane;
      const da = heightOn(pi, a) - heightOn(pj, a);
      const db = heightOn(pi, b) - heightOn(pj, b);
      if (da * db < 0) ts.push(da / (da - db));
    }
  }
  return ts.sort((x, y) => x - y);
};

/** Walls from the eaves up to the roof where it stands over them (the gables); low slivers under the eaves are left out. */
const gables = (sink: MeshSink, f: FacadeFrame, planes: readonly Plane[], y0: number, color: Rgba): void => {
  const meta = trimMeta(f.style.seed);
  for (const w of f.walls) {
    const ts = bends(planes, w.a, w.b);
    const at = (t: number): P2 => ({ x: w.a.x + (w.b.x - w.a.x) * t, z: w.a.z + (w.b.z - w.a.z) * t });
    const hs = ts.map((t) => Math.max(lowest(planes, at(t)), 0));
    const top = Math.max(...hs);
    if (top < 0.6 || (w.blind && w.coveredTo >= y0 + top - 0.1)) continue;
    const n = { x: w.nx, y: 0, z: w.nz };
    for (let k = 0; k + 1 < ts.length; k++) {
      const t0 = ts[k] as number;
      const t1 = ts[k + 1] as number;
      if (t1 - t0 < 1e-6) continue;
      const p0 = at(t0);
      const p1 = at(t1);
      const h0 = hs[k] as number;
      const h1 = hs[k + 1] as number;
      quadUv(sink, [
        { x: p0.x, y: y0, z: p0.z },
        { x: p1.x, y: y0, z: p1.z },
        { x: p1.x, y: y0 + h1, z: p1.z },
        { x: p0.x, y: y0 + h0, z: p0.z },
      ], n, color, [
        [t0 * w.length, y0 - f.b.base],
        [t1 * w.length, y0 - f.b.base],
        [t1 * w.length, y0 + h1 - f.b.base],
        [t0 * w.length, y0 + h0 - f.b.base],
      ], meta);
    }
  }
};

/** The underside of the overhang, from the walls out to the eaves. */
const soffits = (sink: MeshSink, f: FacadeFrame, eaves: readonly P2[], y0: number, trim: Rgba): void => {
  const ring = f.b.ring;
  for (let i = 0; i < ring.length; i++) {
    const ia = ring[i] as P2;
    const ib = ring[(i + 1) % ring.length] as P2;
    const a = eaves[i] as P2;
    const b = eaves[(i + 1) % ring.length] as P2;
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
};

/** A gabled, half-hipped, mansard or skillion roof of `rise` metres from the top of the walls. */
export const addPlanesRoof = (sink: MeshSink, f: FacadeFrame, kind: PlanesKind, rise: number, colors: { roof: Rgba; wall: Rgba; trim: Rgba }, underside = true): void => {
  const y0 = f.top - 0.08;
  const eaves = offsetRing(f.b.ring, EAVES) ?? [...f.b.ring];
  const planes = roofPlanes(f, kind, rise, eaves);
  faces(sink, planes, eaves, y0, f.b.base, colors.roof, roofMeta(f.style.seed));
  gables(sink, f, planes, y0, colors.wall);
  if (underside && eaves.length === f.b.ring.length) soffits(sink, f, eaves, y0, colors.trim);
};

/**
 * The roof's height over its eaves (`f.top - 0.08`) along the wall a..b at every bend, as
 * [share of the wall, metres]: the outline of a gable end (0 where the roof slopes off the wall).
 */
export const roofLine = (f: FacadeFrame, kind: PlanesKind, rise: number, a: P2, b: P2): [number, number][] => {
  const planes = roofPlanes(f, kind, rise, offsetRing(f.b.ring, EAVES) ?? [...f.b.ring]);
  return bends(planes, a, b).map((t) => [t, Math.max(lowest(planes, { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }), 0)]);
};

/** Distance from the centroid to the nearest wall: the radius a helmet over the outline may take. */
const inRadius = (ring: readonly P2[], c: P2): number => {
  let r = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as P2;
    const b = ring[(i + 1) % ring.length] as P2;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-6) continue;
    r = Math.min(r, Math.abs((b.x - a.x) * (a.z - c.z) - (a.x - c.x) * (b.z - a.z)) / len);
  }
  return Number.isFinite(r) ? r : 1;
};

/** The onion: a neck, a bulb a little wider than the walls, a waist, a lantern and a point (radius share, height share). */
const ONION: readonly (readonly [number, number])[] = [
  [0.8, -0.05],
  [0.95, 0.1],
  [1.05, 0.22],
  [0.95, 0.34],
  [0.6, 0.46],
  [0.22, 0.56],
  [0.14, 0.62],
  [0.14, 0.7],
  [0.26, 0.74],
  [0.24, 0.8],
  [0.08, 0.86],
  [0.03, 1],
];
/** The far cells' onion: the same outline in fewer rings. */
const ONION_FAR: readonly (readonly [number, number])[] = [
  [0.8, -0.05],
  [1.05, 0.22],
  [0.6, 0.46],
  [0.14, 0.62],
  [0.25, 0.77],
  [0.03, 1],
];

/** An onion helmet of `rise` metres over the middle of the outline, from the top of the walls. */
export const addOnion = (sink: MeshSink, f: FacadeFrame, rise: number, color: Rgba, far = false): void => {
  const c = centroid(f.b.ring);
  const r = Math.max(inRadius(f.b.ring, c), 0.5);
  const at: Vec = { x: c.x, y: f.top, z: c.z };
  const profile = (far ? ONION_FAR : ONION).map(([pr, ph]) => [r * pr, rise * ph] as const);
  lathe(sink, at, profile, far ? 8 : 16, color, roofMeta(f.style.seed));
};
