import type { MeshSink, Rgba, Vec } from "../mesh-sink";

/**
 * Low-level writers of the map city's meshes (ADR-0044) on top of `MeshSink`: triangles with
 * their winding fixed from the normal (Babylon's front faces wind clockwise seen from the front,
 * as in `MeshSink.quad`), shared-vertex polygons and quads with explicit UVs.
 */

export type Uv = readonly [number, number];

const NO_UV: Uv = [0, 0];

/** Pushes one vertex, returns its index. */
export const vertex = (sink: MeshSink, p: Vec, n: Vec, color: Rgba, uv: Uv = NO_UV, uv2: Uv = NO_UV): number => {
  const i = sink.vertexCount;
  sink.positions.push(p.x, p.y, p.z);
  sink.normals.push(n.x, n.y, n.z);
  sink.colors.push(color[0], color[1], color[2], color[3]);
  sink.uvs.push(uv[0], uv[1]);
  sink.uvs2.push(uv2[0], uv2[1]);
  return i;
};

/** Indices of the triangle (a, b, c) wound to face along `n`. */
export const face = (sink: MeshSink, a: number, b: number, c: number, n: Vec): void => {
  const p = sink.positions;
  const ax = p[a * 3] ?? 0;
  const ay = p[a * 3 + 1] ?? 0;
  const az = p[a * 3 + 2] ?? 0;
  const e1x = (p[b * 3] ?? 0) - ax;
  const e1y = (p[b * 3 + 1] ?? 0) - ay;
  const e1z = (p[b * 3 + 2] ?? 0) - az;
  const e2x = (p[c * 3] ?? 0) - ax;
  const e2y = (p[c * 3 + 1] ?? 0) - ay;
  const e2z = (p[c * 3 + 2] ?? 0) - az;
  const cx = e1y * e2z - e1z * e2y;
  const cy = e1z * e2x - e1x * e2z;
  const cz = e1x * e2y - e1y * e2x;
  if (cx * n.x + cy * n.y + cz * n.z > 0) sink.indices.push(a, c, b);
  else sink.indices.push(a, b, c);
};

/** A quad of four corners in order around it, with explicit UVs per corner. */
export const quadUv = (sink: MeshSink, c: readonly [Vec, Vec, Vec, Vec], n: Vec, color: Rgba, uv: readonly [Uv, Uv, Uv, Uv], uv2: Uv = NO_UV): void => {
  const i0 = vertex(sink, c[0], n, color, uv[0], uv2);
  const i1 = vertex(sink, c[1], n, color, uv[1], uv2);
  const i2 = vertex(sink, c[2], n, color, uv[2], uv2);
  const i3 = vertex(sink, c[3], n, color, uv[3], uv2);
  face(sink, i0, i1, i2, n);
  face(sink, i0, i2, i3, n);
};

/** Normal of the plane through three points, flipped to point along `towards`. */
export const planeNormal = (a: Vec, b: Vec, c: Vec, towards: Vec): Vec => {
  const e1 = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const e2 = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  let n = { x: e1.y * e2.z - e1.z * e2.y, y: e1.z * e2.x - e1.x * e2.z, z: e1.x * e2.y - e1.y * e2.x };
  const l = Math.hypot(n.x, n.y, n.z) || 1;
  n = { x: n.x / l, y: n.y / l, z: n.z / l };
  return n.x * towards.x + n.y * towards.y + n.z * towards.z < 0 ? { x: -n.x, y: -n.y, z: -n.z } : n;
};

/** A flat polygon from triangle indices into `pts`, sharing its vertices, facing `n`. */
export const polygon = (sink: MeshSink, pts: readonly Vec[], tris: readonly number[], n: Vec, color: Rgba, uvOf: (p: Vec) => Uv = () => NO_UV, uv2: Uv = NO_UV): void => {
  const base = pts.map((p) => vertex(sink, p, n, color, uvOf(p), uv2));
  for (let t = 0; t + 2 < tris.length; t += 3) face(sink, base[tris[t] as number] as number, base[tris[t + 1] as number] as number, base[tris[t + 2] as number] as number, n);
};
