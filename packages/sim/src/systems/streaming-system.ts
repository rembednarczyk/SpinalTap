import type { System } from "../world/context";
import { playerOrPassenger } from "../world/metro-ride";

/**
 * Streams chunks in and out around the player. Runs first in the step, so every other system
 * sees the world that belongs to the player's current position (also right after a teleport).
 */
export const streamingSystem: System = {
  name: "streaming",
  run(ctx) {
    // A rider is already on the destination platform: that district streams in during the ride.
    const player = playerOrPassenger(ctx);
    if (player) ctx.streamer.update(ctx.world, ctx.state.domain.flags, player.position, ctx.state.domain.clock);
  },
};
