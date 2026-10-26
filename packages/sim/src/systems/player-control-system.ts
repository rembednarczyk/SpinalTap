import { clamp, deriveStats, type DerivedStats, type CharacterState } from "@seki/core";
import type { System } from "../world/context";

export const PITCH_LIMIT = 1.25;
export const SPRINT_MULTIPLIER = 1.65;

let cachedCharacter: CharacterState | null = null;
let cachedStats: DerivedStats | null = null;

/** Memoised on the (immutable) character object; stats only change when it does. */
export const statsFor = (c: CharacterState): DerivedStats => {
  if (c !== cachedCharacter || !cachedStats) {
    cachedCharacter = c;
    cachedStats = deriveStats(c);
  }
  return cachedStats;
};

/** Turns the InputFrame into player look angles, desired velocity and the camera mode toggle. */
export const playerControlSystem: System = {
  name: "player-control",
  run(ctx) {
    const { input, session } = ctx;
    if (input.toggleCamera) {
      const mode = ctx.state.domain.preferences.cameraMode === "FPP" ? "TPP" : "FPP";
      ctx.state.domain = { ...ctx.state.domain, preferences: { ...ctx.state.domain.preferences, cameraMode: mode } };
      ctx.bus.emit("CameraModeChanged", { mode });
    }
    const stats = statsFor(ctx.state.domain.character);
    for (const p of ctx.world.with("player", "velocity")) {
      if (p.health) p.health = { current: Math.min(p.health.current, stats.maxHp), max: stats.maxHp };
      if (session.dialogueActive || session.gameOver) {
        p.velocity = { x: 0, y: 0, z: 0 };
        continue;
      }
      p.yaw += input.lookYaw;
      p.pitch = clamp(p.pitch + input.lookPitch, -PITCH_LIMIT, PITCH_LIMIT);
      const len = Math.hypot(input.moveX, input.moveZ);
      const nx = len > 1 ? input.moveX / len : input.moveX;
      const nz = len > 1 ? input.moveZ / len : input.moveZ;
      const speed = stats.moveSpeed * (input.sprint && nz > 0 ? SPRINT_MULTIPLIER : 1);
      const sin = Math.sin(p.yaw);
      const cos = Math.cos(p.yaw);
      // Forward = (sin, cos); right = (cos, -sin).
      p.velocity = { x: (sin * nz + cos * nx) * speed, y: 0, z: (cos * nz - sin * nx) * speed };
    }
  },
};
