import type { VehicleSpec } from "@seki/core";
import { type V3, add, dot, normalize, scale, toWorld, v3 } from "./frame";
import { type CarState, isFront, isLeft, mountOf } from "./state";

/** The ground a car drives on: its height under a point (the world's, with the paving's lift). */
export interface CarGround {
  heightAt(x: number, z: number): number;
}

/** The ground's normal at (x, z), from its heights 0.25 m round (central differences). */
export const groundNormal = (g: CarGround, x: number, z: number): V3 => {
  const e = 0.25;
  const dx = g.heightAt(x + e, z) - g.heightAt(x - e, z);
  const dz = g.heightAt(x, z + e) - g.heightAt(x, z - e);
  return normalize(v3(-dx, 2 * e, -dz));
};

/** Where the ray from `from` along `dir` (unit, downwards) meets the ground, or null within `reach`: a few fixed-point steps over the height field. */
export const groundHit = (g: CarGround, from: V3, dir: V3, reach: number): { t: number; at: V3 } | null => {
  if (dir.y >= -1e-6) return null;
  let t = (from.y - g.heightAt(from.x, from.z)) / -dir.y;
  for (let k = 0; k < 4; k++) {
    const p = add(from, scale(dir, t));
    t = (from.y - g.heightAt(p.x, p.z)) / -dir.y;
  }
  if (t < -0.5 || t > reach) return null;
  return { t: Math.max(t, 0), at: add(from, scale(dir, t)) };
};

/**
 * The suspension (ADR-0097 §2.1): from each mount a ray down the body's axis, as long as the
 * spring's rest length and the wheel's radius. Compression `x`, its rate, the force
 * `k·x + c·ẋ` (bump and rebound damping apart), the bump stop past the travel and the anti-roll
 * bar `k_arb·(x_l − x_r)` across each axle. Writes each wheel's load, contact and normal; returns
 * the forces (world) at the contacts, along the ground's normal.
 */
export const suspensionForces = (car: CarState, spec: VehicleSpec, g: CarGround, dt: number): { at: V3; force: V3 }[] => {
  const s = spec.suspension;
  const down = toWorld(car.q, v3(0, -1, 0));
  const reach = s.rest + spec.wheelRadius;
  const x: number[] = [];
  car.wheels.forEach((w, i) => {
    const mount = add(car.pos, toWorld(car.q, mountOf(spec, i)));
    const hit = groundHit(g, mount, down, reach);
    if (!hit) {
      w.contact = null;
      x.push(0);
      return;
    }
    w.contact = hit.at;
    w.normal = groundNormal(g, hit.at.x, hit.at.z);
    x.push(Math.min(reach - hit.t, s.travel + 0.1));
  });
  const out: { at: V3; force: V3 }[] = [];
  car.wheels.forEach((w, i) => {
    const xi = x[i]!;
    const rate = (xi - w.compression) / dt;
    w.compression = xi;
    if (!w.contact) {
      w.load = 0;
      return;
    }
    const k = s.spring[isFront(i) ? 0 : 1];
    const other = x[i + (isLeft(i) ? 1 : -1)]!;
    const bar = spec.antiRoll[isFront(i) ? 0 : 1] * (xi - other);
    const stop = xi > s.travel ? s.stop * (xi - s.travel) : 0;
    const damp = (rate > 0 ? s.bump : s.rebound) * rate;
    const f = Math.max(0, k * xi + damp + bar + stop);
    // The spring pushes along the body's axis; the ground takes it along its normal.
    const along = Math.max(0, -dot(down, w.normal));
    w.load = f * along;
    out.push({ at: w.contact, force: scale(w.normal, w.load) });
  });
  return out;
};
