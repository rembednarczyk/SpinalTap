/**
 * The car's frame (ADR-0097 §2a): the one module that turns between the simulation's world (y up,
 * heading `yaw = atan2(dx, dz)`, the front at heading 0 is +z) and the body's own frame (y up, z
 * forward, x to the driver's right), and that crosses vectors and turns them. No other file of the
 * vehicle turns a sign on its own.
 *
 * Conventions: a positive steer turns the car left (its heading falls); a positive pitch is the
 * nose down; a positive roll puts the body over to its right side. Rotations are unit quaternions
 * (w, x, y, z) in the usual algebra: q' = ½ ω ⊗ q for an angular velocity ω in the world.
 */
export interface V3 {
  x: number;
  y: number;
  z: number;
}

export interface Quat {
  w: number;
  x: number;
  y: number;
  z: number;
}

export const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z });
export const add = (a: V3, b: V3): V3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: V3, b: V3): V3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: V3, k: number): V3 => v3(a.x * k, a.y * k, a.z * k);
export const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: V3, b: V3): V3 => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const length = (a: V3): number => Math.hypot(a.x, a.y, a.z);
export const normalize = (a: V3): V3 => {
  const l = length(a);
  return l > 1e-12 ? scale(a, 1 / l) : v3(0, 1, 0);
};

/** The rotation of a heading `yaw` about the world's y. */
export const fromYaw = (yaw: number): Quat => ({ w: Math.cos(yaw / 2), x: 0, y: Math.sin(yaw / 2), z: 0 });

export const qmul = (a: Quat, b: Quat): Quat => ({
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
});

export const qnormalize = (q: Quat): Quat => {
  const l = Math.hypot(q.w, q.x, q.y, q.z) || 1;
  return { w: q.w / l, x: q.x / l, y: q.y / l, z: q.z / l };
};

/** A body-frame vector in the world. */
export const toWorld = (q: Quat, v: V3): V3 => {
  // v + 2 u × (u × v + w v), u the quaternion's vector part.
  const u = v3(q.x, q.y, q.z);
  const t = scale(cross(u, v), 2);
  return add(add(v, scale(t, q.w)), cross(u, t));
};

/** A world vector in the body's frame. */
export const toBody = (q: Quat, v: V3): V3 => toWorld({ w: q.w, x: -q.x, y: -q.y, z: -q.z }, v);

/** Turns `q` by the world angular velocity `w` over `dt` (first order, renormalized). */
export const integrate = (q: Quat, w: V3, dt: number): Quat => {
  const d = qmul({ w: 0, x: w.x, y: w.y, z: w.z }, q);
  return qnormalize({ w: q.w + 0.5 * dt * d.w, x: q.x + 0.5 * dt * d.x, y: q.y + 0.5 * dt * d.y, z: q.z + 0.5 * dt * d.z });
};

export const FORWARD = v3(0, 0, 1);
export const RIGHT = v3(1, 0, 0);
export const UP = v3(0, 1, 0);

/** Heading, pitch (nose down positive) and roll (over to the right positive) of a rotation. */
export const attitude = (q: Quat): { yaw: number; pitch: number; roll: number } => {
  const f = toWorld(q, FORWARD);
  const r = toWorld(q, RIGHT);
  return { yaw: Math.atan2(f.x, f.z), pitch: Math.asin(Math.max(-1, Math.min(1, -f.y))), roll: Math.asin(Math.max(-1, Math.min(1, -r.y))) };
};

/** A front wheel's forward and right in the body's frame at a steer `delta` (positive: to the left). */
export const wheelAxes = (delta: number): { forward: V3; right: V3 } => ({
  forward: v3(-Math.sin(delta), 0, Math.cos(delta)),
  right: v3(Math.cos(delta), 0, Math.sin(delta)),
});
