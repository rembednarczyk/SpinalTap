import type { CarWheelPose } from "@seki/core";

/*
 * A close-up's wheels turning (ADR-0097 §3, "koła jako osobne siatki"): the bake keeps each wheel of a
 * car's close-up a range of vertices of its own at the end of its mesh (`tools/city_vehicle_wheels.py`).
 * Before the body is placed, each range is turned about its axle by how far the wheel has rolled, the
 * front's steered about the upright through it, and lifted by its spring's travel: the wheels move
 * on the body as a car's do, in the one mesh, with no draw call more. The axle and the radii come
 * from the range's own vertices (its box's centre and half sizes), whatever the template's turn and
 * scale; a wheel stretched to a body is turned in its own ellipse, so its outline stays.
 */

/** One wheel of a template: its vertices, the simulation's index of it (front left 0, front right 1, rear left 2, rear right 3), its axle and half sizes. */
export interface WheelPart {
  readonly first: number;
  readonly count: number;
  readonly index: number;
  readonly axle: { readonly x: number; readonly y: number; readonly z: number };
  /** Half its height and half its length: its radii seen from the side. */
  readonly ry: number;
  readonly rz: number;
}

/** The wheels of a template's vertex ranges `ranges` ([first, count] each) from its positions (front +z, left -x). */
export const wheelParts = (positions: Float32Array, ranges: readonly (readonly [number, number])[]): WheelPart[] =>
  ranges.map(([first, count]) => {
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (let v = first; v < first + count; v++) {
      for (let k = 0; k < 3; k++) {
        const p = positions[v * 3 + k] ?? 0;
        lo[k] = Math.min(lo[k]!, p);
        hi[k] = Math.max(hi[k]!, p);
      }
    }
    const axle = { x: (lo[0]! + hi[0]!) / 2, y: (lo[1]! + hi[1]!) / 2, z: (lo[2]! + hi[2]!) / 2 };
    return { first, count, index: (axle.z > 0 ? 0 : 2) + (axle.x < 0 ? 0 : 1), axle, ry: Math.max(1e-6, (hi[1]! - lo[1]!) / 2), rz: Math.max(1e-6, (hi[2]! - lo[2]!) / 2) };
  });

/**
 * The template's positions and normals with its wheels posed (into `out`), or the template's own with
 * no wheels or no poses. Rolling forward turns a wheel's top forward; steering left turns its front to
 * -x; a lift raises it.
 */
export const poseWheels = (
  src: { readonly positions: Float32Array; readonly normals: Float32Array },
  parts: readonly WheelPart[] | undefined,
  poses: readonly CarWheelPose[] | undefined,
  out: { positions: Float32Array; normals: Float32Array },
): { readonly positions: Float32Array; readonly normals: Float32Array } => {
  if (!parts || parts.length === 0 || !poses) return src;
  if (out.positions.length !== src.positions.length) {
    out.positions = new Float32Array(src.positions.length);
    out.normals = new Float32Array(src.normals.length);
  }
  out.positions.set(src.positions);
  out.normals.set(src.normals);
  for (const w of parts) {
    const pose = poses[w.index];
    if (!pose) continue;
    const a = pose.rolled / w.ry;
    const [ca, sa] = [Math.cos(a), Math.sin(a)];
    const [cs, ss] = [Math.cos(pose.steer), Math.sin(pose.steer)];
    const { x: ax, y: ay, z: az } = w.axle;
    for (let v = w.first; v < w.first + w.count; v++) {
      const o = v * 3;
      // Spun about the axle in the wheel's own ellipse, then steered about the upright through the axle.
      const u = ((src.positions[o + 1] ?? 0) - ay) / w.ry;
      const t = ((src.positions[o + 2] ?? 0) - az) / w.rz;
      const y = (u * ca - t * sa) * w.ry;
      const z = (t * ca + u * sa) * w.rz;
      const x = (src.positions[o] ?? 0) - ax;
      out.positions[o] = ax + x * cs - z * ss;
      out.positions[o + 1] = ay + y + pose.lift;
      out.positions[o + 2] = az + x * ss + z * cs;
      const nx = src.normals[o] ?? 0;
      const ny0 = src.normals[o + 1] ?? 0;
      const nz0 = src.normals[o + 2] ?? 0;
      const ny = ny0 * ca - nz0 * sa;
      const nz = nz0 * ca + ny0 * sa;
      out.normals[o] = nx * cs - nz * ss;
      out.normals[o + 1] = ny;
      out.normals[o + 2] = nx * ss + nz * cs;
    }
  }
  return out;
};
