import { contractItemKey, contractKind, shopTerms, takenFlag } from "@seki/core";
import type { Entity } from "../world/components";
import type { SimContext, System } from "../world/context";
import { clearContract, raiseFlag } from "../world/domain-ops";

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

/**
 * Tracks the nearest interactable in reach and starts a dialogue on the interact edge; a
 * pickup is taken on the spot instead. A shop whose owner's faction is hostile to the player
 * refuses instead of opening.
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
    if (focusId !== session.focusId) {
      session.focusId = focusId;
      ctx.bus.emit("InteractionFocusChanged", { targetId: focusId, prompt: best?.interactable.prompt ?? null });
    }
    if (best && ctx.input.interact) {
      const { interactable, faction } = best;
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
      ctx.bus.emit("InteractionFocusChanged", { targetId: null, prompt: null });
      ctx.bus.emit("InteractionStarted", { targetId: best.id, dialogueId: interactable.dialogueId, kind: interactable.kind });
    }
  },
};
