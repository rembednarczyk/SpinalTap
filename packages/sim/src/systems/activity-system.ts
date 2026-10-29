import type { System } from "../world/context";
import { activityOf } from "../world/activity";

/**
 * Activities (ADR-0040): after the AI has moved everyone, works out what each person does
 * where it stands and keeps it on the entity for the presentation. A pure function of the
 * entities and the clock; nothing random, nothing saved, no effect on the rules.
 */
export const activitySystem: System = {
  name: "activity",
  run(ctx) {
    const clock = ctx.state.domain.clock;
    const { dialogueActive, focusId } = ctx.session;
    for (const e of ctx.world.with("view")) {
      if (e.view.kind !== "npc" && e.view.kind !== "enemy" && e.view.kind !== "crowd") continue;
      const next = activityOf(e, clock, dialogueActive && focusId === e.id);
      if (next === (e.activity ?? null)) continue;
      if (next === null) delete e.activity;
      else e.activity = next;
    }
  },
};
