import type { World } from "miniplex";
import type { Entity } from "../world/components";
import type { System } from "../world/context";
import { inCreationOrder } from "../world/ordering";
import { scheduledInteraction, scheduledPose } from "../world/schedule";

/**
 * Daily plans: works out where each scheduled NPC should be at this step's time and what
 * talking to it means at this hour (e.g. a closed stall). Moving there is left to the AI,
 * which walks after the pose with the usual collisions. No randomness, no hidden state.
 */
export const scheduleSystem: System = {
  name: "schedule",
  run(ctx) {
    const clock = ctx.state.domain.clock;
    for (const e of inCreationOrder(ctx.world.with("schedule"))) {
      const pose = scheduledPose(e.schedule.def, clock);
      e.schedule.pose = pose;
      setInteraction(ctx.world, e, scheduledInteraction(e.schedule.def, pose.stop, e.schedule.own));
    }
  },
};

const setInteraction = (world: World<Entity>, e: Entity, next: Entity["interactable"] | null): void => {
  if ((e.interactable ?? null) === next) return;
  if (next === null) world.removeComponent(e, "interactable");
  else if (e.interactable) e.interactable = next;
  else world.addComponent(e, "interactable", next);
};
