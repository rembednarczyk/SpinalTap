import { contractItemKey, contractKind, shopTerms, takenFlag } from "@seki/core";
import type { Entity } from "../world/components";
import type { SimContext, System } from "../world/context";
import { clearContract, raiseFlag } from "../world/domain-ops";
import { callElevator } from "./elevator-system";

/** Picking up the crate of the running retrieval job: it leaves the world and the job is cleared. */
const takeContractCrate = (ctx: SimContext, crate: Entity): void => {
  const contract = ctx.state.domain.contracts.active;
  if (!crate.key || contract?.status !== "active" || contractKind(contract) !== "retrieve" || crate.key !== contractItemKey(contract.id)) return;
  raiseFlag(ctx, takenFlag(crate.key));
  ctx.world.remove(crate);
  ctx.session.focusId = null;
  ctx.bus.emit("InteractionFocusChanged", { targetId: null, prompt: null });
  clearContract(ctx);
};

/** Vertical reach of the interact key, metres between feet (or the button's base). */
const INTERACT_REACH_Y = 1.6;

/**
 * Tracks the nearest interactable in reach and starts a dialogue on the interact edge; a
 * pickup is taken on the spot instead. A shop whose owner's faction is hostile to the player
 * refuses instead of opening. What an NPC on a daily plan offers can change with the hour
 * (see the schedule system).
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
      // Not through a floor: from the overpass nobody below is in reach (ADR-0020).
      if (Math.abs(e.position.y - player.position.y) > INTERACT_REACH_Y) continue;
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
      if (interactable.kind === "elevator") {
        callElevator(ctx, interactable, player);
        return;
      }
      if (interactable.kind === "pickup") {
        takeContractCrate(ctx, best);
        return;
      }
      if (interactable.kind === "shop" && faction && !shopTerms(ctx.state.domain.reputation[faction]).open) {
        ctx.bus.emit("InteractionRefused", { targetId: best.id, dialogueId: interactable.dialogueId, faction });
        return;
      }
      session.dialogueActive = true;
      session.focusId = null;
      session.focusPrompt = null;
      ctx.bus.emit("InteractionFocusChanged", { targetId: null, prompt: null });
      ctx.bus.emit("InteractionStarted", {
        targetId: best.id,
        dialogueId: interactable.dialogueId,
        kind: interactable.kind,
        ...(interactable.kind === "shop" ? { shopId: interactable.shopId ?? "clinic" } : {}),
      });
    }
  },
};
