import { killedFlag } from "@seki/core";
import type { Entity } from "../world/components";
import type { System } from "../world/context";
import { raiseFlag } from "../world/domain-ops";

export const deadFlag = (key: string): string => `dead:${key}`;

/** Removes killed NPCs (recording it in flags) and ends the run when the player flatlines. */
export const deathSystem: System = {
  name: "death",
  run(ctx) {
    const dead: Entity[] = [];
    for (const e of ctx.world.with("health")) if (e.health.current <= 0) dead.push(e);
    for (const e of dead) {
      if (e.player) {
        if (!ctx.session.gameOver) {
          ctx.session.gameOver = true;
          ctx.bus.emit("PlayerDied", { entityId: e.id });
        }
        continue;
      }
      if (e.key) raiseFlag(ctx, deadFlag(e.key));
      if (e.tag) raiseFlag(ctx, killedFlag(e.tag));
      ctx.bus.emit("EntityKilled", { entityId: e.id, tag: e.tag ?? null });
      ctx.world.remove(e);
    }
  },
};
