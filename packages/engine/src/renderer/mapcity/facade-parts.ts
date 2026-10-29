import type { MeshSink, Rgba, Vec } from "../mesh-sink";
import { type P2, offsetRing, triangulate } from "./polygon";
import { type Uv, polygon, quadUv } from "./sink-ops";

/** Building parts of the map city (ADR-0044): wall quads, bands around an outline, roof slabs. */

export const UP: Vec = { x: 0, y: 1, z: 0 };
export const DOWN: Vec = { x: 0, y: -1, z: 0 };

/** One wall quad from y0 to y1 along a..b, outward normal n, u from 0 at a. */
export const wallQuad = (sink: MeshSink, a: P2, b: P2, n: { x: number; z: number }, y0: number, y1: number, base: number, color: Rgba, meta: Uv): void => {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  quadUv(
    sink,
    [
      { x: a.x, y: y0, z: a.z },
      { x: b.x, y: y0, z: b.z },
      { x: b.x, y: y1, z: b.z },
      { x: a.x, y: y1, z: a.z },
    ],
    { x: n.x, y: 0, z: n.z },
    color,
    [
      [0, y0 - base],
      [len, y0 - base],
      [len, y1 - base],
      [0, y1 - base],
    ],
    meta,
  );
};

/**
 * A band around the outline sticking out `out` metres between y0 and y1 (cornice, string
 * course, plinth): outer faces, top and underside.
 */
export const band = (sink: MeshSink, ring: readonly P2[], out: number, y0: number, y1: number, color: Rgba, meta: Uv, base: number): void => {
  const outer = offsetRing(ring, out);
  if (!outer) return;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = outer[i] as P2;
    const b = outer[(i + 1) % n] as P2;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    wallQuad(sink, a, b, { x: (b.z - a.z) / len, z: -(b.x - a.x) / len }, y0, y1, base, color, meta);
    const ia = ring[i] as P2;
    const ib = ring[(i + 1) % n] as P2;
    const flat = (y: number, nn: Vec) =>
      quadUv(
        sink,
        [
          { x: ia.x, y, z: ia.z },
          { x: ib.x, y, z: ib.z },
          { x: b.x, y, z: b.z },
          { x: a.x, y, z: a.z },
        ],
        nn,
        color,
        [
          [0, y - base],
          [len, y - base],
          [len, y - base],
          [0, y - base],
        ],
        meta,
      );
    flat(y1, UP);
    flat(y0, DOWN);
  }
};

/** A flat roof slab over `ring` at y. */
export const slab = (sink: MeshSink, ring: readonly P2[], y: number, color: Rgba, meta: Uv): void => {
  const pts = ring.map((p) => ({ x: p.x, y, z: p.z }));
  polygon(sink, pts, triangulate(ring), UP, color, (p) => [p.x, p.z], meta);
};

