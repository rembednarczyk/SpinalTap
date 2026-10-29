import type { EntityId, Vec3 } from "@seki/core";
import { CROWD_CHUNKS } from "../content/crowd";
import type { Entity } from "../world/components";
import type { SimContext, System } from "../world/context";
import { type ResidentPlan, crowdCount, residentEntity, residentId, residentOf, standerActivity } from "../world/crowd";
import { slotOf } from "../world/passersby";
import { inPlayerView } from "./crime-system";

/** Steps between looks at who may come or go (a look casts a ray per waiting resident). */
const LOOK_STEPS = 15;
/** Past this distance from the player a resident may come or go even in plain view (m). */
const UNSEEN_BEYOND = 55;

/** Would the player see someone come or go at `p`? Close, in front and in plain sight. */
const watched = (ctx: SimContext, player: Entity | null, p: Vec3): boolean =>
  player !== null && Math.hypot(p.x - player.position.x, p.z - player.position.z) < UNSEEN_BEYOND && inPlayerView(ctx, player, p);

interface Live {
  readonly entity: Entity;
  readonly plan: ResidentPlan;
  slot: number;
}

/**
 * The residents of the city (ADR-0041): keeps each resident chunk's crowd at the size the hour,
 * the district and the crowd density ask for. A chunk that streams in comes with its crowd; as
 * the hour changes people come and go, but never where the player is looking. Standers change
 * what they do with the passers-by's routine slots. Residents are never saved and use no shared
 * randomness: who each one is comes from the seed (world/crowd.ts).
 */
export const createCrowdSystem = (): System => {
  const live = new Map<EntityId, Live>();
  const resident = new Set<string>();
  let wait = 0;
  return {
    name: "crowd",
    run(ctx) {
      const cap = ctx.crowdCap;
      if (cap <= 0 && live.size === 0) return;
      const clock = ctx.state.domain.clock;
      const player = ctx.session.gameOver ? null : (ctx.world.with("player").first ?? null);
      wait -= 1;
      const look = wait <= 0;
      if (look) wait = LOOK_STEPS;
      const slot = slotOf(clock);
      ctx.streamer.chunks.forEach((chunk, order) => {
        if (!CROWD_CHUNKS[chunk.id]) return;
        const loaded = ctx.streamer.isLoaded(chunk.id);
        const fresh = loaded && !resident.has(chunk.id);
        if (loaded) resident.add(chunk.id);
        else resident.delete(chunk.id);
        const count = loaded ? crowdCount(chunk.id, cap, clock) : 0;
        for (let i = 0; i < cap; i++) {
          const id = residentId(order, i);
          let r = live.get(id);
          if (r && !ctx.world.has(r.entity)) {
            live.delete(id);
            r = undefined;
          }
          if (!loaded) continue;
          const wanted = i < count;
          if (wanted && !r) {
            if (!fresh && !look) continue;
            const plan = residentOf(ctx.seed, chunk.id, i);
            if (!plan) continue;
            const made = residentEntity(id, ctx.seed, plan, clock, (x, z) => ctx.streamer.ground.heightAt(x, z));
            if (!fresh && watched(ctx, player, made.position)) continue;
            live.set(id, { entity: ctx.world.add(made), plan, slot });
            ctx.streamer.streamedOut.delete(id);
          } else if (!wanted && r) {
            if (!look || watched(ctx, player, r.entity.position)) continue;
            ctx.world.remove(r.entity);
            live.delete(id);
            // Gone without a fall: the renderer takes it out as it does an unloaded chunk's.
            ctx.streamer.streamedOut.add(id);
          } else if (r && r.slot !== slot) {
            r.slot = slot;
            if (r.entity.passerby && !r.entity.passerby.lane) r.entity.passerby.activity = standerActivity(ctx.seed, r.plan, clock);
          }
        }
      });
    },
  };
};
