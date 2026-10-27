import type { System } from "../world/context";

/**
 * Streams chunks in and out around the player. Runs first in the step, so every other system
 * sees the world that belongs to the player's current position (also right after a teleport).
 */
export const streamingSystem: System = {
  name: "streaming",
  run(ctx) {
    const player = ctx.world.with("player").first;
    if (player) ctx.streamer.update(ctx.world, ctx.state.domain.flags, player.position);
  },
};
