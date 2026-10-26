import type { System } from "../world/context";

/** Remembers last step's transforms so rendering can interpolate between steps. */
export const interpolationSystem: System = {
  name: "interpolation",
  run({ world }) {
    for (const e of world.with("velocity")) {
      e.prevPosition = e.position;
      e.prevYaw = e.yaw;
    }
  },
};
