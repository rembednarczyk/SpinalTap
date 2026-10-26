import { resolveCircleAabb } from "../world/collision";
import type { System } from "../world/context";

const ITERATIONS = 2;

/** Integrates velocity and resolves character footprints against static geometry and other bodies. */
export const movementSystem: System = {
  name: "movement",
  run({ world, dt }) {
    const solids = [...world.with("solid")];
    const bodies = [...world.with("body")];
    for (const e of world.with("velocity", "body")) {
      if (e.velocity.x === 0 && e.velocity.z === 0) continue;
      let x = e.position.x + e.velocity.x * dt;
      let z = e.position.z + e.velocity.z * dt;
      for (let i = 0; i < ITERATIONS; i++) {
        for (const s of solids) ({ x, z } = resolveCircleAabb(x, z, e.body.radius, s.solid));
        for (const other of bodies) {
          if (other === e) continue;
          const dx = x - other.position.x;
          const dz = z - other.position.z;
          const min = e.body.radius + other.body.radius;
          const d = Math.hypot(dx, dz);
          if (d < min && d > 1e-6) {
            x = other.position.x + (dx / d) * min;
            z = other.position.z + (dz / d) * min;
          }
        }
      }
      e.position = { x, y: e.position.y, z };
    }
  },
};
