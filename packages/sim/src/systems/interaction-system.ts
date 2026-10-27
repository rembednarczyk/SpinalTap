import { shopTerms } from "@seki/core";
import type { Entity } from "../world/components";
import type { System } from "../world/context";

/**
 * Tracks the nearest interactable in reach and starts a dialogue on the interact edge.
 * A shop whose owner's faction is hostile to the player refuses instead of opening. What an
 * NPC on a daily plan offers can change with the hour (see the schedule system).
 */
export const interactionSystem: System = {
  name: "interaction",
  run(ctx) {
    const { session, world } = ctx;
    if (session.dialogueActive || session.gameOver) return;
    const player = world.with("player").first;
    if (!player) return;
    let best: (Entity & { interactable: NonNullable<Entity["interactable"]> }) | null = null;
    let bestDist = Infinity;
    for (const e of world.with("interactable")) {
      const d = Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z);
      if (d <= e.interactable.radius && d < bestDist) {
        best = e;
        bestDist = d;
      }
    }
    const focusId = best?.id ?? null;
    const prompt = best?.interactable.prompt ?? null;
    if (focusId !== session.focusId || prompt !== session.focusPrompt) {
      session.focusId = focusId;
      session.focusPrompt = prompt;
      ctx.bus.emit("InteractionFocusChanged", { targetId: focusId, prompt });
    }
    if (best && ctx.input.interact) {
      const { interactable, faction } = best;
      if (interactable.kind === "shop" && faction && !shopTerms(ctx.state.domain.reputation[faction]).open) {
        ctx.bus.emit("InteractionRefused", { targetId: best.id, dialogueId: interactable.dialogueId, faction });
        return;
      }
      session.dialogueActive = true;
      session.focusId = null;
      session.focusPrompt = null;
      ctx.bus.emit("InteractionFocusChanged", { targetId: null, prompt: null });
      ctx.bus.emit("InteractionStarted", { targetId: best.id, dialogueId: best.interactable.dialogueId, kind: best.interactable.kind });
    }
  },
};
