import { DRESS_FLAG, type MeshSink, type Rgba, type Vec, hexColor } from "../mesh-sink";
import { face, vertex } from "./sink-ops";

/**
 * Small solids of the street furniture models (ADR-0047) on top of `MeshSink`, in a model's
 * own frame: x right, y up, z front, the foot at the origin. Smooth blobs for crowns and
 * flowers (no ink creases inside them), tubes between any two points for arms and hoops, rings.
 */

/** A painted colour and a self-lit one (vertex alpha flags of ADR-0027). */
export const paint = (hex: string): Rgba => hexColor(hex, DRESS_FLAG.solid);
export const glow = (hex: string): Rgba => hexColor(hex, DRESS_FLAG.lit);

const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a: Vec, b: Vec): Vec => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (a: Vec): Vec => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

export const v3 = (x: number, y: number, z: number): Vec => ({ x, y, z });

/** An ellipsoid with smooth normals: `segs` around, `rings` from pole to pole. */
export const blob = (sink: MeshSink, c: Vec, rx: number, ry: number, rz: number, color: Rgba, segs = 7, rings = 4): void => {
  const idx: number[][] = [];
  for (let r = 0; r <= rings; r++) {
    const phi = (r / rings) * Math.PI;
    const row: number[] = [];
    for (let s = 0; s <= segs; s++) {
      const th = (s / segs) * Math.PI * 2;
      const n = { x: Math.sin(phi) * Math.cos(th), y: Math.cos(phi), z: Math.sin(phi) * Math.sin(th) };
      row.push(vertex(sink, { x: c.x + n.x * rx, y: c.y + n.y * ry, z: c.z + n.z * rz }, norm({ x: n.x / rx, y: n.y / ry, z: n.z / rz }), color));
    }
    idx.push(row);
  }
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segs; s++) {
      const a = idx[r]![s]!;
      const b = idx[r]![s + 1]!;
      const d = idx[r + 1]![s]!;
      const e = idx[r + 1]![s + 1]!;
      const mid = norm(sub(v3(sink.positions[a * 3]!, sink.positions[a * 3 + 1]!, sink.positions[a * 3 + 2]!), c));
      if (r > 0) face(sink, a, b, e, mid);
      if (r < rings - 1) face(sink, a, e, d, mid);
    }
  }
};

/** A tube of `sides` from a to b, radius ra at a and rb at b, open ends. */
export const tube = (sink: MeshSink, a: Vec, b: Vec, ra: number, color: Rgba, sides = 6, rb = ra): void => {
  const axis = norm(sub(b, a));
  const ref = Math.abs(axis.y) > 0.9 ? v3(1, 0, 0) : v3(0, 1, 0);
  const u = norm(cross(axis, ref));
  const w = cross(axis, u);
  const ring = (p: Vec, r: number) =>
    Array.from({ length: sides }, (_, i) => {
      const t = (i / sides) * Math.PI * 2;
      const n = { x: u.x * Math.cos(t) + w.x * Math.sin(t), y: u.y * Math.cos(t) + w.y * Math.sin(t), z: u.z * Math.cos(t) + w.z * Math.sin(t) };
      return vertex(sink, { x: p.x + n.x * r, y: p.y + n.y * r, z: p.z + n.z * r }, n, color);
    });
  const ra0 = ring(a, ra);
  const rb0 = ring(b, rb);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    const t = ((i + 0.5) / sides) * Math.PI * 2;
    const n = { x: u.x * Math.cos(t) + w.x * Math.sin(t), y: u.y * Math.cos(t) + w.y * Math.sin(t), z: u.z * Math.cos(t) + w.z * Math.sin(t) };
    face(sink, ra0[i]!, ra0[j]!, rb0[j]!, n);
    face(sink, ra0[i]!, rb0[j]!, rb0[i]!, n);
  }
};

/** Tubes along a polyline (crooks, scrolls, hoops). */
export const path = (sink: MeshSink, pts: readonly Vec[], r: number, color: Rgba, sides = 5): void => {
  for (let i = 0; i + 1 < pts.length; i++) tube(sink, pts[i]!, pts[i + 1]!, r, color, sides);
};

/** Points of a circular arc in the plane of `u` (from the centre to the start) and `w`, from angle a0 to a1. */
export const arc = (c: Vec, u: Vec, w: Vec, radius: number, a0: number, a1: number, steps: number): Vec[] =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const t = a0 + ((a1 - a0) * i) / steps;
    return { x: c.x + (u.x * Math.cos(t) + w.x * Math.sin(t)) * radius, y: c.y + (u.y * Math.cos(t) + w.y * Math.sin(t)) * radius, z: c.z + (u.z * Math.cos(t) + w.z * Math.sin(t)) * radius };
  });

/** A horizontal ring (holo-rings, collars) of small boxes. */
export const ring = (sink: MeshSink, c: Vec, radius: number, thick: number, color: Rgba, segs = 12): void => {
  const pts = Array.from({ length: segs + 1 }, (_, i) => {
    const t = (i / segs) * Math.PI * 2;
    return v3(c.x + Math.cos(t) * radius, c.y, c.z + Math.sin(t) * radius);
  });
  path(sink, pts, thick, color, 4);
};

/** A four-sided pyramid on a w x d base centred at `c` (caps, roofs, the obelisk's tip). */
export const pyramid = (sink: MeshSink, c: Vec, w: number, d: number, h: number, color: Rgba): void => {
  const top = v3(c.x, c.y + h, c.z);
  const corners = [v3(c.x - w / 2, c.y, c.z - d / 2), v3(c.x + w / 2, c.y, c.z - d / 2), v3(c.x + w / 2, c.y, c.z + d / 2), v3(c.x - w / 2, c.y, c.z + d / 2)];
  for (let i = 0; i < 4; i++) {
    const a = corners[i]!;
    const b = corners[(i + 1) % 4]!;
    const n = norm(cross(sub(b, a), sub(top, a)));
    const out = n.x * (a.x + b.x - 2 * c.x) + n.z * (a.z + b.z - 2 * c.z) >= 0 ? n : { x: -n.x, y: -n.y, z: -n.z };
    const i0 = vertex(sink, a, out, color);
    const i1 = vertex(sink, b, out, color);
    const i2 = vertex(sink, top, out, color);
    face(sink, i0, i1, i2, out);
  }
};

/** A square frustum standing at `c`: w0 wide at the foot, w1 at the top, faces along x and z (the obelisk). */
export const frustum = (sink: MeshSink, c: Vec, w0: number, w1: number, h: number, color: Rgba): void => {
  const a = w0 / 2;
  const b = w1 / 2;
  const lo = (sx: number, sz: number) => v3(c.x + sx * a, c.y, c.z + sz * a);
  const hi = (sx: number, sz: number) => v3(c.x + sx * b, c.y + h, c.z + sz * b);
  const tilt = (a - b) / h;
  const sides: [number, number][] = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  for (const [nx, nz] of sides) {
    const n = norm(v3(nx, tilt, nz));
    const tx = -nz;
    const tz = nx;
    const p0 = lo(nx - tx, nz - tz);
    const p1 = lo(nx + tx, nz + tz);
    const p2 = hi(nx + tx, nz + tz);
    const p3 = hi(nx - tx, nz - tz);
    const i0 = vertex(sink, p0, n, color);
    const i1 = vertex(sink, p1, n, color);
    const i2 = vertex(sink, p2, n, color);
    const i3 = vertex(sink, p3, n, color);
    face(sink, i0, i1, i2, n);
    face(sink, i0, i2, i3, n);
  }
};

/** A box standing on the ground: centre of its foot, sizes, turn about Y. */
export const block = (sink: MeshSink, x: number, y: number, z: number, w: number, h: number, d: number, color: Rgba, rotY = 0): void => {
  sink.box(v3(x, y + h / 2, z), w, h, d, color, { rotY, bottom: false });
};
