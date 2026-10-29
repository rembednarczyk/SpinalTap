import type { EntityId } from "@seki/core";
import type { Entity } from "../world/components";
import type { System } from "../world/context";
import { passerbyEntity, passerbyStop } from "../world/passersby";

/**
 * Background passers-by (ADR-0040): keeps each resident chunk's few passers-by in the world
 * and points them at the spot of their routine's current slot. Streaming takes them out with
 * their chunk (they carry it), and they come back on their routine when it loads again. They
 * are never saved: a loaded game puts them at their spots for its clock. Uses no shared
 * randomness: each routine has a stream derived from the seed.
 */
export const createPasserbySystem = (): System => {
  const live = new Map<EntityId, Entity>();
  return {
    name: "passersby",
    run(ctx) {
      const clock = ctx.state.domain.clock;
      for (const [chunk, ids] of ctx.streamer.passerbyIds) {
        const resident = ctx.streamer.isLoaded(chunk);
        ids.forEach((id, index) => {
          let e = live.get(id);
          if (e && !ctx.world.has(e)) {
            live.delete(id);
            e = undefined;
          }
          if (!resident) return;
          const stop = passerbyStop(ctx.seed, chunk, index, ids.length, clock);
          if (!stop) return;
          if (!e) {
            e = ctx.world.add(passerbyEntity(id, chunk, index, stop));
            live.set(id, e);
            ctx.streamer.streamedOut.delete(id);
            return;
          }
          const p = e.passerby;
          if (!p || p.goal === stop.spot.at) return;
          p.goal = stop.spot.at;
          p.yaw = stop.spot.yaw;
          p.activity = stop.activity;
          p.waypoint = null;
          p.repath = 0;
        });
      }
    },
  };
};
